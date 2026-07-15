


from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from motor.motor_asyncio import AsyncIOMotorClient
from openpyxl import load_workbook
import pandas as pd
from io import BytesIO
from typing import List
from datetime import datetime
import hashlib
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/upload", tags=["Upload"])

MAIN_MONGO_URI     = os.getenv("MONGODB_URI")
MAIN_DB_NAME       = os.getenv("MONGODB_DB")
FORECAST_MONGO_URI = os.getenv("FORECAST_MONGO_URI")
FORECAST_DB_NAME   = os.getenv("FORECAST_DB", "rms_forecast")

if not FORECAST_MONGO_URI:
    raise RuntimeError("❌ FORECAST_MONGO_URI not found — check your .env placement!")

main_client     = AsyncIOMotorClient(MAIN_MONGO_URI)
forecast_client = AsyncIOMotorClient(FORECAST_MONGO_URI)
main_db         = main_client[MAIN_DB_NAME]
forecast_db     = forecast_client[FORECAST_DB_NAME]

os.makedirs("uploaded_files", exist_ok=True)


# ══════════════════════════════════════════════════════════
#  HELPERS
# ══════════════════════════════════════════════════════════

def norm_text(val) -> str:
    """Uppercase + strip + collapse spaces. Returns '' for nulls."""
    if val is None:
        return ""
    s = str(val).strip()
    if s.lower() in ("nan", "none", ""):
        return ""
    return " ".join(s.upper().split())


def read_excel_or_csv(raw: bytes, filename: str) -> pd.DataFrame:
    fname = filename.lower()
    try:
        if fname.endswith(".csv"):
            df = pd.read_csv(BytesIO(raw))
        else:
            wb   = load_workbook(BytesIO(raw), read_only=True)
            ws   = wb.active
            data = list(ws.values)

            # Find first row with 4+ non-empty cells
            header_row_idx = None
            for i, row in enumerate(data):
                if row and sum(1 for c in row if c not in (None, "")) >= 4:
                    header_row_idx = i
                    break
            if header_row_idx is None:
                raise HTTPException(status_code=400, detail="No valid header row found")

            headers = [str(c).strip() if c else f"COL_{j}" for j, c in enumerate(data[header_row_idx])]
            df = pd.DataFrame(data[header_row_idx + 1:], columns=headers)

        # Normalize column names: strip + remove spaces/dashes/underscores + uppercase
        df.columns = [
            str(c).strip().replace(" ", "").replace("-", "").replace("_", "").upper()
            for c in df.columns
        ]
        print("📋 Columns:", df.columns.tolist())
        return df

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"File read error ({filename}): {e}")


async def insert_to_mongo(df: pd.DataFrame, collection: str) -> int:
    if df.empty:
        return 0
    df = df.copy()
    df["_row_hash"] = df.astype(str).sum(axis=1).apply(
        lambda x: hashlib.md5(x.encode()).hexdigest()
    )
    existing = set()
    async for doc in forecast_db[collection].find({}, {"_row_hash": 1}):
        if "_row_hash" in doc:
            existing.add(doc["_row_hash"])
    new_df  = df[~df["_row_hash"].isin(existing)]
    if new_df.empty:
        return 0
    records = new_df.where(pd.notnull(new_df), None).to_dict(orient="records")
    result  = await forecast_db[collection].insert_many(records)
    return len(result.inserted_ids)


# ══════════════════════════════════════════════════════════
#  SALES UPLOAD
#
#  Actual Excel columns (confirmed from real file):
#  "Bill Date"           → BILLDATE         → DATE
#  "Store"               → STORE            → STORE
#  "Bill Qty"            → BILLQTY          → BILLQTY
#  "Cat-1 (Design No.)"  → CAT1(DESIGNNO.)  → CAT1
#  "Cat-2 (Brand)"       → CAT2(BRAND)      → CAT2
#  "Cat-3 (Style)"       → CAT3(STYLE)      → CAT3
#  "Cat-4 (Plane,F/S,H/S)"→CAT4(PLANE,F/S,H/S) → CAT4
#  "Cat-5 (Size)"        → CAT5(SIZE)       → CAT5
#  "Ageing"              → AGEING           → CATEGORY6
#  "Std Rate"            → STDRATE          → STANDARDRATE
# ══════════════════════════════════════════════════════════

