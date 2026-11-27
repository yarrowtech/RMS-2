import { useEffect, useState } from "react";
import { fetchReport } from "./reportUtils.js";

export default function useInventoryReportTaxonomy() {
  const [taxonomy, setTaxonomy] = useState({ divisions: [], sections: [], departments: [] });
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetchReport("/inventory/filter-tree").then((result) => {
      const tree = result.data || {};
      const sections = new Set();
      const departments = new Set();
      Object.values(tree).forEach((branches) => {
        Object.entries(branches || {}).forEach(([section, values]) => {
          sections.add(section);
          (values || []).forEach((value) => departments.add(value));
        });
      });
      if (active) setTaxonomy({ divisions: Object.keys(tree).sort(), sections: [...sections].sort(), departments: [...departments].sort() });
    }).catch((err) => { if (active) setError(err.message || "Could not load filter options."); });
    return () => { active = false; };
  }, []);
  return { ...taxonomy, error };
}
