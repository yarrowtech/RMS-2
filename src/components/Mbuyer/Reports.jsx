import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export default function Reports() {
  const monthlyReportValue = [
    { month: "Jan", value: 120000 },
    { month: "Feb", value: 185000 },
    { month: "Mar", value: 245000 },
    { month: "Apr", value: 198000 },
    { month: "May", value: 276000 },
    { month: "Jun", value: 221000 },
  ];

  const reportCategoryAnalytics = [
    { name: "Purchase", value: 48 },
    { name: "Invoice", value: 41 },
    { name: "Cancel", value: 9 },
  ];

  const taskListGraph = [
    { name: "Completed", value: 42 },
    { name: "Under Process", value: 15 },
    { name: "On Hold For Approval", value: 18 },
    { name: "Pending", value: 25 },
  ];

  const approvalVendorListGraph = [
    { name: "Vendor A", value: 12 },
    { name: "Vendor B", value: 18 },
    { name: "Vendor C", value: 10 },
    { name: "Vendor D", value: 15 },
  ];

  // ❌ Removed "Rejected"
  const pendingVendorApprovalGraph = [
    { name: "Pending", value: 14 },
    { name: "Approved", value: 36 },
  ];

  const COLORS = ["#2563eb", "#059669", "#f59e0b", "#7c3aed"];

  return (
    <div className="min-h-screen bg-slate-200 p-4 md:p-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
            Reports Analytics
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Monthly Report */}
          <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
            <h3 className="mb-5 text-lg font-bold text-slate-900">
              Monthly Report Value
            </h3>

            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyReportValue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => [
                      `₹${value.toLocaleString("en-IN")}`,
                      "Value",
                    ]}
                  />
                  <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Analytics */}
          <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
            <h3 className="mb-5 text-lg font-bold text-slate-900">
         Order Analytics
            </h3>

            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reportCategoryAnalytics}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={110}
                    label
                  >
                    {reportCategoryAnalytics.map((entry, index) => (
                      <Cell key={index} fill={COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Task Graph */}
          <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
            <h3 className="mb-5 text-lg font-bold text-slate-900">
              Task List Graph
            </h3>

            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskListGraph}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={110}
                    label
                  >
                    {taskListGraph.map((entry, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Approved Vendors */}
          <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
            <h3 className="mb-5 text-lg font-bold text-slate-900">
              Approval Vendor List Graph
            </h3>

            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={approvalVendorListGraph}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Vendor Approval Status */}
          <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm xl:col-span-2">
            <h3 className="mb-5 text-lg font-bold text-slate-900">
              Vendor Approval vs Pending Status
            </h3>

            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pendingVendorApprovalGraph}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={120}
                    label
                  >
                    {pendingVendorApprovalGraph.map((entry, index) => (
                      <Cell key={index} fill={COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}