@router.post("/sales")
async def upload_sales(files: List[UploadFile] = File(...)):
    total_rows = 0
    REQUIRED   = ["STORE", "DIVISION", "SECTION", "DEPARTMENT", "VENDOR", "BILLQTY"]
    OPTIONAL   = ["CAT1", "CAT2", "CAT3", "CAT4", "CAT5", "CATEGORY6", "RSP", "STANDARDRATE"]

    SALES_ALIAS_MAP = {
        "STORE":        ["STORE", "STORENAME"],
        "DIVISION":     ["DIVISION", "DVN"],
        "SECTION":      ["SECTION"],
        "DEPARTMENT":   ["DEPARTMENT", "DEPT"],
        "VENDOR":       ["VENDOR", "SUPPLIER"],
        "BILLQTY":      ["BILLQTY", "BILLQUANTITY"],
        "DATE":         ["BILLDATE", "DATE"],
        # Exact normalized names from real sales file
        "CAT1":         ["CAT1(DESIGNNO.)", "CAT1DESIGNNO", "CAT1"],
        "CAT2":         ["CAT2(BRAND)",     "CAT2BRAND",    "CAT2"],
        "CAT3":         ["CAT3(STYLE)",     "CAT3STYLE",    "CAT3"],
        "CAT4":         ["CAT4(PLANE,F/S,H/S)", "CAT4PLANEFSHS", "CAT4PLANE", "CAT4"],
        "CAT5":         ["CAT5(SIZE)",      "CAT5SIZE",     "CAT5"],
        "CATEGORY6":    ["AGEING",          "CATEGORY6",    "CAT6"],
        "RSP":          ["RSP", "SELLINGPRICE"],
        "STANDARDRATE": ["STDRATE", "STANDARDRATE"],
    }

    for file in files:
        raw = await file.read()
        df  = read_excel_or_csv(raw, file.filename)

        rename_map = {}
        for std, aliases in SALES_ALIAS_MAP.items():
            for alias in aliases:
                an = alias.strip().replace(" ", "").replace("-", "").replace("_", "").upper()
                if an in df.columns and std not in rename_map.values():
                    rename_map[an] = std
                    break
        df.rename(columns=rename_map, inplace=True)
        print("📋 Sales renamed:", rename_map)

        missing = [c for c in REQUIRED if c not in df.columns]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing columns: {missing}")

        # Keep IsVoid so we can filter out voided transactions
        keep = REQUIRED + ["DATE", "ISVOID"] + [c for c in OPTIONAL if c in df.columns]
        df   = df[[c for c in keep if c in df.columns]].copy()

        # Drop voided transactions — they should not count toward salesQty
        if "ISVOID" in df.columns:
            before = len(df)
            df = df[df["ISVOID"].apply(lambda x: str(x).strip().upper() not in ("YES", "TRUE", "1", "Y"))]
            dropped = before - len(df)
            if dropped:
                print(f"⚠️ Dropped {dropped} voided rows")
            df = df.drop(columns=["ISVOID"])

        for c in ["STORE", "DIVISION", "SECTION", "DEPARTMENT", "VENDOR"]:
            if c in df.columns:
                df[c] = df[c].apply(norm_text)

        def clean_category(val):
            """Keep only genuine category labels — discard numbers, dates, empty."""
            if val is None:
                return ""
            # If pandas read it as a datetime object, discard it
            if hasattr(val, 'year'):
                return ""
            s = str(val).strip()
            if s.lower() in ("nan", "none", ""):
                return ""
            # Discard pure numbers (price/qty leaked into cat column)
            try:
                float(s)
                return ""
            except ValueError:
                pass
            # Discard date strings like "2025-03-08 00:00:00" or "08/03/2025"
            if len(s) >= 8 and s[4] == "-" and s[7] == "-":
                return ""
            return " ".join(s.upper().split())

        for cat in ["CAT1", "CAT2", "CAT3", "CAT4", "CAT5", "CATEGORY6"]:
            if cat in df.columns:
                df[cat] = df[cat].apply(clean_category)

        if "DATE" in df.columns:
            df["DATE"] = pd.to_datetime(df["DATE"], errors="coerce", dayfirst=True)
            bad = df["DATE"].isna().sum()
            if bad:
                print(f"⚠️ Dropping {bad} rows with bad dates")
            df = df.dropna(subset=["DATE"])
            df["DATE"] = df["DATE"].apply(lambda x: x.to_pydatetime())

        df["BILLQTY"] = pd.to_numeric(df["BILLQTY"], errors="coerce").fillna(0)

        inserted = await insert_to_mongo(df, "sales_data")
        total_rows += inserted
        await forecast_db["uploaded_files"].insert_one({
            "filename": file.filename, "collection": "sales_data",
            "inserted_rows": inserted, "type": "sales",
            "uploaded_at": datetime.utcnow(),
        })
        print(f"✅ Sales inserted: {inserted} from {file.filename}")

    return JSONResponse({"status": "success", "count": total_rows})


