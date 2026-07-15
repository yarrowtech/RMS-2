import React, { useMemo, useState } from "react";
import {
  FaCheckCircle,
  FaClock,
  FaCommentDots,
  FaFileAlt,
  FaTimesCircle,
  FaUserShield,
} from "react-icons/fa";

const cn = (...a) => a.filter(Boolean).join(" ");

const STAGES = ["Planner", "Manager", "Finance"];

const STATUS_META = {
  DRAFT: {
    label: "Draft",
    icon: FaFileAlt,
    cls: "bg-slate-100 text-slate-700 border-slate-200",
  },
  SUBMITTED: {
    label: "Submitted",
    icon: FaClock,
    cls: "bg-blue-50 text-blue-700 border-blue-200",
  },
  APPROVED: {
    label: "Approved",
    icon: FaCheckCircle,
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  REJECTED: {
    label: "Rejected",
    icon: FaTimesCircle,
    cls: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

function nowStamp() {
  const d = new Date();
  return d.toLocaleString();
}

function StepPill({ active, done, label }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
        done
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : active
          ? "bg-blue-50 text-blue-700 border-blue-200"
          : "bg-slate-50 text-black-600 border-slate-200"
      )}
    >
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full",
          done ? "bg-emerald-500" : active ? "bg-blue-500" : "bg-slate-300"
        )}
      />
      {label}
    </div>
  );
}

function Badge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.DRAFT;
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        meta.cls
      )}
    >
      <Icon className="opacity-80" />
      {meta.label}
    </span>
  );
}

function getRoleFromSession() {
  const raw =
    localStorage.getItem("role") ||
    localStorage.getItem("userRole") ||
    localStorage.getItem("RMS_ROLE") ||
    "";

  const role = String(raw || "").trim().toLowerCase();
  if (role.includes("planner")) return "Planner";
  if (role.includes("manager")) return "Manager";
  if (role.includes("finance") || role.includes("account")) return "Finance";

  return "Planner";
}

