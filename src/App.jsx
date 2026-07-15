
// App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import RoleSelector from "./components/select";
import Cashier from "./components/Cashier/Cashier";
import HR from "./components/hr";
import Logistics from "./components/logistics";
import SuperAdmin from "./components/superadmin";

import Mbuyer from "./components/Mbuyer/mbuyer.jsx";
import Signup from "./pages/signup.jsx";
import ThirdPartyDept from "./components/thirdparty.jsx";
import Finance from "./components/Finance/Finance.jsx";
import DesignPattern from "./components/dnp.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import AdminSetPassword from "./pages/AdminSetPassword.jsx";
import MSeller from "./components/Merchandiser_Seller/MSeller.jsx";
import ProductMapping from "./components/ProductMapping.jsx";
import InventoryManagement from "./components/InventoryManagement/InventoryManagement.jsx";
import StockPlanForecasting from "./components/StockPlanForecastingDepartment/StockPlanForecasting.jsx";
import Admin from "./components/Admin/Admin";
import GRRC from "./components/InventoryManagement/GRRC.jsx";
import GRN from "./components/InventoryManagement/GRN.jsx";
import PurchaseInvoice from "./components/PurchaseInvoice.jsx";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

// â”€â”€ NEW: Department selector (shown when admin manages 2+ departments) â”€â”€â”€â”€â”€â”€â”€â”€
import DepartmentSelector from "./pages/DepartmentSelector.jsx";
import DepartmentRouteGuard from "./components/DepartmentRouteGuard.jsx";
import VendorRouteGuard from "./components/VendorRouteGuard.jsx";

//  Product Management
import ProductList from "./components/Products/ProductList.jsx";
import EditProduct from "./components/Products/EditProduct.jsx";
import AddProduct from "./components/Products/AddProduct.jsx";

//  Merchandiser Seller
import MSellerLogin from "./components/Merchandiser_Seller/MSellerLogin.jsx";
import VendorQuestion from "./components/Merchandiser_Seller/VendorQuestionnaire.jsx";
import RegisterVendor from "./components/Merchandiser_Seller/RegisterVendor.jsx";
import VendorSetPassword from "./components/Merchandiser_Seller/VendorSetPassword.jsx";

