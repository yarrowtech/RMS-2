import React, { useState } from "react";
import { PlusCircle, FileText, XCircle } from "lucide-react";

//  import your existing popup components
import PurchesOrder from "./PurchesOrder";



export default function OrderDetails() {
  const [openPurches, setOpenPurches] = useState(true);
  const [openInvoice, setOpenInvoice] = useState(false);
  const [openCancel, setOpenCancel] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const closeAll = () => {
    setOpenPurches(false);
    setOpenInvoice(false);
    setOpenCancel(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              closeAll();
              setOpenPurches(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <PlusCircle className="h-5 w-5" />
            Purches Order
          </button>

          <button
            onClick={() => {
              closeAll();
              setOpenInvoice(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <FileText className="h-5 w-5" />
            Invoice Order
          </button>

          <button
            onClick={() => {
              closeAll();
              setOpenCancel(true);
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <XCircle className="h-5 w-5" />
            Cancel Order
          </button>
        </div>
      </div>

      {openPurches && (
        <PurchesOrder
          open={openPurches}
          onClose={() => setOpenPurches(false)}
          selectedOrder={selectedOrder}
        />
      )}

      {openInvoice && (
        <InvoiceOrder
          open={openInvoice}
          onClose={() => setOpenInvoice(false)}
          selectedOrder={selectedOrder}
        />
      )}

      {openCancel && (
        <CancelOrder
          open={openCancel}
          onClose={() => setOpenCancel(false)}
          selectedOrder={selectedOrder}
        />
      )}
    </div>
  );
}