# ══════════════════════════════════════════════════════════
#  STOCK UPLOAD
#
#  Actual Excel columns (confirmed from real files):
#  "Source Site"  → SOURCESITE   → SOURCESITE
#  "CLOSING_QTY"  → CLOSINGQTY   → CLOSINGQTY
#  "Stock as on"  → STOCKASON    → STOCKASON
#  "CATEGORY1-5"  → CATEGORY1-5  (already correct)
#
#  Godowns (case-insensitive substring match):
#    Package, SEMI FRESH WAREHOUSE, WAREHOUSE
#  Stores:
#    CITIMART - CHOWRINGHEE, CITIMART - HATIBAGAN, CITIMART - NEW MARKET
# ══════════════════════════════════════════════════════════

# Confirmed godown keywords from real data
GODOWN_KEYWORDS = ["PACKAGE", "WAREHOUSE"]  # "WAREHOUSE" catches SEMI FRESH WAREHOUSE too

@router.post("/stock")
async def upload_stock(files: List[UploadFile] = File(...)):
    total_rows = 0
    # After header normalization these are the exact column names:
    REQUIRED = ["SOURCESITE", "DIVISION", "SECTION", "DEPARTMENT", "VENDOR", "CLOSINGQTY"]

    for file in files:
        raw = await file.read()
        df  = read_excel_or_csv(raw, file.filename)

        missing = [c for c in REQUIRED if c not in df.columns]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing columns: {missing}")

        # Keep all useful columns — BARCODE critical for dedup uniqueness
        # (multiple items from same vendor/dept must NOT be collapsed into 1 row)
        KEEP = [
            "SOURCESITE",
            "DIVISION", "SECTION", "DEPARTMENT", "VENDOR",
            "BARCODE", "ITEMCODE",
            "CATEGORY1", "CATEGORY2", "CATEGORY3", "CATEGORY4", "CATEGORY5",
            "CATEGORY6", "CAT6",
            "CLOSINGQTY",
            "STOCKASON",
        ]
        df = df[[c for c in KEEP if c in df.columns]].copy()

        # Normalize text
        for c in ["SOURCESITE", "DIVISION", "SECTION", "DEPARTMENT", "VENDOR"]:
            if c in df.columns:
                df[c] = df[c].apply(norm_text)

        for cat in ["CATEGORY1","CATEGORY2","CATEGORY3","CATEGORY4","CATEGORY5","CATEGORY6","CAT6"]:
            if cat in df.columns:
                df[cat] = df[cat].apply(norm_text)

        if "STOCKASON" in df.columns:
            df["STOCKASON"] = pd.to_datetime(df["STOCKASON"], errors="coerce", dayfirst=True)
            df["STOCKASON"] = df["STOCKASON"].apply(lambda x: x.to_pydatetime() if pd.notnull(x) else None)

        df["CLOSINGQTY"] = pd.to_numeric(df["CLOSINGQTY"], errors="coerce").fillna(0)

        # Classify SOURCESITE → SOURCE_SITE ("STORE"/"GODOWN") + SITE_NAME
        def classify_site(site: str):
            if not site:
                return ("UNKNOWN", "UNKNOWN")
            for kw in GODOWN_KEYWORDS:
                if kw in site:          # site already norm_text'd → uppercase
                    return ("GODOWN", site)
            return ("STORE", site)

        classified        = df["SOURCESITE"].apply(classify_site)
        df["SOURCE_SITE"] = classified.apply(lambda x: x[0])
        df["SITE_NAME"]   = classified.apply(lambda x: x[1])

        inserted = await insert_to_mongo(df, "stock_data")
        total_rows += inserted
        await forecast_db["uploaded_files"].insert_one({
            "filename": file.filename, "collection": "stock_data",
            "inserted_rows": inserted, "type": "stock",
            "uploaded_at": datetime.utcnow(),
        })
        print(f"✅ Stock inserted: {inserted} from {file.filename}")

    return JSONResponse({"status": "success", "count": total_rows})


