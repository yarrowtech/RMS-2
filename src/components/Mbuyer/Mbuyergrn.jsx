import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

const API_BASE_URL =
  APP_API_URL;

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
});

const today = new Date().toISOString().slice(0, 10);

const createEmptyForm = () => ({
  ownerSite: "",
  receiptNo: "",
  vendorName: "",
  vendorDocumentNo: "",
  type: "",
  tradeGroupName: "",
  orderCurrency: "",
  date: today,
  generalReferenceNo: "",
  stockPoint: "",
  vendorDocumentDate: today,
  agent: "",
  termName: "",
  exchangeRate: "",
  gateEntryNo: "",
  gateEntryDate: "",
  logisticNo: "",
  logisticDate: "",
  freightAmount: "",
  transporterName: "",
  gateEntryQuantity: "",
  declarationAmount1: "",
  logisticQuantity: "",
  declarationAmount2: "",
  otherAmount: "",
  shipmentTrackingApplicable: "",
  items: [],
});

const createEmptyItem = () => ({
  oemBarcode: "",
  barcode: "",
  generateUniqueBarcode: false,

  division: "",
  section: "",
  department: "",
  article: "",
  hsnSacId: "",
  hsnSacCode: "",
  itcEligibility: "",

  category1: "",
  category2: "",
  category3: "",
  category4: "",
  category5: "",
  category6: "",

  description1: "",
  description2: "",
  description3: "",
  description4: "",
  description5: "",
  description6: "",

  itemName: "",
  shortName: "",
  vendorName: "",
  vendorAlias: "",
  taxGroup: "",
  materialType: "",
  costSheet: "",
  expiryDate: "",
  generalLedger: "",

  unitOfMeasurement: "",
  negativeStockMethod: "",
  inventoryItem: "",
  scanUnit: "",
  number1: "",
  number2: "",
  number3: "",
  remarks: "",

  quantity: "",
  rate: "",
  discount: "",
  standardRate: "",
  wsp: "",
  rsp: "",
  mrp: "",

  inventoryManagement: "",
  pricingManagement: "",
  expiryManagement: "",
  validityMode: "",
  validityPeriod: "",

  multiPriceAction: "",
  autoQtyPopup: "",
  allowPriceChange: "",
  chargeExtraTax: "",
  priceChangesLimit: "",
  returnBehaviour: "",
  batchSelectionProcess: "",

  storeWisePrices: [],

  itemDescription: "",
  orderNo: "",
  orderDate: "",
  netAmount: "",
  effectiveValue: "",
  basicValue: "",
});

const createEmptyStoreWisePrice = () => ({
  name: "",
  initial: "",
  addFrom: "",
  effectiveDate: "",
  rsp: "",
  mrp: "",
});

const SEARCH_FIELD_KEYS = [
  { key: "barcode", label: "Barcode" },
  { key: "division", label: "Division" },
  { key: "section", label: "Section" },
  { key: "department", label: "Department" },
  { key: "article", label: "Article Name" },
  { key: "hsnSacId", label: "HSN Code" },
  { key: "category1", label: "Category 1" },
  { key: "category2", label: "Category 2" },
  { key: "category3", label: "Category 3" },
  { key: "category4", label: "Category 4" },
  { key: "category5", label: "Category 5" },
  { key: "category6", label: "Category 6" },
];

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function makeBarcode() {
  return `ITM-${Date.now().toString().slice(-8)}`;
}

function normalizeOption(option) {
  if (typeof option === "string" || typeof option === "number") {
    return String(option);
  }

  if (option && typeof option === "object") {
    return (
      option.name ||
      option.label ||
      option.value ||
      option.title ||
      option.code ||
      option.id ||
      option._id ||
      option.itemName ||
      option.article ||
      option.barcode ||
      option.oemBarcode ||
      ""
    );
  }

  return "";
}

function getOptions(options, keys) {
  const keyList = Array.isArray(keys) ? keys : [keys];

  const values = keyList.flatMap((key) => {
    const value = options?.[key];
    return Array.isArray(value) ? value : [];
  });

  return Array.from(new Set(values.map(normalizeOption).filter(Boolean)));
}

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Something went wrong"
  );
}

function isNetworkError(error) {
  return (
    !error?.response ||
    error?.code === "ERR_NETWORK" ||
    String(error?.message || "").toLowerCase().includes("network")
  );
}

function showApiError(error) {
  const message = isNetworkError(error)
    ? "Network Error: Backend server is not running or API URL is wrong"
    : getErrorMessage(error);

  toast.error(message, {
    id: isNetworkError(error) ? "network-error" : message,
  });
}

function ComboBox({
  value,
  onChange,
  options = [],
  type = "text",
  placeholder = "",
  disabled = false,
  small = false,
  className = "",
}) {
  const listId = useRef(
    `combo-${Math.random().toString(36).slice(2, 10)}`
  ).current;

  return (
    <>
      <input
        type={type}
        list={type === "text" ? listId : undefined}
        value={value || ""}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full border border-slate-300 bg-white font-semibold text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 disabled:bg-slate-100",
          small
            ? "h-8 rounded-md px-2 text-[12px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
            : "h-[38px] rounded-xl px-4 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100",
          className
        )}
      />

      {type === "text" && (
        <datalist id={listId}>
          {options.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      )}
    </>
  );
}

function DateBox({ value, onChange, small = false }) {
  return (
    <input
      type="date"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full border border-slate-300 bg-white font-semibold text-slate-900 shadow-sm outline-none transition",
        small
          ? "h-8 rounded-md px-2 text-[12px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
          : "h-[38px] rounded-xl px-4 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      )}
    />
  );
}

function FormRow({ label, required = false, children }) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-[140px_1fr] md:items-center">
      <label className="text-sm font-black text-slate-900">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function MiniRow({ label, required = false, children, wideLabel = false }) {
  return (
    <div
      className="grid items-center gap-2"
      style={{
        gridTemplateColumns: wideLabel ? "190px 1fr" : "155px 1fr",
      }}
    >
      <label className="text-[12px] font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-600">*</span>}
      </label>
      {children}
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="flex items-center gap-3 text-lg font-black text-slate-900">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
            ▣
          </span>
          {title}
        </h3>

        <span className="text-lg text-slate-500">⌃</span>
      </div>

      {children}
    </div>
  );
}

