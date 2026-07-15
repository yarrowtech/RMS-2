import { API_BASE_URL as APP_API_URL } from "../config/api.js";
// // OrderMode.jsx
// import React, { useState } from "react";

// const OrderMode = ({
//   showOrderMode,
//   setShowOrderMode,
//   handlePopulateOrderMode,
// }) => {
//   // ---------------- STATES ----------------
//   const [orderMode, setOrderMode] = useState("ORDER");
//   const [purchaseOrder, setPurchaseOrder] = useState("");
//   const [showItemsBox, setShowItemsBox] = useState(false);
//   const [scanBarcode, setScanBarcode] = useState("");
//   const [filteredRows, setFilteredRows] = useState([
//     {
//       orderNo: "PO/0000357",
//       validUpto: "18/12/25",
//       tolerance: "10%",
//       itemDesc: "Cotton Shirt - Blue",
//       batchSerial: "BATCH/001",
//       rate: "250",
//       per: "Unit",
//     },
//   ]);
//   const [criteria, setCriteria] = useState({
//     orderNo: "",
//     itemDesc: "",
//     batchSerial: "",
//   });

//   const purchaseOrders = ["PO/0000357", "PO/0000358", "PO/0000359"];

//   if (!showOrderMode) return null;

//   // ---------------- RENDER ----------------
//   return (
//     <div
//       className="fixed inset-0 bg-black/25 backdrop-blur-[2px] flex items-center justify-center z-[999]"
//       onMouseDown={(e) => {
//         if (e.target === e.currentTarget) setShowOrderMode(false);
//       }}
//     >
//       <div className="bg-white w-[980px] max-w-[96vw] max-h-[92vh] overflow-y-auto border border-gray-200 rounded-sm shadow-2xl relative">
//         {/* HEADER */}
//         <div className="px-4 py-2 border-b border-gray-200 bg-[#fafafa] flex items-center justify-between sticky top-0 z-10">
//           <div className="flex items-center gap-2">
//             <h2 className="text-[16px] font-semibold text-gray-700">Order Mode</h2>
//             <span className="text-gray-400 text-[12px]">ⓘ</span>
//           </div>
//           <button
//             onClick={() => setShowOrderMode(false)}
//             className="h-10 w-10 grid place-items-center text-gray-500 hover:text-red-600 text-3xl leading-none"
//           >
//             ×
//           </button>
//         </div>

//         {/* BODY */}
//         <div className="p-4 space-y-4 text-[12px]">
//           {/* MODE SELECT */}
//           <div className="border border-gray-200 rounded-sm bg-white overflow-hidden">
//             <div className="px-3 py-2 border-b border-gray-200 bg-[#f7f7f7] flex items-center justify-between">
//               <h3 className="text-[13px] font-semibold text-gray-700">
//                 Select how the items will be populated
//               </h3>
//               <button className="text-gray-400 hover:text-gray-600">▾</button>
//             </div>
//             <div className="p-3">
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                 <label className="flex items-start gap-2 text-gray-700">
//                   <input
//                     type="radio"
//                     name="orderMode"
//                     checked={orderMode === "ORDER"}
//                     onChange={() => setOrderMode("ORDER")}
//                     className="mt-1"
//                   />
//                   <span className="leading-5">
//                     Select an order and populate all pending items.
//                   </span>
//                 </label>

//                 <label className="flex items-start gap-2 text-gray-700">
//                   <input
//                     type="radio"
//                     name="orderMode"
//                     checked={orderMode === "ITEM"}
//                     onChange={() => setOrderMode("ITEM")}
//                     className="mt-1"
//                   />
//                   <span className="leading-5">
//                     Select an item and populate all pending orders.
//                   </span>
//                 </label>
//               </div>
//             </div>
//           </div>

//           {/* ORDER DETAILS */}
//           <div className="border border-gray-200 rounded-sm bg-white overflow-hidden">
//             <div className="px-3 py-2 border-b border-gray-200 bg-[#f7f7f7] flex items-center justify-between">
//               <h3 className="text-[13px] font-semibold text-gray-700">Order Details</h3>
//               <button className="text-gray-400 hover:text-gray-600">▾</button>
//             </div>