# ══════════════════════════════════════════════════════════
#  FILTER OPTIONS
# ══════════════════════════════════════════════════════════

@router.get("/filters/options")
async def get_filter_options():
    try:
        def uniq(arr):
            return sorted(set(
                str(x).strip() for x in arr
                if x not in [None, "", "nan", "NAN", "None", "UNKNOWN"]
            ))

        stores      = await forecast_db["stock_data"].distinct("SITE_NAME")
        divisions   = await forecast_db["stock_data"].distinct("DIVISION")
        sections    = await forecast_db["stock_data"].distinct("SECTION")
        departments = await forecast_db["stock_data"].distinct("DEPARTMENT")
        vendors     = await forecast_db["stock_data"].distinct("VENDOR")

        cats = []
        for f in ["CAT1","CAT2","CAT3","CAT4","CAT5","CATEGORY6"]:
            cats += await forecast_db["sales_data"].distinct(f)
        for f in ["CATEGORY1","CATEGORY2","CATEGORY3","CATEGORY4","CATEGORY5","CATEGORY6","CAT6"]:
            cats += await forecast_db["stock_data"].distinct(f)

        return {
            "stores":      uniq(stores),
            "divisions":   uniq(divisions),
            "sections":    uniq(sections),
            "departments": uniq(departments),
            "vendors":     uniq(vendors),
            "categories":  uniq(cats),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════
#  STOCK GAP — flat rows
#
#  Logic:
#  - STORE rows: one row per (SITE_NAME, DIV, SEC, DEPT, VENDOR)
#      storeStock  = sum of CLOSINGQTY where SOURCE_SITE = "STORE"
#      godownStock = 0  (godowns shown as their own separate rows)
#      salesQty    = sum of BILLQTY from sales for that store+product
#      stockHolding = (salesQty / days_range) * holdingDays
#      variance     = storeStock - stockHolding
#
#  - GODOWN rows: one row per (GODOWN_NAME, DIV, SEC, DEPT, VENDOR)
#      storeStock  = 0
#      godownStock = sum of CLOSINGQTY where SOURCE_SITE = "GODOWN"
#      salesQty    = 0  (godowns don't sell directly)
#      stockHolding = 0
#      variance     = godownStock  (all godown stock is available surplus)
#
#  This matches your expected Excel report where godown stock is a
#  separate column — here it's a separate row per godown location.
# ══════════════════════════════════════════════════════════

@router.get("/stock-gap")
async def stock_gap(
    fromDate:    str = Query(...),
    toDate:      str = Query(...),
    store:       str = Query("All"),
    division:    str = Query("All"),
    section:     str = Query("All"),
    department:  str = Query("All"),
    vendor:      str = Query("All"),
    category:    str = Query("All"),
    holdingDays: int = Query(45),
):
    try:
        dt_from    = datetime.strptime(fromDate, "%Y-%m-%d")
        dt_to      = datetime.strptime(toDate,   "%Y-%m-%d")
        days_range = (dt_to - dt_from).days + 1
        if days_range <= 0:
            raise HTTPException(status_code=400, detail="Invalid date range")

        def mlist(val: str) -> list:
            return [v.strip().upper() for v in val.split(",") if v.strip()]

        # ────────────────────────────────────────────
        # 1. SALES
        #    key = (STORE, DIV, SEC, DEPT, VENDOR)
        # ────────────────────────────────────────────
        sales_filter: dict = {"DATE": {"$gte": dt_from, "$lte": dt_to}}
        if store      != "All": sales_filter["STORE"]      = {"$in": mlist(store)}
        if division   != "All": sales_filter["DIVISION"]   = {"$in": mlist(division)}
        if section    != "All": sales_filter["SECTION"]    = {"$in": mlist(section)}
        if department != "All": sales_filter["DEPARTMENT"] = {"$in": mlist(department)}
        if vendor     != "All": sales_filter["VENDOR"]     = {"$in": mlist(vendor)}
        if category   != "All":
            cv = mlist(category)
            sales_filter["$or"] = [
                {"CAT1": {"$in": cv}}, {"CAT2": {"$in": cv}},
                {"CAT3": {"$in": cv}}, {"CAT4": {"$in": cv}},
                {"CAT5": {"$in": cv}}, {"CATEGORY6": {"$in": cv}},
            ]

        sales_qty_map:  dict = {}   # (STORE, DIV, SEC, DEPT, VENDOR) → qty
        sales_cats_map: dict = {}   # (STORE, DIV, SEC, DEPT, VENDOR) → [c1..c6]

        async for r in forecast_db["sales_data"].find(sales_filter):
            key = (
                norm_text(r.get("STORE")),
                norm_text(r.get("DIVISION")),
                norm_text(r.get("SECTION")),
                norm_text(r.get("DEPARTMENT")),
                norm_text(r.get("VENDOR")),
            )
            sales_qty_map[key] = sales_qty_map.get(key, 0.0) + float(r.get("BILLQTY") or 0)
            if key not in sales_cats_map:
                sales_cats_map[key] = ["", "", "", "", "", ""]
            cats = sales_cats_map[key]
            for i, f in enumerate(["CAT1","CAT2","CAT3","CAT4","CAT5","CATEGORY6"]):
                if not cats[i]:
                    v = norm_text(r.get(f))
                    if v:
                        cats[i] = v

        print(f"✅ Sales keys: {len(sales_qty_map)} | days={days_range} | holdingDays={holdingDays}")

        # ────────────────────────────────────────────
        # 2. STOCK
        #    store_map  : (SITE_NAME, DIV, SEC, DEPT, VENDOR) → storeStock
        #    godown_map : (DIV, SEC, DEPT, VENDOR) → godownStock (combined all godowns)
        # ────────────────────────────────────────────
        stock_filter: dict = {}
        if store      != "All": stock_filter["$or"] = [
            {"SITE_NAME":   {"$in": mlist(store)}},
            {"SOURCE_SITE": "GODOWN"},   # always include godowns
        ]
        if division   != "All": stock_filter["DIVISION"]   = {"$in": mlist(division)}
        if section    != "All": stock_filter["SECTION"]    = {"$in": mlist(section)}
        if department != "All": stock_filter["DEPARTMENT"] = {"$in": mlist(department)}
        if vendor     != "All": stock_filter["VENDOR"]     = {"$in": mlist(vendor)}

        # ── Find the latest STOCKASON date across all uploaded stock files ──
        # Stock files are point-in-time snapshots — only use the most recent one
        # to avoid double-counting when multiple snapshots are uploaded
        latest_date_doc = await forecast_db["stock_data"].find_one(
            {}, sort=[("STOCKASON", -1)]
        )
        latest_stock_date = latest_date_doc.get("STOCKASON") if latest_date_doc else None

        if latest_stock_date:
            # Filter to only docs from the latest snapshot date
            stock_filter["STOCKASON"] = latest_stock_date
            print(f"✅ Using stock snapshot date: {latest_stock_date}")
        else:
            print("⚠️ No STOCKASON date found — using all stock docs")

        store_map:  dict = {}   # (SITE_NAME, DIV, SEC, DEPT, VENDOR) → storeStock
        godown_map: dict = {}   # (DIV, SEC, DEPT, VENDOR) → combined godownStock

        async for s in forecast_db["stock_data"].find(stock_filter):
            site   = norm_text(s.get("SITE_NAME"))
            source = norm_text(s.get("SOURCE_SITE"))
            div    = norm_text(s.get("DIVISION"))
            sec    = norm_text(s.get("SECTION"))
            dept   = norm_text(s.get("DEPARTMENT"))
            ven    = norm_text(s.get("VENDOR"))
            qty    = float(s.get("CLOSINGQTY") or 0)

            if source == "STORE":
                skey = (site, div, sec, dept, ven)
                store_map[skey] = store_map.get(skey, 0.0) + qty
            elif source == "GODOWN":
                gkey = (div, sec, dept, ven)
                godown_map[gkey] = godown_map.get(gkey, 0.0) + qty

        print(f"✅ Store keys: {len(store_map)} | Godown keys: {len(godown_map)}")

        # ────────────────────────────────────────────
        # 3. BUILD RESULT
        #    One row per (STORE, DIV, SEC, DEPT, VENDOR)
        #    godownStock = combined godown qty for (DIV, SEC, DEPT, VENDOR)
        #    Same godownStock appears on every store row for same product
        #    — exactly like your Excel where godown is one shared column
        # ────────────────────────────────────────────

        # Collect all unique (STORE, DIV, SEC, DEPT, VENDOR) from both sales + stock
        all_keys = set(sales_qty_map.keys()) | set(store_map.keys())

        result = []
        for key in all_keys:
            site_name, div, sec, dept, ven = key

            sq          = float(sales_qty_map.get(key, 0.0))
            st_qty      = float(store_map.get(key, 0.0))
            gd_qty      = float(godown_map.get((div, sec, dept, ven), 0.0))
            store_stock  = round(st_qty)        # integer — actual physical units
            godown_stock = round(gd_qty)        # integer — actual physical units
            total_stock  = store_stock + godown_stock
            sales_qty    = round(sq)            # integer — actual sold units
            cats         = sales_cats_map.get(key, ["","","","","",""])

            # stockHolding = daily avg sales × holding days
            stock_holding = round((sq / days_range) * holdingDays) if days_range > 0 else 0
            # variance = storeStock - stockHolding (how overstocked/understocked the store is)
            variance      = store_stock - stock_holding

            result.append({
                "store":        site_name,
                "division":     div,
                "section":      sec,
                "department":   dept,
                "vendor":       ven,
                "category1":    cats[0],
                "category2":    cats[1],
                "category3":    cats[2],
                "category4":    cats[3],
                "category5":    cats[4],
                "category6":    cats[5],
                "salesQty":     sales_qty,
                "storeStock":   store_stock,
                "godownStock":  godown_stock,
                "totalStock":   total_stock,
                "stockHolding": stock_holding,
                "variance":     variance,
            })

        # Sort by variance ascending — most understocked first
        result.sort(key=lambda x: x["variance"])
        print(f"✅ Result rows: {len(result)}")
        return JSONResponse(content=jsonable_encoder(result))

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))