import POPublicView from "./components/Popublicview.jsx";
import StoreOwnerDashboard from "./components/StoreOwner/StoreOwnerDashboard.jsx";
import StorePurchasing from "./components/StoreOwner/StorePurchasing.jsx";
import StoreOwnerStaff from "./components/StoreOwner/StoreOwnerStaff.jsx";


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main roles */}
        <Route path="/" element={<RoleSelector />} />
        <Route path="/superadmin" element={<SuperAdmin />} />
        <Route path="/admin" element={<DepartmentRouteGuard department={["HQ", "IT", "Administrator", "SUPERADMIN"]}><Admin /></DepartmentRouteGuard>} />

        {/* â”€â”€ Department selector â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            The backend returns redirect_type: "selector" when an admin manages
            2+ departments. Both AdminLogin and AdminSetPassword call
            handleAuthRedirect() which navigates here automatically.
            Path must match DEPARTMENT_ROUTES redirect_url in auth_routes.py  */}
        <Route path="/dashboard/select" element={<DepartmentSelector />} />

        {/* â”€â”€ Direct dashboard routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            These match the DEPARTMENT_ROUTES values in auth_routes.py exactly.
            When admin has 1 department, handleAuthRedirect() sends them here
            directly. When admin picks a dept in DepartmentSelector, it also
            navigates to one of these paths.                                   */}
        <Route path="/dashboard/hr"                 element={<DepartmentRouteGuard department="HR"><HR /></DepartmentRouteGuard>} />
        <Route path="/dashboard/cashier"            element={<DepartmentRouteGuard department={["Cashier", "Store Owner"]}><Cashier /></DepartmentRouteGuard>} />
        <Route path="/dashboard/finance"            element={<DepartmentRouteGuard department="Finance"><Finance /></DepartmentRouteGuard>} />
        <Route path="/dashboard/it"                 element={<DepartmentRouteGuard department="IT"><Admin /></DepartmentRouteGuard>} />
        <Route path="/dashboard/logistics"          element={<DepartmentRouteGuard department="Logistics"><Logistics /></DepartmentRouteGuard>} />
        <Route path="/dashboard/design"             element={<DepartmentRouteGuard department="Design & Pattern"><DesignPattern /></DepartmentRouteGuard>} />
        <Route path="/dashboard/inventory"          element={<DepartmentRouteGuard department={["Inventory", "Store Owner"]}><InventoryManagement /></DepartmentRouteGuard>} />
        <Route path="/dashboard/stock-planning"     element={<DepartmentRouteGuard department="Stock Planning & Forecasting"><StockPlanForecasting /></DepartmentRouteGuard>} />
        <Route path="/dashboard/third-party"        element={<DepartmentRouteGuard department="Third Party"><ThirdPartyDept /></DepartmentRouteGuard>} />
        <Route path="/dashboard/merchandiser-buyer" element={<DepartmentRouteGuard department="Merchandiser Buyer"><Mbuyer /></DepartmentRouteGuard>} />
        <Route path="/dashboard/vendor"             element={<VendorRouteGuard><MSeller /></VendorRouteGuard>} />
        <Route path="/dashboard/store-owner"        element={<DepartmentRouteGuard department="Store Owner"><StoreOwnerDashboard /></DepartmentRouteGuard>} />
        <Route path="/dashboard/store-owner/purchasing" element={<DepartmentRouteGuard department="Store Owner"><StorePurchasing /></DepartmentRouteGuard>} />
        <Route path="/dashboard/store-owner/staff"   element={<DepartmentRouteGuard department="Store Owner"><StoreOwnerStaff /></DepartmentRouteGuard>} />

        {/* Legacy department dashboards (keep for backward compatibility) */}
        <Route path="/cashier"            element={<DepartmentRouteGuard department="Cashier"><Cashier /></DepartmentRouteGuard>} />
        <Route path="/hr"                 element={<DepartmentRouteGuard department="HR"><HR /></DepartmentRouteGuard>} />
        <Route path="/logistics"          element={<DepartmentRouteGuard department="Logistics"><Logistics /></DepartmentRouteGuard>} />
        <Route path="/finance"            element={<DepartmentRouteGuard department="Finance"><Finance /></DepartmentRouteGuard>} />
        <Route path="/design"             element={<DepartmentRouteGuard department="Design & Pattern"><DesignPattern /></DepartmentRouteGuard>} />
        <Route path="/merchandiser-buyer" element={<DepartmentRouteGuard department="Merchandiser Buyer"><Mbuyer /></DepartmentRouteGuard>} />
        <Route path="/third-party"        element={<DepartmentRouteGuard department="Third Party"><ThirdPartyDept /></DepartmentRouteGuard>} />

        {/* Merchandiser-Seller */}
        <Route path="/merchandiser-seller/login"          element={<MSellerLogin />} />
        <Route path="/vendor/questionnaire"               element={<VendorQuestion />} />
        <Route path="/merchandiser-seller/register"       element={<RegisterVendor />} />
        <Route path="/vendor/register"                    element={<RegisterVendor />} />
        <Route path="/merchandiser-seller/setup-password" element={<VendorSetPassword />} />
        <Route path="/merchandiser-seller"                element={<VendorRouteGuard><MSeller /></VendorRouteGuard>} />

        <Route path="/po-view/:token" element={<POPublicView />} />
        
        

        {/* Product Management */}
        <Route path="/products"              element={<DepartmentRouteGuard department={["IT", "Store Owner"]}><ProductList /></DepartmentRouteGuard>} />
        <Route path="/products/add"          element={<DepartmentRouteGuard department={["IT", "Store Owner"]}><AddProduct /></DepartmentRouteGuard>} />
        <Route path="/products/edit/:sku"    element={<DepartmentRouteGuard department={["IT", "Store Owner"]}><EditProduct /></DepartmentRouteGuard>} />
        <Route path="/product-mapping"       element={<DepartmentRouteGuard department={["IT", "Store Owner"]}><ProductMapping /></DepartmentRouteGuard>} />

        {/* Inventory / Warehouse */}
        <Route path="/inventory" element={<DepartmentRouteGuard department={["Inventory", "Store Owner"]}><InventoryManagement /></DepartmentRouteGuard>} />
        <Route path="/stock"     element={<DepartmentRouteGuard department="Stock Planning & Forecasting"><StockPlanForecasting /></DepartmentRouteGuard>} />
       

        {/* Purchase / Warehouse Flow */}
        <Route path="/grrc"              element={<DepartmentRouteGuard department="Inventory"><GRRC /></DepartmentRouteGuard>} />
        <Route path="/grn"               element={<DepartmentRouteGuard department="Inventory"><GRN /></DepartmentRouteGuard>} />
        <Route path="/purchase-invoice"  element={<DepartmentRouteGuard department="Inventory"><PurchaseInvoice /></DepartmentRouteGuard>} />

        {/* Auth pages */}
        <Route path="/signup"               element={<Signup />} />
        <Route path="/admin/setup-password" element={<AdminSetPassword />} />
        <Route path="/admin/login"          element={<AdminLogin />} />
        <Route path="/forgot-password"      element={<ForgotPassword />} />
        <Route path="/reset-password"       element={<ResetPassword />} />

        {/* Admin department dashboards (legacy) */}
        <Route path="/admin/hr/dashboard"                 element={<DepartmentRouteGuard department="HR"><HR /></DepartmentRouteGuard>} />
        <Route path="/admin/logistics/dashboard"          element={<DepartmentRouteGuard department="Logistics"><Logistics /></DepartmentRouteGuard>} />
        <Route path="/admin/finance/dashboard"            element={<DepartmentRouteGuard department="Finance"><Finance /></DepartmentRouteGuard>} />
        <Route path="/admin/design/dashboard"             element={<DepartmentRouteGuard department="Design & Pattern"><DesignPattern /></DepartmentRouteGuard>} />
        <Route path="/admin/cashier/dashboard"            element={<DepartmentRouteGuard department="Cashier"><Cashier /></DepartmentRouteGuard>} />
        <Route path="/admin/third-party/dashboard"        element={<DepartmentRouteGuard department="Third Party"><ThirdPartyDept /></DepartmentRouteGuard>} />
        <Route path="/admin/merchandiser-buyer/dashboard" element={<DepartmentRouteGuard department="Merchandiser Buyer"><Mbuyer /></DepartmentRouteGuard>} />
        <Route path="/admin/product-mapping"              element={<DepartmentRouteGuard department={["IT", "Store Owner"]}><ProductMapping /></DepartmentRouteGuard>} />
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