//             <div className="p-3">
//               <div className="grid grid-cols-12 gap-4 items-center">
//                 <div className="col-span-12 md:col-span-3 text-gray-600">
//                   Purchase Order
//                 </div>
//                 <div className="col-span-12 md:col-span-5">
//                   <select
//                     value={purchaseOrder}
//                     onChange={(e) => setPurchaseOrder(e.target.value)}
//                     className="w-full h-7 border border-gray-200 bg-white px-2 rounded-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
//                   >
//                     <option value="">Select PO</option>
//                     {purchaseOrders.map((p) => (
//                       <option key={p} value={p}>
//                         {p}
//                       </option>
//                     ))}
//                   </select>
//                 </div>
//                 <div className="col-span-12 md:col-span-2">
//                   <button
//                     type="button"
//                     onClick={() => setShowItemsBox((p) => !p)}
//                     className="w-full h-7 bg-[#efefef] border border-gray-200 rounded-sm text-[12px] hover:bg-[#e9e9e9]"
//                   >
//                     Show Items
//                   </button>
//                 </div>
//                 <div className="hidden md:block md:col-span-2" />
//               </div>

//               {/* CONDITIONAL SHOW ITEMS BOX */}
//               {showItemsBox && (
//                 <div className="mt-2 md:ml-[25%]">
//                   <div className="border border-gray-300 bg-white rounded-sm w-[500px] shadow-sm">
//                     <div className="overflow-x-hidden">
//                       <table className="w-full text-[11px] table-fixed">
//                         <thead>
//                           <tr className="bg-white border-b border-gray-300">
//                             {["Order No.", "Order Date", "Doc No.", "Auth By", "Status"].map(
//                               (h) => (
//                                 <th
//                                   key={h}
//                                   className="px-2 py-1 text-left font-medium text-gray-700 border-r border-gray-300 last:border-r-0 break-words"
//                                 >
//                                   {h}
//                                 </th>
//                               )
//                             )}
//                           </tr>
//                         </thead>
//                         <tbody>
//                           <tr className="border-b border-gray-200 hover:bg-gray-50">
//                             <td className="px-2 py-1">PO/0000357</td>
//                             <td className="px-2 py-1">18/12/25</td>
//                             <td className="px-2 py-1">INV/1249</td>
//                             <td className="px-2 py-1">Pradip</td>
//                             <td className="px-2 py-1">Open</td>
//                           </tr>
//                         </tbody>
//                       </table>
//                     </div>
//                     <div className="px-2 py-1 text-[10px] text-gray-600 flex justify-between">
//                       <span>1 / 1</span>
//                       <span>⟨ ⟩</span>
//                     </div>
//                   </div>
//                 </div>
//               )}

//               {/* SCAN BARCODE */}
//               <div className="mt-4 grid grid-cols-12 gap-4 items-center">
//                 <div className="col-span-12 md:col-span-3 text-gray-600 text-[12px]">
//                   Scan Barcode
//                 </div>
//                 <div className="col-span-12 md:col-span-9">
//                   <input
//                     type="text"
//                     value={scanBarcode}
//                     onChange={(e) => setScanBarcode(e.target.value)}
//                     placeholder="Scan / Enter barcode"
//                     className="w-full h-7 border border-gray-200 bg-white px-2 rounded-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
//                   />
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* ITEM INFORMATION */}
//           <div className="border border-gray-200 rounded-sm bg-white overflow-hidden">
//             <div className="px-3 py-2 border-b border-gray-200 bg-white flex items-center justify-between">
//               <h3 className="text-[13px] font-semibold text-gray-700">Item Information</h3>
//               <button className="text-gray-400 hover:text-gray-600">▾</button>
//             </div>

