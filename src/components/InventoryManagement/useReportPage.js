import { useEffect, useState } from "react";

export default function useReportPage(rows, pageSize = 100) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  return { page: currentPage, totalPages, setPage, visibleRows: rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize) };
}

export function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