function MiniSection({ title, children }) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="border-b border-slate-100 pb-2">
        <h4 className="text-[12px] font-black text-indigo-600">{title}</h4>
      </div>

      {children}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled = false,
  type = "button",
  variant = "light",
}) {
  const variants = {
    primary: "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700",
    dark: "border-slate-700 bg-slate-700 text-white hover:bg-slate-800",
    light: "border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`h-11 rounded-xl border px-7 text-sm font-black shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

function PageModal({
  title,
  onClose,
  footer,
  children,
  z = "z-[999]",
  maxWidth = "max-w-[920px]",
}) {
  return (
    <div
      className={`absolute inset-0 ${z} flex items-center justify-center rounded-[26px] bg-slate-900/55 p-5 backdrop-blur-[2px]`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`flex h-[82%] w-full ${maxWidth} flex-col overflow-hidden rounded-[22px] border border-white/60 bg-white shadow-[0_22px_70px_rgba(15,23,42,0.45)]`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-[58px] shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-6">
          <h2 className="flex items-center gap-3 text-lg font-black text-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-100 text-indigo-600">
              ▣
            </span>
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl text-2xl text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-5">
          {children}
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-3">
          {footer}
        </div>
      </div>
    </div>
  );
}

function StoreWisePriceTable({ rows, onAdd, onChange, onRemove }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-3">
        <button
          type="button"
          onClick={onAdd}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          Add Row
        </button>

        <span className="text-sm font-black text-indigo-600">
          Price Information
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-[12px]">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              {[
                "#",
                "Name",
                "Initial",
                "Add From",
                "Effective Date",
                "RSP",
                "MRP",
                "Action",
              ].map((head) => (
                <th
                  key={head}
                  className="border border-slate-200 px-2 py-2 text-left font-bold"
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="border border-slate-200 px-3 py-14 text-center text-slate-500"
                >
                  No store wise price added.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index}>
                  <td className="border border-slate-200 px-2 py-1">
                    {index + 1}
                  </td>

                  {[
                    "name",
                    "initial",
                    "addFrom",
                    "effectiveDate",
                    "rsp",
                    "mrp",
                  ].map((key) => (
                    <td key={key} className="border border-slate-200 p-1">
                      {key === "effectiveDate" ? (
                        <DateBox
                          small
                          value={row[key]}
                          onChange={(v) => onChange(index, key, v)}
                        />
                      ) : (
                        <ComboBox
                          small
                          value={row[key]}
                          onChange={(v) => onChange(index, key, v)}
                        />
                      )}
                    </td>
                  ))}

                  <td className="border border-slate-200 p-1">
                    <button
                      type="button"
                      onClick={() => onRemove(index)}
                      className="rounded-md bg-red-50 px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-100"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SelectItemModal({
  onClose,
  selectableItems,
  isSelectedItem,
  toggleSelectedItem,
  masterOptions,
}) {
  const [activeTab, setActiveTab] = useState("criteria");

  const [searchFilters, setSearchFilters] = useState(() => {
    const base = {};

    SEARCH_FIELD_KEYS.forEach((field) => {
      base[field.key] = {
        operator: "",
        value: "",
      };
    });

    return {
      ...base,
      directStock: false,

      documentType: "",
      documentDateFrom: today,
      documentDateTo: today,
      documentNo: "",
      stockPointName: "",
      populateZeroQuantity: false,
      populateRateFromSelectedDocument: false,

      otherFilter: "",
      otherStatus: "",

      inventoryTracking: "",
      inventoryStatus: "",
      inventoryManagement: "",
    };
  });

  const updateSearchFilter = (key, subKey, value) => {
    setSearchFilters((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [subKey]: value,
      },
    }));
  };

  const updateDirectFilter = (key, value) => {
    setSearchFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const resetSearch = () => {
    const base = {};

    SEARCH_FIELD_KEYS.forEach((field) => {
      base[field.key] = {
        operator: "Contains",
        value: "",
      };
    });

    setSearchFilters({
      ...base,
      directStock: false,

      documentType: "Purchase Order (Procurement)",
      documentDateFrom: today,
      documentDateTo: today,
      documentNo: "",
      stockPointName: "",
      populateZeroQuantity: false,
      populateRateFromSelectedDocument: false,

      otherFilter: "",
      otherStatus: "",

      inventoryTracking: "",
      inventoryStatus: "",
      inventoryManagement: "",
    });

    setActiveTab("criteria");
  };

  const filteredItems = useMemo(() => {
    return selectableItems.filter((item) => {
      return SEARCH_FIELD_KEYS.every((field) => {
        const value = String(searchFilters[field.key]?.value || "")
          .trim()
          .toLowerCase();

        if (!value) return true;

        const itemValue = String(item[field.key] || "").toLowerCase();
        const operator = searchFilters[field.key]?.operator || "Contains";

        if (operator === "Equals") return itemValue === value;
        if (operator === "Starts With") return itemValue.startsWith(value);

        return itemValue.includes(value);
      });
    });
  }, [searchFilters, selectableItems]);

  const searchNow = () => {
    setActiveTab("searched");
    toast.success(`${filteredItems.length} item found`, {
      id: "search-items",
    });
  };

  return (
    <PageModal
      title="Select Items"
      onClose={onClose}
      z="z-[1000]"
      maxWidth="max-w-[1080px]"
      footer={
        <div className="flex items-center justify-between gap-4">
          <ActionButton onClick={searchNow}>Speed Search</ActionButton>

          <div className="flex gap-3">
            <ActionButton onClick={resetSearch}>Reset</ActionButton>

            <ActionButton variant="primary" onClick={searchNow}>
              Search
            </ActionButton>

            <ActionButton onClick={onClose}>Close</ActionButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab("criteria")}
            className={cn(
              "border-b-2 px-4 py-2 text-xs font-black uppercase",
              activeTab === "criteria"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500"
            )}
          >
            Search Criteria
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("searched")}
            className={cn(
              "border-b-2 px-4 py-2 text-xs font-black uppercase",
              activeTab === "searched"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500"
            )}
          >
            Searched Items
          </button>
        </div>

        {activeTab === "criteria" && (
          <div className="space-y-4">
            <MiniSection title="General">
              <div className="grid grid-cols-1 gap-x-6 gap-y-2 lg:grid-cols-2">
                {SEARCH_FIELD_KEYS.map((field) => (
                  <div
                    key={field.key}
                    className="grid grid-cols-1 gap-2 md:grid-cols-[130px_120px_1fr] md:items-center"
                  >
                    <label className="text-[12px] font-semibold text-slate-700">
                      {field.label}
                    </label>

                    <ComboBox
                      small
                      value={searchFilters[field.key]?.operator}
                      onChange={(v) =>
                        updateSearchFilter(field.key, "operator", v)
                      }
                      options={["Contains", "Equals", "Starts With"]}
                    />

                    <ComboBox
                      small
                      value={searchFilters[field.key]?.value}
                      onChange={(v) =>
                        updateSearchFilter(field.key, "value", v)
                      }
                      options={getOptions(masterOptions, [
                        field.key,
                        `${field.key}s`,
                        "items",
                        "articles",
                        "categories",
                      ])}
                    />
                  </div>
                ))}

                <label className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={searchFilters.directStock}
                    onChange={(e) =>
                      updateDirectFilter("directStock", e.target.checked)
                    }
                    className="h-4 w-4 accent-indigo-600"
                  />
                  Direct Stock
                </label>
              </div>
            </MiniSection>

            <MiniSection title="Additional">
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="mb-3 border-b border-slate-200 pb-2 text-[12px] font-black text-indigo-600">
                    Documents
                  </h5>

                  <div className="grid grid-cols-1 gap-x-8 gap-y-3 lg:grid-cols-2">
                    <MiniRow label="Document Type">
                      <ComboBox
                        small
                        value={searchFilters.documentType}
                        onChange={(v) =>
                          updateDirectFilter("documentType", v)
                        }
                        options={[
                          "Purchase Order (Procurement)",
                          "Goods Receive Challan",
                          "Purchase Invoice",
                          ...getOptions(masterOptions, ["documentTypes"]),
                        ]}
                      />
                    </MiniRow>

                    <MiniRow label="Document No.">
                      <ComboBox
                        small
                        value={searchFilters.documentNo}
                        onChange={(v) =>
                          updateDirectFilter("documentNo", v)
                        }
                        options={getOptions(masterOptions, [
                          "documentNos",
                          "vendorDocumentNos",
                        ])}
                      />
                    </MiniRow>

                    <MiniRow label="Document Date From">
                      <DateBox
                        small
                        value={searchFilters.documentDateFrom}
                        onChange={(v) =>
                          updateDirectFilter("documentDateFrom", v)
                        }
                      />
                    </MiniRow>

                    <MiniRow label="Document Date To">
                      <DateBox
                        small
                        value={searchFilters.documentDateTo}
                        onChange={(v) =>
                          updateDirectFilter("documentDateTo", v)
                        }
                      />
                    </MiniRow>

                    <MiniRow label="Stock Point Name">
                      <ComboBox
                        small
                        value={searchFilters.stockPointName}
                        onChange={(v) =>
                          updateDirectFilter("stockPointName", v)
                        }
                        options={getOptions(masterOptions, ["stockPoints"])}
                      />
                    </MiniRow>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={searchFilters.populateZeroQuantity}
                          onChange={(e) =>
                            updateDirectFilter(
                              "populateZeroQuantity",
                              e.target.checked
                            )
                          }
                          className="h-4 w-4 accent-indigo-600"
                        />
                        Populate Zero Quantity from above Source
                      </label>

                      <label className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={
                            searchFilters.populateRateFromSelectedDocument
                          }
                          onChange={(e) =>
                            updateDirectFilter(
                              "populateRateFromSelectedDocument",
                              e.target.checked
                            )
                          }
                          className="h-4 w-4 accent-indigo-600"
                        />
                        Populate Rate from selected Document
                      </label>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="mb-3 border-b border-slate-200 pb-2 text-[12px] font-black text-indigo-600">
                    Others
                  </h5>

                  <div className="grid grid-cols-1 gap-x-8 gap-y-3 lg:grid-cols-2">
                    <MiniRow label="Other Filter">
                      <ComboBox
                        small
                        value={searchFilters.otherFilter}
                        onChange={(v) =>
                          updateDirectFilter("otherFilter", v)
                        }
                        options={getOptions(masterOptions, [
                          "otherFilters",
                          "others",
                        ])}
                      />
                    </MiniRow>

                    <MiniRow label="Other Status">
                      <ComboBox
                        small
                        value={searchFilters.otherStatus}
                        onChange={(v) =>
                          updateDirectFilter("otherStatus", v)
                        }
                        options={getOptions(masterOptions, [
                          "otherStatuses",
                          "statuses",
                        ])}
                      />
                    </MiniRow>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="mb-3 border-b border-slate-200 pb-2 text-[12px] font-black text-indigo-600">
                    Inventory Tracking
                  </h5>

                  <div className="grid grid-cols-1 gap-x-8 gap-y-3 lg:grid-cols-2">
                    <MiniRow label="Inventory Tracking">
                      <ComboBox
                        small
                        value={searchFilters.inventoryTracking}
                        onChange={(v) =>
                          updateDirectFilter("inventoryTracking", v)
                        }
                        options={getOptions(masterOptions, [
                          "inventoryTracking",
                          "inventoryTrackings",
                        ])}
                      />
                    </MiniRow>

                    <MiniRow label="Inventory Status">
                      <ComboBox
                        small
                        value={searchFilters.inventoryStatus}
                        onChange={(v) =>
                          updateDirectFilter("inventoryStatus", v)
                        }
                        options={getOptions(masterOptions, [
                          "inventoryStatuses",
                          "stockStatuses",
                        ])}
                      />
                    </MiniRow>

                    <MiniRow label="Inventory Management">
                      <ComboBox
                        small
                        value={searchFilters.inventoryManagement}
                        onChange={(v) =>
                          updateDirectFilter("inventoryManagement", v)
                        }
                        options={getOptions(masterOptions, [
                          "inventoryManagements",
                        ])}
                      />
                    </MiniRow>
                  </div>
                </div>
              </div>
            </MiniSection>
          </div>
        )}

        {activeTab === "searched" && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="text-sm font-black text-slate-900">
                Searched Items
              </h3>

              <span className="text-xs font-bold text-slate-500">
                {filteredItems.length} item found
              </span>
            </div>

            <div className="max-h-[430px] overflow-auto">
              <table className="w-full min-w-[1100px] text-[12px]">
                <thead className="sticky top-0 bg-slate-100 text-slate-700">
                  <tr>
                    {[
                      "Select",
                      "Barcode",
                      "Item Name",
                      "Article",
                      "Division",
                      "Department",
                      "Category 1",
                      "Rate",
                      "Qty",
                    ].map((head) => (
                      <th
                        key={head}
                        className="whitespace-nowrap border border-slate-200 px-3 py-2 text-left font-black"
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="border border-slate-200 px-4 py-12 text-center text-sm font-semibold text-slate-500"
                      >
                        No item found.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, index) => {
                      const checked = isSelectedItem(item);

                      return (
                        <tr
                          key={`${item.barcode}-${index}`}
                          className="hover:bg-indigo-50"
                        >
                          <td className="border border-slate-200 px-3 py-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                toggleSelectedItem(item, e.target.checked)
                              }
                              className="h-4 w-4 accent-indigo-600"
                            />
                          </td>

                          <td className="border border-slate-200 px-3 py-2 font-bold text-indigo-700">
                            {item.barcode || "—"}
                          </td>

                          <td className="border border-slate-200 px-3 py-2 font-semibold text-slate-800">
                            {item.itemDescription || item.itemName || "—"}
                          </td>

                          <td className="border border-slate-200 px-3 py-2">
                            {item.article || "—"}
                          </td>

                          <td className="border border-slate-200 px-3 py-2">
                            {item.division || "—"}
                          </td>

                          <td className="border border-slate-200 px-3 py-2">
                            {item.department || "—"}
                          </td>

                          <td className="border border-slate-200 px-3 py-2">
                            {item.category1 || "—"}
                          </td>

                          <td className="border border-slate-200 px-3 py-2 text-right">
                            {item.rate || "—"}
                          </td>

                          <td className="border border-slate-200 px-3 py-2 text-right">
                            {item.quantity || "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PageModal>
  );
}

function ItemPopup({ onClose, onCreate, masterOptions }) {
  const [item, setItem] = useState(createEmptyItem());

  const update = (key, value) => {
    setItem((prev) => {
      const next = { ...prev, [key]: value };

      const rate = Number(key === "rate" ? value : next.rate || 0);
      const quantity = Number(key === "quantity" ? value : next.quantity || 0);
      const discount = Number(key === "discount" ? value : next.discount || 0);

      const basicValue = rate * quantity;
      const netAmount = basicValue - discount;

      next.basicValue = basicValue ? String(basicValue) : "";
      next.netAmount = netAmount ? String(netAmount) : "";
      next.effectiveValue = netAmount ? String(netAmount) : "";

      return next;
    });
  };

  const generateBarcode = () => {
    const code = makeBarcode();

    setItem((prev) => ({
      ...prev,
      oemBarcode: code,
      barcode: code,
    }));

    toast.success("Barcode generated", { id: "barcode-generated" });
  };

  const addStorePriceRow = () => {
    setItem((prev) => ({
      ...prev,
      storeWisePrices: [
        ...(prev.storeWisePrices || []),
        createEmptyStoreWisePrice(),
      ],
    }));
  };

  const updateStorePriceRow = (index, key, value) => {
    setItem((prev) => {
      const rows = [...(prev.storeWisePrices || [])];
      rows[index] = { ...rows[index], [key]: value };
      return { ...prev, storeWisePrices: rows };
    });
  };

  const removeStorePriceRow = (index) => {
    setItem((prev) => ({
      ...prev,
      storeWisePrices: (prev.storeWisePrices || []).filter(
        (_, i) => i !== index
      ),
    }));
  };

  const buildFinalItem = () => {
    const finalBarcode = item.barcode || item.oemBarcode || makeBarcode();

    return {
      ...item,
      oemBarcode: finalBarcode,
      barcode: finalBarcode,
      itemDescription:
        item.itemDescription || item.itemName || item.article || finalBarcode,
    };
  };

  const createItemAndClose = () => {
    if (!item.article.trim()) return toast.error("Article is required");
    if (!item.hsnSacId.trim()) return toast.error("HSN/SAC ID is required");
    if (!item.itcEligibility.trim())
      return toast.error("ITC Eligibility is required");
    if (!item.taxGroup.trim()) return toast.error("Tax Group is required");
    if (!item.materialType.trim())
      return toast.error("Material Type is required");
    if (!item.scanUnit.trim()) return toast.error("Scan Unit is required");
    if (!item.inventoryManagement.trim())
      return toast.error("Inventory Management is required");
    if (!item.multiPriceAction.trim())
      return toast.error("Multi Price Action is required");
    if (!item.allowPriceChange.trim())
      return toast.error("Allow Price Change is required");
    if (!item.autoQtyPopup.trim())
      return toast.error("Auto Qty Popup is required");
    if (!item.returnBehaviour.trim())
      return toast.error("Return Behaviour is required");

    onCreate(buildFinalItem());
    toast.success("Item created successfully", { id: "item-created" });
    onClose();
  };

  const populateItemAndClose = () => {
    onCreate(buildFinalItem());
    toast.success("Item populated successfully", { id: "item-populated" });
    onClose();
  };

  return (
    <PageModal
      title="Add: Item"
      onClose={onClose}
      z="z-[1000]"
      maxWidth="max-w-[980px]"
      footer={
        <div className="flex items-center justify-between gap-4">
          <ActionButton onClick={() => setItem(createEmptyItem())}>
            Clear
          </ActionButton>

          <div className="flex gap-3">
            <ActionButton variant="primary" onClick={createItemAndClose}>
              Create Item
            </ActionButton>

            <ActionButton onClick={populateItemAndClose}>
              Populate Item
            </ActionButton>

            <ActionButton onClick={onClose}>Close</ActionButton>
          </div>
        </div>
      }
    >
      <div className="space-y-5 pb-1">
        <MiniSection title="General">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_260px]">
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
                <div className="md:col-span-2">
                  <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:gap-4">
                    <label className="w-[120px] pt-[7px] text-[12px] font-semibold text-slate-700">
                      OEM Barcode
                    </label>

                    <div className="w-full xl:w-[320px]">
                      <ComboBox
                        small
                        value={item.oemBarcode}
                        onChange={(v) => {
                          update("oemBarcode", v);
                          update("barcode", v);
                        }}
                        options={getOptions(masterOptions, [
                          "barcodes",
                          "oemBarcodes",
                        ])}
                      />

                      <label className="mt-1 flex items-start gap-1 text-[10px] leading-[1.2] text-slate-700">
                        <input
                          type="checkbox"
                          checked={item.generateUniqueBarcode}
                          onChange={(e) =>
                            update("generateUniqueBarcode", e.target.checked)
                          }
                          className="mt-[2px] h-3 w-3 shrink-0 border border-[#bdbdbd] accent-indigo-600"
                        />
                        <span className="break-words">
                          Generate unique Barcode for each quantity
                        </span>
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={generateBarcode}
                      className="h-8 min-w-[185px] whitespace-nowrap rounded-md border border-slate-300 bg-white px-4 text-[11px] font-bold text-slate-700 shadow-sm hover:bg-slate-50 xl:self-start"
                    >
                      Generate GSI Code
                    </button>
                  </div>
                </div>

                <MiniRow label="Division">
                  <ComboBox
                    small
                    value={item.division}
                    onChange={(v) => update("division", v)}
                    options={getOptions(masterOptions, [
                      "divisions",
                      "division",
                    ])}
                  />
                </MiniRow>

                <MiniRow label="Section">
                  <ComboBox
                    small
                    value={item.section}
                    onChange={(v) => update("section", v)}
                    options={getOptions(masterOptions, [
                      "sections",
                      "section",
                    ])}
                  />
                </MiniRow>

                <MiniRow label="Department">
                  <ComboBox
                    small
                    value={item.department}
                    onChange={(v) => update("department", v)}
                    options={getOptions(masterOptions, [
                      "departments",
                      "department",
                    ])}
                  />
                </MiniRow>

                <MiniRow label="Article" required>
                  <ComboBox
                    small
                    value={item.article}
                    onChange={(v) => update("article", v)}
                    options={getOptions(masterOptions, ["articles", "article"])}
                  />
                </MiniRow>

                <MiniRow label="HSN/SAC ID" required>
                  <ComboBox
                    small
                    value={item.hsnSacId}
                    onChange={(v) => update("hsnSacId", v)}
                    options={getOptions(masterOptions, [
                      "hsnSacIds",
                      "hsnSacId",
                    ])}
                  />
                </MiniRow>

                <MiniRow label="HSN/SAC Code">
                  <ComboBox
                    small
                    value={item.hsnSacCode}
                    onChange={(v) => update("hsnSacCode", v)}
                    options={getOptions(masterOptions, [
                      "hsnSacCodes",
                      "hsnSacCode",
                    ])}
                  />
                </MiniRow>

                <MiniRow label="ITC Eligibility" required>
                  <ComboBox
                    small
                    value={item.itcEligibility}
                    onChange={(v) => update("itcEligibility", v)}
                    options={getOptions(masterOptions, [
                      "itcEligibilities",
                      "itcEligibility",
                    ])}
                  />
                </MiniRow>
              </div>
            </div>

            <div>
              <div className="grid h-[165px] place-items-center rounded-xl border border-slate-300 bg-slate-50">
                <div className="text-center">
                  <div className="text-3xl font-black text-slate-300">NO</div>
                  <div className="text-3xl font-black text-slate-300">
                    IMAGE
                  </div>
                  <div className="text-3xl font-black text-slate-300">
                    AVAILABLE
                  </div>
                </div>
              </div>

              <p className="mt-2 text-center text-[10px] text-slate-500">
                Image conversion is not defined for the department.
              </p>
            </div>
          </div>
        </MiniSection>

        <MiniSection title="Category & Description">
          <div className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
            {[1, 2, 3, 4, 5, 6].map((no) => (
              <React.Fragment key={no}>
                <MiniRow label={`Category ${no}`}>
                  <ComboBox
                    small
                    value={item[`category${no}`]}
                    onChange={(v) => update(`category${no}`, v)}
                    options={getOptions(masterOptions, [
                      `category${no}`,
                      `categories${no}`,
                      "categories",
                    ])}
                  />
                </MiniRow>

                <MiniRow label={`Description ${no}`}>
                  <ComboBox
                    small
                    value={item[`description${no}`]}
                    onChange={(v) => update(`description${no}`, v)}
                    options={getOptions(masterOptions, [
                      `description${no}`,
                      `descriptions${no}`,
                      "descriptions",
                    ])}
                  />
                </MiniRow>
              </React.Fragment>
            ))}
          </div>

          <div className="text-center">
            <button
              type="button"
              className="text-[11px] font-bold text-indigo-600 hover:underline"
            >
              Show Items
            </button>
          </div>
        </MiniSection>

        <MiniSection title="Other">
          <div className="grid grid-cols-1 gap-x-8 gap-y-2 lg:grid-cols-2">
            {[
              ["Item Name", "itemName", ["itemNames", "items"], false],
              [
                "Unit of Measurement",
                "unitOfMeasurement",
                ["units", "unitOfMeasurement", "uoms"],
                false,
              ],
              ["Short Name", "shortName", ["shortNames"], false],
              [
                "Negative Stock Method",
                "negativeStockMethod",
                ["negativeStockMethods"],
                false,
              ],
              ["Vendor Name", "vendorName", ["vendorNames", "vendors"], false],
              ["Inventory Item", "inventoryItem", ["inventoryItems"], false],
              ["Vendor Alias", "vendorAlias", ["vendorAliases"], false],
              ["Scan Unit", "scanUnit", ["scanUnits"], true],
              ["Tax Group", "taxGroup", ["taxGroups"], true],
              ["Number 1", "number1", ["number1s"], false],
              ["Material Type", "materialType", ["materialTypes"], true],
              ["Number 2", "number2", ["number2s"], false],
              ["Cost Sheet", "costSheet", ["costSheets"], false],
              ["Number 3", "number3", ["number3s"], false],
              ["Remarks", "remarks", ["remarks"], false],
              ["General Ledger", "generalLedger", ["generalLedgers"], false],
            ].map(([label, key, opts, required]) => (
              <MiniRow key={key} label={label} required={required}>
                <ComboBox
                  small
                  value={item[key]}
                  onChange={(v) => update(key, v)}
                  options={getOptions(masterOptions, opts)}
                />
              </MiniRow>
            ))}

            <MiniRow label="Expiry Date">
              <DateBox
                small
                value={item.expiryDate}
                onChange={(v) => update("expiryDate", v)}
              />
            </MiniRow>
          </div>
        </MiniSection>

        <MiniSection title="Pricing">
          <div className="grid grid-cols-1 gap-x-8 gap-y-2 lg:grid-cols-2">
            {[
              ["Quantity", "quantity", ["quantities"]],
              ["Standard Rate", "standardRate", ["standardRates"]],
              ["Rate", "rate", ["rates"]],
              ["WSP", "wsp", ["wsps"]],
              ["Discount %", "discount", ["discounts"]],
              ["RSP", "rsp", ["rsps"]],
              ["MRP", "mrp", ["mrps"]],
            ].map(([label, key, opts]) => (
              <MiniRow key={key} label={label}>
                <ComboBox
                  small
                  value={item[key]}
                  onChange={(v) => update(key, v)}
                  options={getOptions(masterOptions, opts)}
                />
              </MiniRow>
            ))}

            <button
              type="button"
              className="h-8 w-fit rounded-md border border-slate-300 bg-white px-4 text-[12px] font-bold hover:bg-slate-50"
            >
              Price Calculation
            </button>
          </div>
        </MiniSection>

        <MiniSection title="Inventory Tracking">
          <div className="grid grid-cols-1 gap-x-8 gap-y-2 lg:grid-cols-2">
            <MiniRow label="Inventory Management" required>
              <ComboBox
                small
                value={item.inventoryManagement}
                onChange={(v) => update("inventoryManagement", v)}
                options={getOptions(masterOptions, ["inventoryManagements"])}
              />
            </MiniRow>

            <MiniRow label="Validity Mode">
              <ComboBox
                small
                value={item.validityMode}
                onChange={(v) => update("validityMode", v)}
                options={getOptions(masterOptions, ["validityModes"])}
              />
            </MiniRow>

            <MiniRow label="Pricing Management">
              <ComboBox
                small
                value={item.pricingManagement}
                onChange={(v) => update("pricingManagement", v)}
                options={getOptions(masterOptions, ["pricingManagements"])}
              />
            </MiniRow>

            <MiniRow label="Validity Period">
              <ComboBox
                small
                value={item.validityPeriod}
                onChange={(v) => update("validityPeriod", v)}
                options={getOptions(masterOptions, ["validityPeriods"])}
              />
            </MiniRow>

            <MiniRow label="Expiry Management">
              <ComboBox
                small
                value={item.expiryManagement}
                onChange={(v) => update("expiryManagement", v)}
                options={getOptions(masterOptions, ["expiryManagements"])}
              />
            </MiniRow>
          </div>
        </MiniSection>

        <MiniSection title="POS Behaviour">
          <div className="grid grid-cols-1 gap-x-8 gap-y-2 lg:grid-cols-2">
            {[
              ["Multi Price Action", "multiPriceAction", true],
              ["Auto Qty Popup", "autoQtyPopup", true],
              ["Allow Price Change", "allowPriceChange", true],
              ["Charge Extra Tax", "chargeExtraTax", false],
              ["Price Changes Limit", "priceChangesLimit", false],
              ["Return Behaviour", "returnBehaviour", true],
              ["Batch Selection Process", "batchSelectionProcess", false],
            ].map(([label, key, required]) => (
              <MiniRow key={key} label={label} required={required} wideLabel>
                <ComboBox
                  small
                  value={item[key]}
                  onChange={(v) => update(key, v)}
                  options={getOptions(masterOptions, [`${key}s`])}
                />
              </MiniRow>
            ))}
          </div>
        </MiniSection>

        <MiniSection title="Store Wise Multiple Price">
          <StoreWisePriceTable
            rows={item.storeWisePrices || []}
            onAdd={addStorePriceRow}
            onChange={updateStorePriceRow}
            onRemove={removeStorePriceRow}
          />
        </MiniSection>
      </div>
    </PageModal>
  );
}

function GRCFormModal({ editData, onClose, onSaved, masterOptions }) {
  const [form, setForm] = useState(editData || createEmptyForm());
  const [saving, setSaving] = useState(false);
  const [itemPopupOpen, setItemPopupOpen] = useState(false);
  const [selectItemOpen, setSelectItemOpen] = useState(false);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const selectableItems = useMemo(() => {
    const rawItems = [
      ...(Array.isArray(masterOptions?.items) ? masterOptions.items : []),
      ...(Array.isArray(masterOptions?.itemNames)
        ? masterOptions.itemNames.map((name) => ({ itemName: name }))
        : []),
      ...(Array.isArray(masterOptions?.articles)
        ? masterOptions.articles.map((article) => ({ article }))
        : []),
    ];

    const normalized = rawItems
      .map((raw, index) => {
        if (typeof raw === "string" || typeof raw === "number") {
          const value = String(raw);

          return {
            ...createEmptyItem(),
            barcode: value,
            oemBarcode: value,
            itemDescription: value,
            itemName: value,
            article: value,
            quantity: "1",
          };
        }

        const barcode =
          raw?.barcode ||
          raw?.oemBarcode ||
          raw?.itemCode ||
          raw?.code ||
          raw?.article ||
          raw?.itemName ||
          raw?.name ||
          `ITEM-${index + 1}`;

        return {
          ...createEmptyItem(),
          ...raw,
          barcode,
          oemBarcode: raw?.oemBarcode || barcode,
          itemDescription:
            raw?.itemDescription ||
            raw?.description ||
            raw?.itemName ||
            raw?.name ||
            raw?.article ||
            barcode,
          itemName: raw?.itemName || raw?.name || raw?.article || barcode,
          article: raw?.article || raw?.itemName || raw?.name || barcode,
          quantity: raw?.quantity || "1",
          rate: raw?.rate || "",
          basicValue: raw?.basicValue || "",
          netAmount: raw?.netAmount || "",
          effectiveValue: raw?.effectiveValue || "",
        };
      })
      .filter((item) => item.barcode || item.itemDescription);

    const unique = [];
    const seen = new Set();

    normalized.forEach((item) => {
      const key = item.barcode || item.itemDescription;

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    });

    return unique;
  }, [masterOptions]);

  const isSelectedItem = (selectItem) => {
    const key = selectItem.barcode || selectItem.itemDescription;

    return form.items.some(
      (item) => (item.barcode || item.itemDescription) === key
    );
  };

  const addCreatedItem = (newItem) => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
  };

  const toggleSelectedItem = (selectItem, checked) => {
    const key = selectItem.barcode || selectItem.itemDescription;

    setForm((prev) => {
      const exists = prev.items.some(
        (item) => (item.barcode || item.itemDescription) === key
      );

      if (checked && !exists) {
        toast.success("Item selected", { id: "item-selected" });
        return { ...prev, items: [...prev.items, selectItem] };
      }

      if (!checked && exists) {
        return {
          ...prev,
          items: prev.items.filter(
            (item) => (item.barcode || item.itemDescription) !== key
          ),
        };
      }

      return prev;
    });
  };

  const updateItem = (index, key, value) => {
    setForm((prev) => {
      const items = [...prev.items];

      items[index] = {
        ...items[index],
        [key]: value,
      };

      const rate = Number(items[index].rate || 0);
      const quantity = Number(items[index].quantity || 0);
      const basicValue = rate * quantity;

      items[index].basicValue = basicValue ? String(basicValue) : "";
      items[index].netAmount = basicValue ? String(basicValue) : "";
      items[index].effectiveValue = basicValue ? String(basicValue) : "";

      return { ...prev, items };
    });
  };

  const removeItem = (index) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const calculateCharges = () => {
    const total = form.items.reduce(
      (sum, item) => sum + Number(item.basicValue || 0),
      0
    );

    toast.success(`Calculated Basic Value: ₹${total.toLocaleString("en-IN")}`, {
      id: "grc-calculate",
    });
  };

  const validate = () => {
    if (!form.ownerSite.trim()) return toast.error("Owner Site is required");
    if (!form.receiptNo.trim()) return toast.error("Receipt No. is required");
    if (!form.vendorName.trim()) return toast.error("Vendor Name is required");
    if (!form.type.trim()) return toast.error("Type is required");
    if (!form.tradeGroupName.trim())
      return toast.error("Trade Group Name is required");
    if (!form.orderCurrency.trim())
      return toast.error("Order Currency is required");
    if (!form.date) return toast.error("Date is required");
    if (!form.stockPoint.trim()) return toast.error("Stock Point is required");
    if (!form.exchangeRate.trim())
      return toast.error("Exchange Rate is required");

    return true;
  };

  const submit = async () => {
    if (!validate()) return;

    try {
      setSaving(true);

      if (editData?._id) {
        await api.put(`/admin/grc/${editData._id}`, form);
        toast.success("GRC updated successfully", { id: "grc-updated" });
      } else {
        await api.post("/admin/grc", form);
        toast.success("GRC saved successfully", { id: "grc-saved" });
      }

      onSaved();
    } catch (error) {
      showApiError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageModal
        title={editData ? "Edit: GRC Voucher" : "Add: GRC Voucher"}
        onClose={onClose}
        z="z-[900]"
        maxWidth="max-w-[920px]"
        footer={
          <div className="flex items-center justify-end gap-3">
            <ActionButton onClick={onClose} disabled={saving}>
              Cancel
            </ActionButton>

            <ActionButton variant="primary" onClick={submit} disabled={saving}>
              {saving ? "Saving..." : "Save Voucher"}
            </ActionButton>
          </div>
        }
      >
        <SectionCard title="Document Information">
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 lg:grid-cols-2">
            <FormRow label="Owner Site" required>
              <ComboBox
                value={form.ownerSite}
                onChange={(v) => update("ownerSite", v)}
                options={getOptions(masterOptions, ["ownerSites", "sites"])}
                placeholder="Enter Owner Site"
              />
            </FormRow>

            <FormRow label="Date" required>
              <DateBox value={form.date} onChange={(v) => update("date", v)} />
            </FormRow>

            <FormRow label="Receipt No." required>
              <ComboBox
                value={form.receiptNo}
                onChange={(v) => update("receiptNo", v)}
                options={getOptions(masterOptions, ["receiptNos"])}
                placeholder="Enter Receipt No."
              />
            </FormRow>

            <FormRow label="Reference">
              <ComboBox
                value={form.generalReferenceNo}
                onChange={(v) => update("generalReferenceNo", v)}
                options={getOptions(masterOptions, ["generalReferenceNos"])}
                placeholder="Enter Reference"
              />
            </FormRow>

            <FormRow label="Vendor Name" required>
              <ComboBox
                value={form.vendorName}
                onChange={(v) => update("vendorName", v)}
                options={getOptions(masterOptions, ["vendorNames", "vendors"])}
                placeholder="Enter Vendor Name"
              />
            </FormRow>

            <FormRow label="Stock Point" required>
              <ComboBox
                value={form.stockPoint}
                onChange={(v) => update("stockPoint", v)}
                options={getOptions(masterOptions, ["stockPoints"])}
                placeholder="Enter Stock Point"
              />
            </FormRow>

            <FormRow label="Vendor Doc No.">
              <ComboBox
                value={form.vendorDocumentNo}
                onChange={(v) => update("vendorDocumentNo", v)}
                options={getOptions(masterOptions, ["vendorDocumentNos"])}
                placeholder="Enter Vendor Document No."
              />
            </FormRow>

            <FormRow label="Vendor Doc Date">
              <DateBox
                value={form.vendorDocumentDate}
                onChange={(v) => update("vendorDocumentDate", v)}
              />
            </FormRow>

            <FormRow label="Type" required>
              <ComboBox
                value={form.type}
                onChange={(v) => update("type", v)}
                options={getOptions(masterOptions, ["grcTypes", "types"])}
                placeholder="Enter Type"
              />
            </FormRow>

            <FormRow label="Agent">
              <ComboBox
                value={form.agent}
                onChange={(v) => update("agent", v)}
                options={getOptions(masterOptions, ["agents"])}
                placeholder="Enter Agent"
              />
            </FormRow>

            <FormRow label="Trade Group" required>
              <ComboBox
                value={form.tradeGroupName}
                onChange={(v) => update("tradeGroupName", v)}
                options={getOptions(masterOptions, ["tradeGroups"])}
                placeholder="Enter Trade Group"
              />
            </FormRow>

            <FormRow label="Term Name">
              <ComboBox
                value={form.termName}
                onChange={(v) => update("termName", v)}
                options={getOptions(masterOptions, ["termNames"])}
                placeholder="Enter Term Name"
              />
            </FormRow>

            <FormRow label="Currency" required>
              <ComboBox
                value={form.orderCurrency}
                onChange={(v) => update("orderCurrency", v)}
                options={getOptions(masterOptions, ["currencies"])}
                placeholder="Enter Currency"
              />
            </FormRow>

            <FormRow label="Exchange Rate" required>
              <ComboBox
                value={form.exchangeRate}
                onChange={(v) => update("exchangeRate", v)}
                options={getOptions(masterOptions, ["exchangeRates"])}
                placeholder="Enter Exchange Rate"
              />
            </FormRow>
          </div>
        </SectionCard>

        <div className="mt-5">
          <SectionCard title="Logistics">
            <div className="grid grid-cols-1 gap-x-8 gap-y-3 lg:grid-cols-2">
              <FormRow label="Gate Entry No.">
                <ComboBox
                  value={form.gateEntryNo}
                  onChange={(v) => update("gateEntryNo", v)}
                  options={getOptions(masterOptions, ["gateEntries"])}
                  placeholder="Enter Gate Entry No."
                />
              </FormRow>

              <FormRow label="Gate Quantity">
                <ComboBox
                  value={form.gateEntryQuantity}
                  onChange={(v) => update("gateEntryQuantity", v)}
                  options={getOptions(masterOptions, ["gateQuantities"])}
                  placeholder="Enter Gate Quantity"
                />
              </FormRow>

              <FormRow label="Gate Date">
                <DateBox
                  value={form.gateEntryDate}
                  onChange={(v) => update("gateEntryDate", v)}
                />
              </FormRow>

              <FormRow label="Declaration 1">
                <ComboBox
                  value={form.declarationAmount1}
                  onChange={(v) => update("declarationAmount1", v)}
                  options={getOptions(masterOptions, ["declarationAmounts"])}
                  placeholder="Enter Declaration Amount"
                />
              </FormRow>

              <FormRow label="Logistic No.">
                <ComboBox
                  value={form.logisticNo}
                  onChange={(v) => update("logisticNo", v)}
                  options={getOptions(masterOptions, ["logistics"])}
                  placeholder="Enter Logistic No."
                />
              </FormRow>

              <FormRow label="Logistic Qty">
                <ComboBox
                  value={form.logisticQuantity}
                  onChange={(v) => update("logisticQuantity", v)}
                  options={getOptions(masterOptions, ["logisticQuantities"])}
                  placeholder="Enter Logistic Quantity"
                />
              </FormRow>

              <FormRow label="Logistic Date">
                <DateBox
                  value={form.logisticDate}
                  onChange={(v) => update("logisticDate", v)}
                />
              </FormRow>

              <FormRow label="Declaration 2">
                <ComboBox
                  value={form.declarationAmount2}
                  onChange={(v) => update("declarationAmount2", v)}
                  options={getOptions(masterOptions, ["declarationAmounts"])}
                  placeholder="Enter Declaration Amount"
                />
              </FormRow>

              <FormRow label="Freight Amount">
                <ComboBox
                  value={form.freightAmount}
                  onChange={(v) => update("freightAmount", v)}
                  options={getOptions(masterOptions, ["freightAmounts"])}
                  placeholder="Enter Freight Amount"
                />
              </FormRow>

              <FormRow label="Other Amount">
                <ComboBox
                  value={form.otherAmount}
                  onChange={(v) => update("otherAmount", v)}
                  options={getOptions(masterOptions, ["otherAmounts"])}
                  placeholder="Enter Other Amount"
                />
              </FormRow>

              <FormRow label="Transporter">
                <ComboBox
                  value={form.transporterName}
                  onChange={(v) => update("transporterName", v)}
                  options={getOptions(masterOptions, ["transporters"])}
                  placeholder="Enter Transporter"
                />
              </FormRow>

              <FormRow label="Shipment Tracking">
                <ComboBox
                  value={form.shipmentTrackingApplicable}
                  onChange={(v) => update("shipmentTrackingApplicable", v)}
                  options={[
                    "Yes",
                    "No",
                    "Applicable",
                    "Not Applicable",
                    ...getOptions(masterOptions, [
                      "shipmentTrackingApplicable",
                      "shipmentTrackingOptions",
                    ]),
                  ]}
                  placeholder="Type manually"
                />
              </FormRow>
            </div>
          </SectionCard>
        </div>

        <div className="mt-5">
          <SectionCard title="Item Details">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-3">
                <button className="rounded-lg bg-indigo-50 px-4 py-2 text-sm font-black text-indigo-700">
                  ITEMS
                </button>

                <button
                  type="button"
                  onClick={calculateCharges}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Calculate Charges
                </button>
              </div>

              <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-3">
                <button
                  type="button"
                  onClick={() => setItemPopupOpen(true)}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white shadow hover:bg-indigo-700"
                >
                  Create Item
                </button>

                <button
                  type="button"
                  onClick={() => setSelectItemOpen(true)}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Select Item
                </button>
              </div>

              <div className="max-h-[230px] overflow-auto">
                <table className="w-full min-w-[1100px] text-[12px]">
                  <thead className="sticky top-0 bg-slate-100 text-slate-700">
                    <tr>
                      {[
                        "#",
                        "Barcode",
                        "Item Description",
                        "Rate",
                        "Quantity",
                        "Order No.",
                        "Order Date",
                        "Net Amount",
                        "Effective Value",
                        "Basic Value",
                        "Action",
                      ].map((head) => (
                        <th
                          key={head}
                          className="border border-slate-200 px-2 py-2 text-left font-bold"
                        >
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {form.items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={11}
                          className="border border-slate-200 px-3 py-12 text-center text-slate-500"
                        >
                          No item added.
                        </td>
                      </tr>
                    ) : (
                      form.items.map((item, index) => (
                        <tr key={index}>
                          <td className="border border-slate-200 px-2 py-1">
                            {index + 1}
                          </td>

                          {[
                            "barcode",
                            "itemDescription",
                            "rate",
                            "quantity",
                            "orderNo",
                            "orderDate",
                            "netAmount",
                            "effectiveValue",
                            "basicValue",
                          ].map((key) => (
                            <td
                              key={key}
                              className="border border-slate-200 p-1"
                            >
                              {key === "orderDate" ? (
                                <DateBox
                                  small
                                  value={item[key]}
                                  onChange={(v) => updateItem(index, key, v)}
                                />
                              ) : (
                                <ComboBox
                                  small
                                  value={item[key]}
                                  onChange={(v) => updateItem(index, key, v)}
                                  options={getOptions(masterOptions, [
                                    key,
                                    `${key}s`,
                                  ])}
                                />
                              )}
                            </td>
                          ))}

                          <td className="border border-slate-200 px-2 py-1">
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="rounded-md bg-red-50 px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-100"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </SectionCard>
        </div>
      </PageModal>

      {itemPopupOpen && (
        <ItemPopup
          onClose={() => setItemPopupOpen(false)}
          onCreate={addCreatedItem}
          masterOptions={masterOptions}
        />
      )}

      {selectItemOpen && (
        <SelectItemModal
          onClose={() => setSelectItemOpen(false)}
          selectableItems={selectableItems}
          isSelectedItem={isSelectedItem}
          toggleSelectedItem={toggleSelectedItem}
          masterOptions={masterOptions}
        />
      )}
    </>
  );
}

function GRCListPage({ grcList, loading, onAdd, onEdit, onDelete }) {
  const formatDate = (value) => {
    if (!value) return "—";
    return String(value).slice(0, 10);
  };

  const getReceiveQuantity = (grc) => {
    if (grc.gateEntryQuantity) return grc.gateEntryQuantity;

    if (Array.isArray(grc.items)) {
      const total = grc.items.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
      );

      return total || "—";
    }

    return "—";
  };

  const getNetAmount = (grc) => {
    if (grc.netAmount) return grc.netAmount;

    if (Array.isArray(grc.items)) {
      const total = grc.items.reduce(
        (sum, item) => sum + Number(item.netAmount || item.basicValue || 0),
        0
      );

      return total ? total.toLocaleString("en-IN") : "—";
    }

    return "—";
  };

  return (
    <div className="h-full w-full space-y-5 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-100 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Goods Receive Challan
          </h2>
        </div>

        <button
          onClick={onAdd}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow transition-all hover:bg-indigo-700 active:scale-95"
        >
          Add GRC
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">
            Goods Receive Challan List
          </h3>

          <span className="text-xs font-bold text-slate-500">
            {grcList.length} records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1800px] text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                {[
                  "Receipt No.",
                  "Receipt Date",
                  "Entry Mode",
                  "Document No.",
                  "Reference No.",
                  "Vendor Name",
                  "Vendor Document Date",
                  "Receipt Type",
                  "Stock Point",
                  "Term Name",
                  "Receive Quantity",
                  "Net Amount",
                  "No. of Attachment",
                  "Created By",
                  "Owner Site",
                  "Action",
                ].map((head) => (
                  <th
                    key={head}
                    className="whitespace-nowrap border-r border-slate-200 px-4 py-3 text-left text-xs font-black uppercase last:border-r-0"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={16}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    Loading GRC...
                  </td>
                </tr>
              ) : grcList.length === 0 ? (
                <tr>
                  <td
                    colSpan={16}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    No GRC found.
                  </td>
                </tr>
              ) : (
                grcList.map((grc) => (
                  <tr
                    key={grc._id || grc.id || grc.receiptNo}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-bold text-indigo-700">
                      {grc.receiptNo || "—"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {formatDate(grc.date || grc.receiptDate)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {grc.entryMode || "Against Order"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {grc.documentNo || grc.vendorDocumentNo || "—"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {grc.referenceNo || grc.generalReferenceNo || "—"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">
                      {grc.vendorName || "—"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {formatDate(grc.vendorDocumentDate)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {grc.receiptType || grc.type || "—"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {grc.stockPoint || "—"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {grc.termName || "—"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-slate-900">
                      {getReceiveQuantity(grc)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-slate-900">
                      {getNetAmount(grc)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-center text-slate-700">
                      {grc.noOfAttachment || grc.attachments?.length || 0}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {grc.createdBy || "—"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {grc.ownerSite || "—"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => onEdit(grc)}
                          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => onDelete(grc)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function GRC1() {
  const didInitialFetch = useRef(false);

  const [grcList, setGrcList] = useState([]);
  const [masterOptions, setMasterOptions] = useState({});
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedGrc, setSelectedGrc] = useState(null);

  const fetchGRC = async (showToast = false) => {
    try {
      setLoading(true);

      const res = await api.get("/admin/grc");
      const list = res.data?.data || res.data?.grc || res.data || [];

      setGrcList(Array.isArray(list) ? list : []);
    } catch (error) {
      if (showToast) {
        showApiError(error);
      } else {
        console.warn("GRC fetch failed:", getErrorMessage(error));
      }

      setGrcList([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMasterOptions = async () => {
    try {
      const res = await api.get("/admin/grc/options");
      const data = res.data?.data || res.data || {};
      setMasterOptions(data && typeof data === "object" ? data : {});
    } catch (error) {
      console.warn("GRC options fetch failed:", getErrorMessage(error));
      setMasterOptions({});
    }
  };

  useEffect(() => {
    if (didInitialFetch.current) return;

    didInitialFetch.current = true;
    fetchGRC(false);
    fetchMasterOptions();
  }, []);

  const openAddPage = () => {
    setSelectedGrc(null);
    setFormOpen(true);
  };

  const openEditPage = (grc) => {
    setSelectedGrc({
      ...createEmptyForm(),
      ...grc,
      date: grc.date ? String(grc.date).slice(0, 10) : today,
      vendorDocumentDate: grc.vendorDocumentDate
        ? String(grc.vendorDocumentDate).slice(0, 10)
        : today,
      gateEntryDate: grc.gateEntryDate
        ? String(grc.gateEntryDate).slice(0, 10)
        : "",
      logisticDate: grc.logisticDate
        ? String(grc.logisticDate).slice(0, 10)
        : "",
      items: Array.isArray(grc.items) ? grc.items : [],
      shipmentTrackingApplicable:
        grc.shipmentTrackingApplicable === true
          ? "Yes"
          : grc.shipmentTrackingApplicable === false
            ? "No"
            : grc.shipmentTrackingApplicable || "",
    });

    setFormOpen(true);
  };

  const closeForm = () => {
    setSelectedGrc(null);
    setFormOpen(false);
  };

  const afterSaved = async () => {
    await fetchGRC(false);
    closeForm();
  };

  const deleteGRC = async (grc) => {
    if (!window.confirm("Delete this GRC?")) return;

    try {
      const id = grc._id || grc.id;
      await api.delete(`/admin/grc/${id}`);

      toast.success("GRC deleted successfully", { id: "grc-deleted" });
      await fetchGRC(false);
    } catch (error) {
      showApiError(error);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[26px]">
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: "14px",
            background: "#0f172a",
            color: "#fff",
            fontWeight: "600",
            fontSize: "13px",
          },
          success: {
            iconTheme: {
              primary: "#10b981",
              secondary: "#fff",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#fff",
            },
          },
        }}
      />

      <GRCListPage
        grcList={grcList}
        loading={loading}
        onAdd={openAddPage}
        onEdit={openEditPage}
        onDelete={deleteGRC}
      />

      {formOpen && (
        <GRCFormModal
          editData={selectedGrc}
          onClose={closeForm}
          onSaved={afterSaved}
          masterOptions={masterOptions}
        />
      )}
    </div>
  );
}