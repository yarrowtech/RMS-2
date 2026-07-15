import React, { useState, useMemo } from "react";
import {
  Receipt,
  AlertTriangle,
  Check,
  X,
  FileText,
  Download,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "react-hot-toast";

// â”€â”€ Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

function KPICard({ title, value, icon, color, iconColor }) {
  return (
    <div className={`relative min-h-[85px] bg-white rounded-xl p-3.5 flex flex-col justify-between overflow-hidden shadow-sm border border-slate-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-pointer`}>
      <div className="flex items-center justify-between gap-3 relative z-10">
        <p className="text-sm font-bold text-black uppercase tracking-wider">
          {title}
        </p>
        <div className={`rounded-md p-1.5 shadow-sm ${iconColor}`}>{icon}</div>
      </div>
      <h3 className="mt-2 break-words text-2xl font-black text-black leading-tight relative z-10">{value}</h3>
    </div>
  );
}

function SectionCard({ title, badge, children }) {
  return (
    <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all duration-300 min-w-0">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {badge && (
          <span className="rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
            {badge}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function FinanceTaxGst() {
  // Government GST Payments state
  const [paymentsList, setPaymentsList] = useState([]);

  // Record Payment Modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");

  const totalCollected = 0; // Will be derived from actual data
  const totalPaid = useMemo(() => paymentsList.reduce((s, p) => s + p.amount, 0), [paymentsList]);
  const outstandingLiability = Math.max(0, totalCollected - totalPaid);
  const lastPaymentAmount = paymentsList.length > 0 ? paymentsList[0].amount : 0;

  const handleGeneratePDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageW = 595;

    // â”€â”€ Dark header banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 90, "F");

    // Accent stripe
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 90, pageW, 6, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.text("RMS GST & TAX HUB REPORT", 40, 50);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Financial Management Department | Government Remittances", 40, 70);

    // Generated date right-aligned
    doc.setFontSize(8.5);
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, pageW - 40, 70, { align: "right" });

    // â”€â”€ Meta row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const metaY = 115;
    doc.setTextColor(51, 65, 85);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Audit Period:", 40, metaY);
    doc.setFont("helvetica", "normal");
    doc.text("Jan 2026 â€“ May 2026", 110, metaY);

    doc.setFont("helvetica", "bold");
    doc.text("Tax Office:", 240, metaY);
    doc.setFont("helvetica", "normal");
    doc.text("State GST Authority", 300, metaY);

    // â”€â”€ Summary KPI boxes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const boxes = [
      { label: "Total Collected", value: fmt(totalCollected), color: [238, 242, 255] },
      { label: "Paid to Gov", value: fmt(totalPaid), color: [236, 253, 245] },
      { label: "Liability", value: fmt(outstandingLiability), color: [255, 251, 235] },
      { label: "Last Payment", value: fmt(lastPaymentAmount), color: [245, 243, 255] },
    ];
    const boxW = 126, boxH = 52, boxY = 135, boxGap = 8;
    boxes.forEach((b, i) => {
      const bx = 40 + i * (boxW + boxGap);
      doc.setFillColor(...b.color);
      doc.roundedRect(bx, boxY, boxW, boxH, 5, 5, "F");
      doc.setDrawColor(210, 214, 220);
      doc.roundedRect(bx, boxY, boxW, boxH, 5, 5, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(b.label.toUpperCase(), bx + 8, boxY + 16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      // Replace ₹ with Rs. for helvetica font compatibility
      const valStr = b.value.replace("₹", "Rs.");
      doc.text(valStr, bx + 8, boxY + 36);
    });

    // â”€â”€ Section title â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text("GOVERNMENT GST PAYMENT LEDGER", 40, 210);
    doc.setDrawColor(203, 213, 225);
    doc.line(40, 215, pageW - 40, 215);

    // â”€â”€ Main table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const tableData = paymentsList.map((row) => [
      row.date,
      row.refNo,
      `Rs.${row.amount.toLocaleString("en-IN")}`
    ]);

    autoTable(doc, {
      startY: 223,
      head: [["Payment Date", "Challan / Ref #", "Paid Amount"]],
      body: tableData,
      theme: "grid",
      headStyles: {
        fillColor: [30, 27, 75],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
        halign: "left",
      },
      bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: "normal" },
        1: { fontStyle: "normal" },
        2: { halign: "right", fontStyle: "bold", textColor: [30, 27, 75] },
      },
      margin: { left: 40, right: 40 },
    });

    // â”€â”€ Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const finalY = doc.lastAutoTable.finalY + 20;
    doc.setFillColor(248, 250, 252);
    doc.rect(40, finalY, pageW - 80, 50, "F");
    doc.setDrawColor(226, 232, 240);
    doc.rect(40, finalY, pageW - 80, 50, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text("IMPORTANT NOTICE", 50, finalY + 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("This report is a dynamic ledger representation of recorded government remittances. Maintain official challans", 50, finalY + 30);
    doc.text("issued by the GST portal for statutory filing and external compliance audits.", 50, finalY + 40);

    // Save PDF
    doc.save("GST_Tax_Remittance_Report.pdf");
    toast.success("GST report successfully exported to PDF!");
  };

  const handleRecordPayment = () => {
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid payment amount.");
      return;
    }

    const randomRef = "GST-REF-" + Math.floor(100000 + Math.random() * 900000);

    const newPayment = {
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      refNo: randomRef,
      amount: amt,
    };

    setPaymentsList((prev) => [newPayment, ...prev]);
    setShowPaymentModal(false);
    setPayAmount("");
    toast.success(`Successfully recorded GST Payment of ${fmt(amt)} to the Government!`);
  };

  return (
    <div className="min-h-full bg-transparent p-4 lg:p-6 font-sans text-slate-900 flex flex-col gap-6">
      <div className="mx-auto w-full max-w-[1750px] space-y-6 min-w-0">

        {/* â”€â”€ Header â”€â”€ */}
        <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-2xl p-5 shadow-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
              <Receipt size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black text-black tracking-tight">GST & Tax Hub</h1>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleGeneratePDF}
              className="flex items-center gap-2 rounded-xl border border-slate-200 hover:bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 transition shadow-sm cursor-pointer"
            >
              <Download size={16} />
              Download PDF Report
            </button>
            <button
              onClick={() => setShowPaymentModal(true)}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white transition shadow-md cursor-pointer"
            >
              <FileText size={16} />
              Record GST Payment
            </button>
          </div>
        </div>

        {/* â”€â”€ 4 KPI Cards â”€â”€ */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KPICard title="Total GST Collected" value={fmt(totalCollected)} icon={<Receipt size={16} />} color="bg-indigo-950/95 border-indigo-400 shadow-indigo-950/80" iconColor="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" />
          <KPICard title="GST Paid to Government" value={fmt(totalPaid)} icon={<Check size={16} />} color="bg-emerald-950/95 border-emerald-400 shadow-emerald-950/80" iconColor="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" />
          <KPICard title="Outstanding Tax Liability" value={fmt(outstandingLiability)} icon={<AlertTriangle size={16} />} color="bg-rose-950/95 border-rose-400 shadow-rose-950/80" iconColor="bg-rose-500/10 text-rose-400 border border-rose-500/20" />
          <KPICard title="Last Tax Payment" value={fmt(lastPaymentAmount)} icon={<Receipt size={16} />} color="bg-amber-950/95 border-amber-400 shadow-amber-950/80" iconColor="bg-amber-500/10 text-amber-400 border border-amber-500/20" />
        </div>

        {/* â”€â”€ Main Grid â”€â”€ */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* Left â€” Government GST Payment History */}
          <div className="lg:col-span-2 space-y-6">
            <SectionCard title="Government GST Payment History" badge="Tax Remittance">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto pr-1">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold sticky top-0 z-10">
                      <th className="py-2.5 px-4 font-bold bg-slate-50">Payment Date</th>
                      <th className="py-2.5 px-4 font-bold bg-slate-50">Challan / Ref #</th>
                      <th className="py-2.5 px-4 text-right font-bold bg-slate-50">Paid Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {paymentsList.length > 0 ? (
                      paymentsList.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50/75 transition-colors duration-150">
                          <td className="py-3 px-4 text-slate-500 font-semibold text-xs">{row.date}</td>
                          <td className="py-3 px-4 font-mono text-xs text-slate-600">{row.refNo}</td>
                          <td className="py-3 px-4 text-right font-black text-emerald-600">{fmt(row.amount)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" className="py-8 text-center text-sm font-semibold text-slate-400">
                          No government tax payments recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>

          {/* Right â€” Tax Composition */}
          <div className="space-y-6">
            <SectionCard title="Tax Composition" badge="Ledger Share">
              <div className="space-y-4 py-1">
                {[
                  { label: "CGST", value: 45, color: "bg-slate-900" },
                  { label: "SGST", value: 45, color: "bg-slate-700" },
                  { label: "IGST", value: 10, color: "bg-indigo-600" },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      <span>{item.label}</span>
                      <span className="text-slate-900">{item.value}%</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200">
                      <div className={`h-full ${item.color} rounded-full transition-all duration-700`} style={{ width: `${item.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

        </div>
      </div>

      {/* â”€â”€ Record Government GST Payment Modal â”€â”€ */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 transition cursor-pointer"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
              <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Record GST Payment</h3>
                <p className="text-xs text-slate-500">Record tax remittance paid to the Government.</p>
              </div>
            </div>

            <div className="space-y-4 text-sm">
              {/* Payment Amount input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Payment Amount (₹)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm font-semibold text-slate-800"
                    min="0"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 hover:bg-slate-50 py-2.5 text-sm font-bold text-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRecordPayment}
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 py-2.5 text-sm font-bold text-white transition shadow-md cursor-pointer"
                >
                  Confirm Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


