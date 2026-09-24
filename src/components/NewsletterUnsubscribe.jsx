import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api.js";

// Public, no-login page the unsubscribe link in every newsletter email opens.
// Deliberately requires a button tap (not an automatic call on load) so email
// scanners that pre-open links can't unsubscribe people by accident.
export default function NewsletterUnsubscribe() {
  const { token } = useParams();
  const [state, setState] = useState("idle"); // idle | working | done | error
  const [message, setMessage] = useState("");

  const confirm = async () => {
    setState("working");
    try {
      const response = await fetch(`${API_BASE_URL}/api/customer-crm/newsletter/public/unsubscribe/${token}`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "This unsubscribe link isn't valid.");
      setMessage(data.message);
      setState("done");
    } catch (e) {
      setMessage(e.message || "Something went wrong. Please try again.");
      setState("error");
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-lg">
        <h1 className="text-lg font-bold text-slate-900">Email updates</h1>
        {state === "done" || state === "error" ? (
          <p className={"mt-3 text-sm " + (state === "done" ? "text-emerald-700" : "text-rose-700")}>{message}</p>
        ) : (
          <>
            <p className="mt-3 text-sm text-slate-600">Stop receiving offers and updates by email?</p>
            <button onClick={confirm} disabled={state === "working"} className="mt-5 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
              {state === "working" ? "Working…" : "Yes, unsubscribe me"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
