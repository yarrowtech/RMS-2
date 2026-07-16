import { API_BASE_URL as APP_API_URL } from "../config/api.js";
/**
 * Shared admin authentication and department-routing helpers.
 */

const DEPT_PATH_MAP = {
  "HR":                             "/hr",
  "Cashier":                        "/cashier",
  "Finance":                        "/finance",
  "IT":                             "/admin",
  "Logistics":                      "/logistics",
  "Design & Pattern":               "/design",
  "Inventory":                      "/inventory",
  "Stock Planning & Forecasting":   "/stock",
  "Third Party":                    "/third-party",
  "Production & Job Work":          "/production",
  "Merchandiser Buyer":             "/merchandiser-buyer",
  "Vendor":                         "/merchandiser-seller",
  "Store Owner":                    "/dashboard/store-owner",
};

/**
 * Call this after /auth/login or /auth/set-password succeeds.
 * Saves name + department to localStorage so any dashboard/sidebar
 * can read them without an extra API call.
 *
 * @param {object}   responseData  Full JSON body from the backend
 * @param {function} navigate      react-router navigate()
 */
export function handleAuthRedirect(responseData, navigate) {
  console.log("[authRedirect] response from backend:", responseData);

  const {
    redirect_type,
    redirect_url,
    departments = [],
    routes      = {},
    department  = "",
    name        = "",
    email       = "",
  } = responseData;

  // ── Save admin info so dashboards and sidebars can show it ───────────────
  if (name)  localStorage.setItem("admin_name",  name);
  if (email) localStorage.setItem("admin_email", email);


  // ── Save tenant/scope context ─────────────────────────────────────────────
  // These are used by every module to filter data by tenant and scope.
  // HQ admins see all stores; Store admins see only their store.
  localStorage.setItem("admin_scope",      responseData.scope      || "hq");
  localStorage.setItem("admin_tenant_id",  responseData.tenant_id  || "");
  localStorage.setItem("admin_store_id",   responseData.store_id   || "");
  localStorage.setItem("admin_store_name", responseData.store_name || "");
  localStorage.setItem("admin_store_type", responseData.store_type || "");
  localStorage.setItem("admin_account_type", responseData.account_type || "department_retailer");

  // Keep legacy inventory screens in sync with the CURRENT login. Older
  // components still read `store_id`/`store_name`; leaving those values from
  // a previously logged-in retailer can make a newly logged-in store owner
  // appear to be in the wrong store.
  if (responseData.store_id) {
    localStorage.setItem("store_id", responseData.store_id);
    localStorage.setItem("store_name", responseData.store_name || "");
    localStorage.setItem("store_type", responseData.store_type || "");
  } else {
    localStorage.removeItem("store_id");
    localStorage.removeItem("store_name");
    localStorage.removeItem("store_type");
  }

  // ── CASE 1: Backend returned redirect_type correctly ─────────────────────
  if (departments.length) {
    localStorage.setItem("admin_login_data", JSON.stringify({ name, email, departments, routes }));
  } else {
    localStorage.removeItem("admin_login_data");
  }

  if (redirect_type === "selector") {
    localStorage.removeItem("admin_active_department");
    localStorage.setItem(
      "admin_login_data",
      JSON.stringify({ name, email, departments, routes }),
    );
    navigate("/dashboard/select", {
      replace: true,
      state: { name, email, departments, routes },
    });
    return;
  }

  if (redirect_type === "direct" && redirect_url) {
    const selectedDepartment = departments[0] || department;
    if (selectedDepartment) localStorage.setItem("admin_active_department", selectedDepartment);
    console.log("[authRedirect] direct →", redirect_url);
    navigate(redirect_url, { replace: true });
    return;
  }

  // ── CASE 2: No redirect_type — fallback using departments array ───────────
  if (departments.length > 1) {
    localStorage.removeItem("admin_active_department");
    const builtRoutes = {};
    departments.forEach((d) => { builtRoutes[d] = DEPT_PATH_MAP[d] || "/admin"; });
    localStorage.setItem(
      "admin_login_data",
      JSON.stringify({ name, email, departments, routes: builtRoutes }),
    );
    navigate("/dashboard/select", {
      replace: true,
      state: { name, email, departments, routes: builtRoutes },
    });
    return;
  }

  if (departments.length === 1) {
    localStorage.setItem("admin_active_department", departments[0]);
    const path = DEPT_PATH_MAP[departments[0]] || "/admin";
    console.log("[authRedirect] single dept fallback →", path);
    navigate(path, { replace: true });
    return;
  }

  // ── CASE 3: Only single department string returned ────────────────────────
  if (department) {
    localStorage.setItem("admin_active_department", department);
    const path = DEPT_PATH_MAP[department] || "/admin";
    console.log("[authRedirect] department string fallback →", path);
    navigate(path, { replace: true });
    return;
  }

  // ── CASE 4: Nothing matched ───────────────────────────────────────────────
  console.warn("[authRedirect] Could not determine redirect:", responseData);
  navigate("/admin", { replace: true });
}

