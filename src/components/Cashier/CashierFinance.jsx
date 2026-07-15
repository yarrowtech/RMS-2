import React, { useMemo, useState } from "react";
import {
  FaMoneyBillWave,
  FaWallet,
  FaExchangeAlt,
  FaChartLine,
  FaSearch,
  FaCreditCard,
  FaMobileAlt,
  FaCalendarAlt,
  FaReceipt,
} from "react-icons/fa";

function formatMoney(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function CashierFinance({ transactions = [] }) {
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");

  const normalizePayment = (payment) =>
    String(payment || "").toLowerCase().trim();

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const text = search.trim().toLowerCase();
      const txDate = tx.date
        ? new Date(tx.date).toISOString().slice(0, 10)
        : "";
      const payment = normalizePayment(tx.payment);

      const matchesSearch =
        !text ||
        String(tx.id || "").toLowerCase().includes(text) ||
        String(tx.customer || "").toLowerCase().includes(text) ||
        String(tx.phone || "").toLowerCase().includes(text) ||
        String(tx.payment || "").toLowerCase().includes(text) ||
        String(tx.type || "").toLowerCase().includes(text);

      const matchesFrom = !fromDate || (txDate && txDate >= fromDate);
      const matchesTo = !toDate || (txDate && txDate <= toDate);
      const matchesPayment =
        paymentFilter === "all" || payment === paymentFilter;

      return matchesSearch && matchesFrom && matchesTo && matchesPayment;
    });
  }, [transactions, search, fromDate, toDate, paymentFilter]);

  const finance = useMemo(() => {
    let totalSales = 0;
    let totalReturns = 0;
    let cashSales = 0;
    let upiSales = 0;
    let cardSales = 0;
    let totalBills = 0;
    let returnBills = 0;

    filteredTransactions.forEach((tx) => {
      const amount = Number(tx.grandTotal || tx.amount || 0);
      const refund = Number(tx.refundAmount || tx.grandTotal || tx.amount || 0);
      const payment = normalizePayment(tx.payment);
      const type = String(tx.type || "sale").toLowerCase();

      if (type === "sale") {
        totalSales += amount;
        totalBills += 1;

        if (payment === "cash") cashSales += amount;
        if (payment === "upi") upiSales += amount;
        if (payment === "card") cardSales += amount;
      }

      if (type === "return") {
        totalReturns += refund;
        returnBills += 1;
      }
    });

    return {
      totalSales,
      totalReturns,
      cashSales,
      upiSales,
      cardSales,
      totalBills,
      returnBills,
      netRevenue: totalSales - totalReturns,
    };
  }, [filteredTransactions]);

  const paymentSummary = useMemo(() => {
    const map = new Map();

    filteredTransactions.forEach((tx) => {
      const payment = tx.payment || "Unknown";
      const type = String(tx.type || "sale").toLowerCase();
      const amount = Number(tx.grandTotal || tx.amount || 0);
      const refund = Number(tx.refundAmount || tx.grandTotal || tx.amount || 0);

      if (!map.has(payment)) {
        map.set(payment, {
          payment,
          sales: 0,
          returns: 0,
          count: 0,
          net: 0,
        });
      }

      const row = map.get(payment);
      row.count += 1;

      if (type === "sale") row.sales += amount;
      if (type === "return") row.returns += refund;

      row.net = row.sales - row.returns;
    });

    return Array.from(map.values()).sort((a, b) => b.net - a.net);
  }, [filteredTransactions]);

  const dailySummary = useMemo(() => {
    const map = new Map();

    filteredTransactions.forEach((tx) => {
      const dateKey = tx.date
        ? new Date(tx.date).toISOString().slice(0, 10)
        : "Unknown";

      const type = String(tx.type || "sale").toLowerCase();
      const amount = Number(tx.grandTotal || tx.amount || 0);
      const refund = Number(tx.refundAmount || tx.grandTotal || tx.amount || 0);

      if (!map.has(dateKey)) {
        map.set(dateKey, {
          date: dateKey,
          sales: 0,
          returns: 0,
          net: 0,
          bills: 0,
          returnsCount: 0,
        });
      }

      const row = map.get(dateKey);

      if (type === "sale") {
        row.sales += amount;
        row.bills += 1;
      }

      if (type === "return") {
        row.returns += refund;
        row.returnsCount += 1;
      }

      row.net = row.sales - row.returns;
    });

    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredTransactions]);

  const filterBtn = (value) =>
    `rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
      paymentFilter === value
        ? "border-blue-600 bg-blue-600 text-white shadow-sm"
        : "border-blue-200 bg-white text-black hover:bg-blue-50"
    }`;

  const KPICard = ({ title, amount, icon, color }) => {
    return (
      <div className={`rounded-xl p-4 text-white shadow-md ${color}`}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold tracking-wide text-white/85">
            {title}
          </p>
          <div className="rounded-lg bg-white/15 p-2 text-white">{icon}</div>
        </div>
        <h3 className="mt-4 break-words text-xl font-bold">{amount}</h3>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-5 lg:p-6">
      <div className="mx-auto max-w-[1650px] space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-black">
                  Cashier Finance
                </h1>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search bill, customer, phone, payment"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-black outline-none focus:border-blue-500"
                  />
                </div>

                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-black outline-none focus:border-blue-500"
                />

                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-black outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setPaymentFilter("all")}
                className={filterBtn("all")}
              >
                All Payment
              </button>
              <button
                type="button"
                onClick={() => setPaymentFilter("cash")}
                className={filterBtn("cash")}
              >
                Cash
              </button>
              <button
                type="button"
                onClick={() => setPaymentFilter("upi")}
                className={filterBtn("upi")}
              >
                UPI
              </button>
              <button
                type="button"
                onClick={() => setPaymentFilter("card")}
                className={filterBtn("card")}
              >
                Card
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
          <KPICard
            title="Total Sales"
            amount={formatMoney(finance.totalSales)}
            icon={<FaChartLine size={16} />}
            color="bg-gradient-to-r from-emerald-700 to-emerald-600"
          />

          <KPICard
            title="Cash"
            amount={formatMoney(finance.cashSales)}
            icon={<FaMoneyBillWave size={16} />}
            color="bg-gradient-to-r from-blue-700 to-blue-600"
          />

          <KPICard
            title="UPI"
            amount={formatMoney(finance.upiSales)}
            icon={<FaMobileAlt size={16} />}
            color="bg-gradient-to-r from-violet-700 to-violet-600"
          />

          <KPICard
            title="Card"
            amount={formatMoney(finance.cardSales)}
            icon={<FaCreditCard size={16} />}
            color="bg-gradient-to-r from-amber-700 to-amber-600"
          />

          <KPICard
            title="Returns"
            amount={formatMoney(finance.totalReturns)}
            icon={<FaExchangeAlt size={16} />}
            color="bg-gradient-to-r from-rose-700 to-rose-600"
          />

          <KPICard
            title="Net"
            amount={formatMoney(finance.netRevenue)}
            icon={<FaWallet size={16} />}
            color="bg-gradient-to-r from-slate-800 to-slate-700"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
                  <FaWallet size={14} />
                </div>
                <h2 className="text-lg font-bold text-black">
                  Payment Summary
                </h2>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-black">
                Payment Wise
              </span>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-full">
                <div className="grid grid-cols-5 border-b border-slate-300 bg-slate-100 text-sm font-bold text-black">
                  <div className="px-4 py-3">Payment</div>
                  <div className="px-4 py-3">Count</div>
                  <div className="px-4 py-3">Sales</div>
                  <div className="px-4 py-3">Returns</div>
                  <div className="px-4 py-3">Net</div>
                </div>

                <div className="max-h-[300px] overflow-y-auto text-sm">
                  {paymentSummary.length === 0 ? (
                    <div className="flex h-24 items-center justify-center text-slate-500">
                      No payment summary available.
                    </div>
                  ) : (
                    paymentSummary.map((row, index) => (
                      <div
                        key={`${row.payment}-${index}`}
                        className="grid grid-cols-5 border-b border-slate-200 bg-white"
                      >
                        <div className="break-words px-4 py-3 font-semibold text-black">
                          {row.payment}
                        </div>
                        <div className="px-4 py-3 text-slate-700">{row.count}</div>
                        <div className="break-words px-4 py-3 font-semibold text-black">
                          {formatMoney(row.sales)}
                        </div>
                        <div className="break-words px-4 py-3 font-semibold text-rose-600">
                          {formatMoney(row.returns)}
                        </div>
                        <div className="break-words px-4 py-3 font-semibold text-blue-700">
                          {formatMoney(row.net)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
                  <FaCalendarAlt size={14} />
                </div>
                <h2 className="text-lg font-bold text-black">
                  Daily Summary
                </h2>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-black">
                Date Wise
              </span>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-full">
                <div className="grid grid-cols-6 border-b border-slate-300 bg-slate-100 text-sm font-bold text-black">
                  <div className="px-4 py-3">Date</div>
                  <div className="px-4 py-3">Bills</div>
                  <div className="px-4 py-3">Returns</div>
                  <div className="px-4 py-3">Sales</div>
                  <div className="px-4 py-3">Return Amt</div>
                  <div className="px-4 py-3">Net</div>
                </div>

                <div className="max-h-[300px] overflow-y-auto text-sm">
                  {dailySummary.length === 0 ? (
                    <div className="flex h-24 items-center justify-center text-slate-500">
                      No daily summary available.
                    </div>
                  ) : (
                    dailySummary.map((day) => (
                      <div
                        key={day.date}
                        className="grid grid-cols-6 border-b border-slate-200 bg-white"
                      >
                        <div className="px-4 py-3 font-semibold text-black">
                          {formatDate(day.date)}
                        </div>
                        <div className="px-4 py-3 text-slate-700">{day.bills}</div>
                        <div className="px-4 py-3 text-slate-700">
                          {day.returnsCount}
                        </div>
                        <div className="break-words px-4 py-3 font-semibold text-black">
                          {formatMoney(day.sales)}
                        </div>
                        <div className="break-words px-4 py-3 font-semibold text-rose-600">
                          {formatMoney(day.returns)}
                        </div>
                        <div className="break-words px-4 py-3 font-semibold text-blue-700">
                          {formatMoney(day.net)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
                <FaReceipt size={14} />
              </div>
              <h2 className="text-lg font-bold text-black">
                Recent Finance Transactions
              </h2>
            </div>

            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Bills: {finance.totalBills} | Returns: {finance.returnBills} | Net:{" "}
              {formatMoney(finance.netRevenue)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[920px]">
              <div className="grid grid-cols-8 border-b border-slate-300 bg-slate-100 text-sm font-bold text-black">
                <div className="px-4 py-3">Bill No</div>
                <div className="px-4 py-3">Customer</div>
                <div className="px-4 py-3">Phone</div>
                <div className="px-4 py-3">Type</div>
                <div className="px-4 py-3">Payment</div>
                <div className="px-4 py-3">Date</div>
                <div className="px-4 py-3">Amount</div>
                <div className="px-4 py-3">Status</div>
              </div>

              <div className="max-h-[420px] overflow-y-auto text-sm">
                {filteredTransactions.length === 0 ? (
                  <div className="flex h-32 items-center justify-center bg-white text-slate-500">
                    No finance records found.
                  </div>
                ) : (
                  filteredTransactions.map((tx, index) => {
                    const type = String(tx.type || "sale").toLowerCase();
                    const amount =
                      type === "return"
                        ? Number(tx.refundAmount || tx.grandTotal || tx.amount || 0)
                        : Number(tx.grandTotal || tx.amount || 0);

                    return (
                      <div
                        key={tx.id || index}
                        className="grid grid-cols-8 border-b border-slate-200 bg-white"
                      >
                        <div className="break-words px-4 py-3 text-black">
                          {tx.id || "—"}
                        </div>

                        <div className="break-words px-4 py-3 text-black">
                          {tx.customer || "Walk-in Customer"}
                        </div>

                        <div className="break-words px-4 py-3 text-slate-700">
                          {tx.phone || "—"}
                        </div>

                        <div className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              type === "sale"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {type === "sale" ? "Sale" : "Return"}
                          </span>
                        </div>

                        <div className="break-words px-4 py-3 text-slate-700">
                          {tx.payment || "Unknown"}
                        </div>

                        <div className="px-4 py-3 text-slate-700">
                          {formatDate(tx.date)}
                        </div>

                        <div
                          className={`px-4 py-3 font-semibold ${
                            type === "sale" ? "text-black" : "text-rose-600"
                          }`}
                        >
                          {formatMoney(amount)}
                        </div>

                        <div className="px-4 py-3">
                          <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            Completed
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}