//             <div className="p-0 overflow-x-auto">
//               <div className="min-w-[920px]">
//                 <table className="w-full text-[12px]">
//                   <thead>
//                     <tr className="bg-white border-b border-gray-200 text-gray-700">
//                       {[
//                         "Order No.",
//                         "Valid Upto",
//                         "Tolerance %",
//                         "Item Description",
//                         "Batch/Serial",
//                         "Rate",
//                         "Per",
//                       ].map((h) => (
//                         <th
//                           key={h}
//                           className="px-3 py-2 font-medium text-left whitespace-nowrap border-r border-gray-200 last:border-r-0"
//                         >
//                           {h}
//                         </th>
//                       ))}
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {filteredRows.length === 0 ? (
//                       <tr>
//                         <td
//                           colSpan={7}
//                           className="h-[260px] bg-white text-gray-400 px-3 text-center"
//                         >
//                           No items found
//                         </td>
//                       </tr>
//                     ) : (
//                       filteredRows.map((r, idx) => (
//                         <tr key={idx} className="border-b border-gray-100">
//                           <td className="px-3 py-2">{r.orderNo}</td>
//                           <td className="px-3 py-2">{r.validUpto}</td>
//                           <td className="px-3 py-2">{r.tolerance}</td>
//                           <td className="px-3 py-2">{r.itemDesc}</td>
//                           <td className="px-3 py-2">{r.batchSerial}</td>
//                           <td className="px-3 py-2">{r.rate}</td>
//                           <td className="px-3 py-2">{r.per}</td>
//                         </tr>
//                       ))
//                     )}
//                   </tbody>
//                 </table>
//               </div>
//             </div>

//             <div className="px-3 py-2 border-t border-gray-200 bg-white text-[12px] text-gray-600">
//               Record Count: <span className="font-semibold">{filteredRows.length}</span>
//             </div>
//           </div>

//           {/* FOOTER BAR */}
//           <div className="px-2 py-2 border border-gray-200 bg-[#fafafa] rounded-sm flex items-center justify-between">
//             <div className="flex items-center gap-2">
//               <button
//                 type="button"
//                 onClick={() => {
//                   setPurchaseOrder("");
//                   setScanBarcode("");
//                   setCriteria({ orderNo: "", itemDesc: "", batchSerial: "" });
//                 }}
//                 className="h-7 px-4 bg-[#efefef] border border-gray-200 rounded-sm text-[12px] hover:bg-[#e9e9e9]"
//               >
//                 Clear
//               </button>

//               <button
//                 type="button"
//                 className="h-7 px-4 bg-[#efefef] border border-gray-200 rounded-sm text-[12px] hover:bg-[#e9e9e9]"
//               >
//                 Receive all Pending Qty.
//               </button>
//             </div>

//             <div className="flex items-center gap-2">
//               <button
//                 type="button"
//                 onClick={handlePopulateOrderMode}
//                 className="h-7 px-6 bg-[#efefef] border border-gray-200 rounded-sm text-[12px] hover:bg-[#e9e9e9]"
//               >
//                 Populate
//               </button>
//               <button
//                 type="button"
//                 onClick={() => setShowOrderMode(false)}
//                 className="h-7 px-6 bg-[#efefef] border border-gray-200 rounded-sm text-[12px] hover:bg-[#e9e9e9]"
//               >
//                 Cancel
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default OrderMode;
// OrderMode.jsx
import React, { useState, useEffect } from "react";

const OrderMode = ({
  showOrderMode,
  setShowOrderMode,
  handlePopulateOrderMode,
  vendorName, // ✅ NEW: passed from AddGRC general section
}) => {
  // ---------------- STATES ----------------
  const [orderMode, setOrderMode] = useState("ORDER");
  const [purchaseOrder, setPurchaseOrder] = useState("");
  const [showItemsBox, setShowItemsBox] = useState(false);
  const [scanBarcode, setScanBarcode] = useState("");
  const [filteredRows, setFilteredRows] = useState([]);
  const [criteria, setCriteria] = useState({
    orderNo: "",
    itemDesc: "",
    batchSerial: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [purchaseOrders, setPurchaseOrders] = useState([]);

  // ---------------- FETCH PENDING ITEMS FROM BACKEND ----------------
  useEffect(() => {
    const fetchPendingItems = async () => {
      if (!vendorName) return; // No vendor selected yet
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `${APP_API_URL}/grc/vendor/${encodeURIComponent(
            vendorName
          )}/pending-items`
        );
        if (!res.ok) throw new Error("Failed to fetch order items");
        const data = await res.json();

        // Map backend data to UI-friendly format
      const mapped = data.pendingItems.map((item) => ({
  orderNo: item.orderNo,
  validUpto: item.orderDate || "—",
  tolerance: "10%", // placeholder
  itemDesc: item.itemDescription || item.description || "",
  batchSerial: item.barcode || "",
  rate: item.rate ?? 0,
  per: "Unit",

  // ✅ include quantity fields so GRC can read them
  pendingQty: item.pendingQty ?? item.quantity ?? item.originalQty ?? 0,
  quantity: item.pendingQty ?? item.quantity ?? 0,
  originalQty: item.originalQty ?? 0,
  receivedQty: item.receivedQty ?? 0,
}));


        setFilteredRows(mapped);
        setPurchaseOrders([
          ...new Set(mapped.map((i) => i.orderNo).filter(Boolean)),
        ]);
      } catch (err) {
        console.error("Error loading pending items:", err);
        setError("Could not load pending items. Please check backend.");
      } finally {
        setLoading(false);
      }
    };

    if (showOrderMode) {
      fetchPendingItems();
    }
  }, [showOrderMode, vendorName]);

  if (!showOrderMode) return null;

  // ---------------- RENDER ----------------
  return (
    <div
      className="fixed inset-0 bg-black/25 backdrop-blur-[2px] flex items-center justify-center z-[999]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setShowOrderMode(false);
      }}
    >
      <div className="bg-white w-[980px] max-w-[96vw] max-h-[92vh] overflow-y-auto border border-gray-200 rounded-sm shadow-2xl relative">
        {/* HEADER */}
        <div className="px-4 py-2 border-b border-gray-200 bg-[#fafafa] flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-semibold text-gray-700">
              Order Mode
            </h2>
            <span className="text-gray-400 text-[12px]">ⓘ</span>
          </div>
          <button
            onClick={() => setShowOrderMode(false)}
            className="h-10 w-10 grid place-items-center text-gray-500 hover:text-red-600 text-3xl leading-none"
          >
            ×
          </button>
        </div>

        {/* BODY */}
        <div className="p-4 space-y-4 text-[12px]">
          {/* MODE SELECT */}
          <div className="border border-gray-200 rounded-sm bg-white overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-200 bg-[#f7f7f7] flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-gray-700">
                Select how the items will be populated
              </h3>
              <button className="text-gray-400 hover:text-gray-600">▾</button>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-start gap-2 text-gray-700">
                  <input
                    type="radio"
                    name="orderMode"
                    checked={orderMode === "ORDER"}
                    onChange={() => setOrderMode("ORDER")}
                    className="mt-1"
                  />
                  <span className="leading-5">
                    Select an order and populate all pending items.
                  </span>
                </label>

                <label className="flex items-start gap-2 text-gray-700">
                  <input
                    type="radio"
                    name="orderMode"
                    checked={orderMode === "ITEM"}
                    onChange={() => setOrderMode("ITEM")}
                    className="mt-1"
                  />
                  <span className="leading-5">
                    Select an item and populate all pending orders.
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* ORDER DETAILS */}
          <div className="border border-gray-200 rounded-sm bg-white overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-200 bg-[#f7f7f7] flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-gray-700">
                Order Details
              </h3>
              <button className="text-gray-400 hover:text-gray-600">▾</button>
            </div>

            <div className="p-3">
              <div className="grid grid-cols-12 gap-4 items-center">
                <div className="col-span-12 md:col-span-3 text-gray-600">
                  Purchase Order
                </div>
                <div className="col-span-12 md:col-span-5">
                  <select
                    value={purchaseOrder}
                    onChange={(e) => setPurchaseOrder(e.target.value)}
                    className="w-full h-7 border border-gray-200 bg-white px-2 rounded-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
                  >
                    <option value="">Select PO</option>
                    {purchaseOrders.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-12 md:col-span-2">
                  <button
                    type="button"
                    onClick={() => setShowItemsBox((p) => !p)}
                    className="w-full h-7 bg-[#efefef] border border-gray-200 rounded-sm text-[12px] hover:bg-[#e9e9e9]"
                  >
                    Show Items
                  </button>
                </div>
                <div className="hidden md:block md:col-span-2" />
              </div>

              {/* CONDITIONAL SHOW ITEMS BOX */}
              {showItemsBox && (
                <div className="mt-2 md:ml-[25%]">
                  <div className="border border-gray-300 bg-white rounded-sm w-[500px] shadow-sm">
                    <div className="overflow-x-hidden">
                      <table className="w-full text-[11px] table-fixed">
                        <thead>
                          <tr className="bg-white border-b border-gray-300">
                            {[
                              "Order No.",
                              "Order Date",
                              "Doc No.",
                              "Auth By",
                              "Status",
                            ].map((h) => (
                              <th
                                key={h}
                                className="px-2 py-1 text-left font-medium text-gray-700 border-r border-gray-300 last:border-r-0 break-words"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-2 py-1">
                              {purchaseOrder || "—"}
                            </td>
                            <td className="px-2 py-1">—</td>
                            <td className="px-2 py-1">INV/1249</td>
                            <td className="px-2 py-1">Pradip</td>
                            <td className="px-2 py-1">Open</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="px-2 py-1 text-[10px] text-gray-600 flex justify-between">
                      <span>1 / 1</span>
                      <span>⟨ ⟩</span>
                    </div>
                  </div>
                </div>
              )}

              {/* SCAN BARCODE */}
              <div className="mt-4 grid grid-cols-12 gap-4 items-center">
                <div className="col-span-12 md:col-span-3 text-gray-600 text-[12px]">
                  Scan Barcode
                </div>
                <div className="col-span-12 md:col-span-9">
                  <input
                    type="text"
                    value={scanBarcode}
                    onChange={(e) => setScanBarcode(e.target.value)}
                    placeholder="Scan / Enter barcode"
                    className="w-full h-7 border border-gray-200 bg-white px-2 rounded-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ITEM INFORMATION */}
          <div className="border border-gray-200 rounded-sm bg-white overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-200 bg-white flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-gray-700">
                Item Information
              </h3>
              <button className="text-gray-400 hover:text-gray-600">▾</button>
            </div>

            <div className="p-0 overflow-x-auto">
              <div className="min-w-[920px]">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-white border-b border-gray-200 text-gray-700">
                      {[
                        "Order No.",
                        "Valid Upto",
                        "Tolerance %",
                        "Item Description",
                        "Batch/Serial",
                        "Rate",
                        "Per",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 font-medium text-left whitespace-nowrap border-r border-gray-200 last:border-r-0"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="h-[260px] text-center text-gray-500"
                        >
                          Loading items...
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="h-[260px] text-center text-red-500"
                        >
                          {error}
                        </td>
                      </tr>
                    ) : filteredRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="h-[260px] bg-white text-gray-400 px-3 text-center"
                        >
                          No items found
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((r, idx) => (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="px-3 py-2">{r.orderNo}</td>
                          <td className="px-3 py-2">{r.validUpto}</td>
                          <td className="px-3 py-2">{r.tolerance}</td>
                          <td className="px-3 py-2">{r.itemDesc}</td>
                          <td className="px-3 py-2">{r.batchSerial}</td>
                          <td className="px-3 py-2">{r.rate}</td>
                          <td className="px-3 py-2">{r.per}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-3 py-2 border-t border-gray-200 bg-white text-[12px] text-gray-600">
              Record Count:{" "}
              <span className="font-semibold">{filteredRows.length}</span>
            </div>
          </div>

          {/* FOOTER BAR */}
          <div className="px-2 py-2 border border-gray-200 bg-[#fafafa] rounded-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPurchaseOrder("");
                  setScanBarcode("");
                  setCriteria({ orderNo: "", itemDesc: "", batchSerial: "" });
                }}
                className="h-7 px-4 bg-[#efefef] border border-gray-200 rounded-sm text-[12px] hover:bg-[#e9e9e9]"
              >
                Clear
              </button>

              <button
                type="button"
                className="h-7 px-4 bg-[#efefef] border border-gray-200 rounded-sm text-[12px] hover:bg-[#e9e9e9]"
              >
                Receive all Pending Qty.
              </button>
            </div>

            <div className="flex items-center gap-2">
             <button
  type="button"
  onClick={() => {
    const filtered = purchaseOrder
      ? filteredRows.filter((r) => r.orderNo === purchaseOrder)
      : filteredRows;
    handlePopulateOrderMode(filtered);
  }}
  className="h-7 px-6 bg-[#efefef] border border-gray-200 rounded-sm text-[12px] hover:bg-[#e9e9e9]"
>
  Populate
</button>

              <button
                type="button"
                onClick={() => setShowOrderMode(false)}
                className="h-7 px-6 bg-[#efefef] border border-gray-200 rounded-sm text-[12px] hover:bg-[#e9e9e9]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderMode;