// ── Read helpers — use these anywhere in the app ──────────────────────────────

/** Admin's display name */
export function getAdminName() {
  return localStorage.getItem("admin_name") || "";
}

/** Active department for this session */
export function getActiveDepartment() {
  return localStorage.getItem("admin_active_department") || null;
}

/** "hq" | "store" */
export function getAdminScope() {
  return localStorage.getItem("admin_scope") || "hq";
}

/** tenant_id e.g. "citimart" | "zudio" */
export function getTenantId() {
  return localStorage.getItem("admin_tenant_id") || "";
}

/** store_id — null for HQ admins */
export function getStoreId() {
  return localStorage.getItem("admin_store_id") || "";
}

/** store_name — null for HQ admins */
export function getStoreName() {
  return localStorage.getItem("admin_store_name") || "";
}

/** true if HQ Admin */
export function isHQAdmin() {
  return getAdminScope() === "hq";
}

/** true if Store Admin or Branch Admin */
export function isStoreAdmin() {
  return getAdminScope() === "store";
}

/**
 * Wipe all auth-related localStorage keys on logout.
 * Keep in sync with DepartmentSelector logout handler.
 */
export function clearAuthData() {
  [
    "admin_token", "access_token", "token",
    "admin_name", "admin_email", "admin_login_data",
    "admin_active_department", "admin_scope", "admin_tenant_id",
    "admin_store_id", "admin_store_name", "admin_store_type", "admin_account_type",
    "store_id", "store_name", "store_type", "scope",
    "user", "authUser",
  ].forEach((key) => localStorage.removeItem(key));
}

/**
 * Leave the current department workspace.
 * Multi-department admins keep their authenticated session and return to the
 * department selector. Single-department admins perform a complete logout.
 */
export async function logoutOrReturnToDepartmentSelector() {
  const token =
    localStorage.getItem("admin_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token");

  let departments = [];
  try {
    const loginData = JSON.parse(localStorage.getItem("admin_login_data") || "{}");
    departments = Array.isArray(loginData.departments) ? loginData.departments : [];
  } catch {
    departments = [];
  }

  // Refresh assignments before deciding so Super Admin changes take effect
  // without requiring the user to log in again first.
  if (token) {
    try {
      const apiBase = APP_API_URL;
      const response = await fetch(`${apiBase}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const profile = await response.json();
        if (Array.isArray(profile.managedDepartments)) {
          departments = profile.managedDepartments;
          const saved = JSON.parse(localStorage.getItem("admin_login_data") || "{}");
          localStorage.setItem("admin_login_data", JSON.stringify({
            ...saved,
            name: profile.name || saved.name || "",
            departments,
          }));
        }
      }
    } catch {
      // Network failure: use the department list saved at login.
    }
  }

  if (token && departments.length > 1) {
    localStorage.removeItem("admin_active_department");
    window.location.replace("/dashboard/select");
    return;
  }

  clearAuthData();
  window.location.replace("/admin/login");
}