# ══════════════════════════════════════════════════════════
#  DEBUG — inspect raw data for one product
# ══════════════════════════════════════════════════════════
@router.get("/debug/product")
async def debug_product(
    division:   str = Query(...),
    section:    str = Query(...),
    department: str = Query(...),
):
    # Raw sales docs — case-insensitive partial match
    sales_docs = await forecast_db["sales_data"].find({
        "DIVISION":   {"$regex": division, "$options": "i"},
        "SECTION":    {"$regex": section,  "$options": "i"},
        "DEPARTMENT": {"$regex": department, "$options": "i"},
    }).to_list(50)

    # Raw stock docs
    stock_docs = await forecast_db["stock_data"].find({
        "DIVISION":   {"$regex": division, "$options": "i"},
        "SECTION":    {"$regex": section,  "$options": "i"},
        "DEPARTMENT": {"$regex": department, "$options": "i"},
    }).to_list(50)

    sales_summary: dict = {}
    for r in sales_docs:
        k = f"{r.get('STORE')} | {r.get('VENDOR')}"
        sales_summary[k] = sales_summary.get(k, 0) + float(r.get("BILLQTY") or 0)

    stock_summary: dict = {}
    for s in stock_docs:
        k = f"{s.get('SITE_NAME')} | {s.get('SOURCE_SITE')} | {s.get('VENDOR')}"
        stock_summary[k] = stock_summary.get(k, 0) + float(s.get("CLOSINGQTY") or 0)

    return {
        "sales_total_docs": len(sales_docs),
        "stock_total_docs": len(stock_docs),
        "sales_by_store_vendor": sales_summary,
        "stock_by_site_source_vendor": stock_summary,
        "sample_sales_doc": {k: v for k, v in sales_docs[0].items() if k != "_id"} if sales_docs else {},
        "sample_stock_doc": {k: v for k, v in stock_docs[0].items() if k != "_id"} if stock_docs else {},
    }


