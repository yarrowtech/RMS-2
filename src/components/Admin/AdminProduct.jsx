import React, { useState } from "react";
import { Package } from "lucide-react";

import ProductList from "../Admin/ProductList";
import AddProduct from "../Admin/AddProduct";
import EditProduct from "../Admin/EditProduct";

export default function AdminProducts() {
  const [activeTab, setActiveTab] = useState("list");
  const [selectedProduct, setSelectedProduct] = useState(null);

  const tabBtn = (active, base, activeCls) =>
    `inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
      active ? activeCls : `${base} text-white hover:brightness-95`
    }`;

  const goList = () => {
    setSelectedProduct(null);
    setActiveTab("list");
  };

  const goAdd = () => {
    setSelectedProduct(null);
    setActiveTab("add");
  };

  const goEdit = () => {
    if (!selectedProduct) {
      setActiveTab("list");
      return;
    }
    setActiveTab("edit");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-100 p-4 shadow-sm md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Products
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={goList}
            className={tabBtn(
              activeTab === "list",
              "bg-blue-500",
              "bg-blue-700 text-white shadow"
            )}
          >
            <Package className="h-4 w-4" />
            Product List
          </button>
        </div>
      </div>

      <div className="min-h-[420px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        {activeTab === "list" && (
          <ProductList
            embedded
            onAddProduct={goAdd}
            onEditProduct={(product) => {
              setSelectedProduct(product);
              setActiveTab("edit");
            }}
          />
        )}

        {activeTab === "add" && (
          <AddProduct
            embedded
            onBackToList={goList}
          />
        )}

        {activeTab === "edit" &&
          (selectedProduct ? (
            <EditProduct
              embedded
              product={selectedProduct}
              onBackToList={goList}
            />
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
              <h3 className="text-lg font-semibold text-slate-800">
                Select a product to edit
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Open Product List and choose the item you want to update.
              </p>
              <button
                onClick={goList}
                className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
              >
                Go to Product List
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}