export default function StockPlanForecastingForecastApproval() {
  const currentRole = useMemo(() => getRoleFromSession(), []);
  const [status, setStatus] = useState("DRAFT"); 
  const [currentStageIndex, setCurrentStageIndex] = useState(0); 
  const [comment, setComment] = useState("");
  const [audit, setAudit] = useState([
    {
      at: nowStamp(),
      by: "System",
      action: "Created workflow",
      note: "Initial draft created",
    },
  ]);

  const stage = STAGES[currentStageIndex];

  const canSubmit = useMemo(
    () => status === "DRAFT" && currentRole === "Planner",
    [status, currentRole]
  );

  const canApprove = useMemo(() => {
    if (status !== "SUBMITTED") return false;
    return currentRole === stage; 
  }, [status, currentRole, stage]);

  const canReject = canApprove;

  const addAudit = (by, action, note = "") => {
    setAudit((prev) => [
      {
        at: nowStamp(),
        by,
        action,
        note,
      },
      ...prev,
    ]);
  };

  const onSubmit = () => {
    if (!canSubmit) return;
    setStatus("SUBMITTED");
    setCurrentStageIndex(1); 
    addAudit(
      "Planner",
      "Submitted",
      comment?.trim() ? comment.trim() : "Submitted for approval"
    );
    setComment("");
  };

  const onApprove = () => {
    if (!canApprove) return;

    if (currentStageIndex < STAGES.length - 1) {
      const next = currentStageIndex + 1;
      setCurrentStageIndex(next);
      addAudit(
        currentRole,
        "Approved",
        comment?.trim()
          ? comment.trim()
          : `Approved and forwarded to ${STAGES[next]}`
      );
      setComment("");
      setStatus("SUBMITTED");
    } else {
      setStatus("APPROVED");
      addAudit(
        "Finance",
        "Final Approved",
        comment?.trim() ? comment.trim() : "Approved (final)"
      );
      setComment("");
    }
  };

  const onReject = () => {
    if (!canReject) return;
    setStatus("REJECTED");
    addAudit(
      currentRole,
      "Rejected",
      comment?.trim() ? comment.trim() : "Rejected"
    );
    setComment("");
  };

  const onResetToDraft = () => {
    setStatus("DRAFT");
    setCurrentStageIndex(0);
    addAudit(currentRole, "Reset to Draft", "Workflow returned to draft");
    setComment("");
  };

  return (
    <div className="p-6">
      <div className="rounded-3xl border border-[#0b68da] bg-white/90 backdrop-blur-xl shadow-[0_18px_50px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className="px-6 py-5 border-b border-[#0f6de7] flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-bold text-black-700">
              Forecast Approval Workflow
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge status={status} />
            <span className="text-xs text-black-500">
              Current stage:{" "}
              <span className="font-semibold text-black-800">
                {status === "DRAFT"
                  ? "Planner "
                  : status === "APPROVED"
                  ? "Completed"
                  : stage}
              </span>
            </span>
          </div>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {STAGES.map((s, idx) => (
                <StepPill
                  key={s}
                  label={s}
                  done={status === "APPROVED" ? true : idx < currentStageIndex}
                  active={
                    status !== "APPROVED" &&
                    status !== "REJECTED" &&
                    idx === currentStageIndex &&
                    status !== "DRAFT"
                  }
                />
              ))}
              {status === "DRAFT" && <StepPill label="Draft" active done={false} />}
              {status === "REJECTED" && (
                <StepPill label="Rejected" active done={false} />
              )}
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-[#0875fa] bg-white px-3 py-2">
              <FaUserShield className="text-black-700" />
              <span className="text-xs text-black-600 font-semibold">
                Your role:
              </span>
              <span className="text-sm font-bold text-black-600">
                {currentRole}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-2xl border border-[#1574e9] bg-white p-4">
              <div className="flex items-center gap-2 mb-2">
                <FaCommentDots className="text-black-700" />
                <p className="text-sm font-semibold text-black-700">Comments</p>
              </div>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                placeholder="Add comment (optional)…"
                className="w-full rounded-xl border border-[#0971f0] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="rounded-2xl border border-[#076eec] bg-white p-4 flex flex-col gap-3">
              <p className="text-sm font-semibold text-black-600">Actions</p>

              <button
                onClick={onSubmit}
                disabled={!canSubmit}
                className={cn(
                  "w-full rounded-xl px-4 py-2.5 text-sm font-bold transition",
                  canSubmit
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-black-100 text-black-400 cursor-not-allowed"
                )}
              >
                Submit (Planner → Manager)
              </button>

              <button
                onClick={onApprove}
                disabled={!canApprove || status === "APPROVED" || status === "REJECTED"}
                className={cn(
                  "w-full rounded-xl px-4 py-2.5 text-sm font-bold transition",
                  canApprove
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-black-100 text-black-400 cursor-not-allowed"
                )}
              >
                Approve
              </button>

              <button
                onClick={onReject}
                disabled={!canReject || status === "APPROVED" || status === "REJECTED"}
                className={cn(
                  "w-full rounded-xl px-4 py-2.5 text-sm font-bold transition",
                  canReject
                    ? "bg-rose-600 text-white hover:bg-rose-700"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                )}
              >
                Reject
              </button>

              <button
                onClick={onResetToDraft}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-bold border border-[#D6DEE8] bg-white hover:bg-slate-50 transition"
              >
                Reset to Draft
              </button>

              <div className="text-xs text-slate-600 mt-2 leading-relaxed">
                <div>
                  <span className="font-semibold">Rule:</span> Only the current
                  stage role can approve/reject.
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-500 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1270eb] flex items-center justify-between">
              <p className="text-sm font-semibold text-black-700">Audit Trail</p>
              <span className="text-xs text-slate-500">
                {audit.length} record(s)
              </span>
            </div>

            <div className="max-h-[360px] overflow-y-auto">
              {audit.map((row, i) => (
                <div key={i} className="px-4 py-3 border-b border-blue-500">
                  <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
                    <p className="text-sm font-semibold text-slate-900">
                      {row.action}{" "}
                      <span className="text-xs font-normal text-slate-500">
                        by{" "}
                        <span className="font-semibold text-slate-700">
                          {row.by}
                        </span>
                      </span>
                    </p>
                    <span className="text-xs text-slate-500">{row.at}</span>
                  </div>
                  {row.note ? (
                    <p className="text-sm text-slate-700 mt-1">{row.note}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#106ee0] bg-white p-4">
            <p className="text-sm font-semibold text-slate-900 mb-2">
              Status Summary
            </p>
            <ul className="text-sm text-slate-700 grid grid-cols-1 lg:grid-cols-2 gap-2">
              <li>
                <span className="font-semibold">Draft:</span> Planner preparing /
                editing.
              </li>
              <li>
                <span className="font-semibold">Submitted:</span> In approval flow
                (Manager → Finance).
              </li>
              <li>
                <span className="font-semibold">Approved:</span> Final approved by
                Finance.
              </li>
              <li>
                <span className="font-semibold">Rejected:</span> Rejected at any
                stage with comment.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
