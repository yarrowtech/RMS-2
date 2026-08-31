import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import TeamUsageAnalytics from "../shared/TeamUsageAnalytics.jsx";

// Same reachability gap as StoreOwnerVerification.jsx: TeamUsageAnalytics
// already works for a single-store owner's admin (scope "hq", tenant_id
// same as any department retailer's HQ admin — the backend endpoints are
// tenant-scoped generically, not HQ-plan-specific), it just previously only
// lived inside AdminSettings.jsx at /admin, which "Store Owner" can't reach.
export default function StoreOwnerUsageAnalytics() {
  const navigate = useNavigate();

  return (
    <main className="min-h-full bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <TeamUsageAnalytics />
      </div>
    </main>
  );
}
