

import React, { useState } from "react";
import { PlusCircle, XCircle } from "lucide-react";

import PurchesOrder from "./PurchesOrder";
import CancelOrder from "./CancelOrder";

export default function OrderDetails() {
  const [openPurches, setOpenPurches] = useState(true);
  const [openCancel,  setOpenCancel]  = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const closeAll = () => {
    setOpenPurches(false);
    setOpenCancel(false);
  };

  return (
    <div className="w-full space-y-6">

      {/* ================= HEADER ================= */}
      <div className="w-full flex items-center justify-between flex-wrap gap-4 bg-white dark:bg-white p-4 rounded-xl shadow-sm border border-gray-200">

        <h2 className="text-2xl md:text-3xl font-bold text-black dark:text-black">
          Order Details
        </h2>

        <div className="flex flex-wrap items-center gap-3 justify-end">

          <button
            onClick={() => { closeAll(); setOpenPurches(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap shadow-sm"
          >
            <PlusCircle className="h-4 w-4" />
            Purchase Order
          </button>

          <button
            onClick={() => { closeAll(); setOpenCancel(true); }}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap shadow-sm"
          >
            <XCircle className="h-5 w-5" />
            Cancel Order
          </button>

        </div>
      </div>

      {/* ================= CONTENT ================= */}
      <div className="w-full">

        {openPurches && (
          <div className="w-full rounded-xl border border-gray-200 bg-white dark:bg-white p-4 shadow-sm">
            <PurchesOrder
              open={openPurches}
              onClose={() => setOpenPurches(false)}
              selectedOrder={selectedOrder}
            />
          </div>
        )}

        {openCancel && (
          <div className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
            <CancelOrder
              open={openCancel}
              onClose={() => setOpenCancel(false)}
              selectedOrder={selectedOrder}
            />
          </div>
        )}

      </div>
    </div>
  );
}