@router.get("/debug/counts")
async def debug_counts():
    sales_count = await forecast_db["sales_data"].count_documents({})
    stock_count = await forecast_db["stock_data"].count_documents({})
    sales_sample = await forecast_db["sales_data"].find_one({})
    stock_sample = await forecast_db["stock_data"].find_one({})
    return {
        "sales_total": sales_count,
        "stock_total": stock_count,
        "sales_fields": list(sales_sample.keys()) if sales_sample else [],
        "stock_fields": list(stock_sample.keys()) if stock_sample else [],
        "sales_sample": {k: str(v) for k, v in sales_sample.items() if k != "_id"} if sales_sample else {},
        "stock_sample": {k: str(v) for k, v in stock_sample.items() if k != "_id"} if stock_sample else {},
    }

# ══════════════════════════════════════════════════════════
#  ONE-TIME MIGRATION: fix string dates
# ══════════════════════════════════════════════════════════

@router.post("/migrate/fix-dates")
async def migrate_fix_dates():
    fixed_s = fixed_st = errors = 0
    async for doc in forecast_db["sales_data"].find({"DATE": {"$type": "string"}}):
        try:
            parsed = pd.to_datetime(doc["DATE"], dayfirst=True).to_pydatetime()
            await forecast_db["sales_data"].update_one({"_id": doc["_id"]}, {"$set": {"DATE": parsed}})
            fixed_s += 1
        except Exception:
            errors += 1
    async for doc in forecast_db["stock_data"].find({"DATE": {"$type": "string"}}):
        try:
            parsed = pd.to_datetime(doc["DATE"], dayfirst=True).to_pydatetime()
            await forecast_db["stock_data"].update_one({"_id": doc["_id"]}, {"$set": {"DATE": parsed}})
            fixed_st += 1
        except Exception:
            errors += 1
    return {"status": "done", "fixed_sales": fixed_s, "fixed_stock": fixed_st, "errors": errors}


# ══════════════════════════════════════════════════════════
#  MISC
# ══════════════════════════════════════════════════════════

@router.get("/files")
async def list_uploaded_files():
    files = await forecast_db["uploaded_files"].find().sort("uploaded_at", -1).to_list(100)
    return {"files": files}


@router.get("/test")
async def test_forecast_db():
    try:
        r = await forecast_db["test_collection"].insert_one({"ping": "ok"})
        return {"status": "success", "message": "✅ Connected!", "id": str(r.inserted_id)}
    except Exception as e:
        return {"status": "error", "detail": str(e)}