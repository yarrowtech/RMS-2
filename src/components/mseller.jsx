import React, { useState } from 'react';
import { 
  ShoppingCart, Users, TrendingUp, Package, FileText, Settings,
  DollarSign, Calendar, Search, Filter, Download, Eye, Edit,
  Trash2, Plus, ChevronRight, CheckCircle, Clock, XCircle,
  AlertCircle, BarChart3, PieChart, LineChart, Activity,
  CreditCard, Truck, MapPin, Phone, Mail, Star, RefreshCw, X, Building2, FileCheck
} from 'lucide-react';

const Mseller = () => {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [dateRange, setDateRange] = useState('This Month');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  
  // Form States
  const [orderForm, setOrderForm] = useState({
    customer: '',
    email: '',
    items: '',
    total: '',
    status: 'pending',
    paymentMethod: 'Credit Card',
    shippingAddress: ''
  });

  const [customerForm, setCustomerForm] = useState({
    name: '',
    email: '',
    phone: '',
    joinDate: new Date().toISOString().split('T')[0],
    status: 'active',
    businessName: '',
    businessType: 'Retailer',
    panNumber: '',
    gstNumber: '',
    businessAddress: '',
    city: '',
    state: '',
    pincode: '',
    creditLimit: '',
    paymentTerms: '30'
  });

  const [productForm, setProductForm] = useState({
    name: '',
    category: '',
    price: '',
    stock: '',
    sku: '',
    description: ''
  });

  const [shippingForm, setShippingForm] = useState({
    orderId: '',
    carrier: '',
    trackingNumber: '',
    estimatedDelivery: '',
    shippingMethod: 'Standard'
  });

  // Sales Data
  const [orders, setOrders] = useState([
    {
      id: 'ORD-001',
      customer: 'John Smith',
      email: 'john@example.com',
      items: 3,
      total: 2499,
      status: 'delivered',
      date: '2025-10-28',
      paymentMethod: 'Credit Card',
      shippingAddress: '123 Main St, New York, NY 10001'
    },
    {
      id: 'ORD-002', 
      customer: 'Sarah Johnson',
      email: 'sarah@example.com',
      items: 2,
      total: 1899,
      status: 'processing',
      date: '2025-10-29',
      paymentMethod: 'PayPal',
      shippingAddress: '456 Oak Ave, Los Angeles, CA 90001'
    },
    {
      id: 'ORD-003',
      customer: 'Mike Davis',
      email: 'mike@example.com',
      items: 5,
      total: 4299,
      status: 'shipped',
      date: '2025-10-30',
      paymentMethod: 'Debit Card',
      shippingAddress: '789 Pine Rd, Chicago, IL 60601'
    },
    {
      id: 'ORD-004',
      customer: 'Emily Brown',
      email: 'emily@example.com',
      items: 1,
      total: 899,
      status: 'pending',
      date: '2025-10-31',
      paymentMethod: 'Cash on Delivery',
      shippingAddress: '321 Elm St, Houston, TX 77001'
    }
  ]);

  const [customers, setCustomers] = useState([
    {
      id: 1,
      name: 'John Smith',
      email: 'john@example.com',
      phone: '+1 234-567-8900',
      orders: 12,
      totalSpent: 15600,
      joinDate: '2024-03-15',
      status: 'active',
      rating: 4.8,
      businessName: 'Smith Retail Store',
      businessType: 'Retailer',
      panNumber: 'ABCDE1234F',
      gstNumber: '27ABCDE1234F1Z5',
      businessAddress: '123 Business Park',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      creditLimit: '50000',
      paymentTerms: '30'
    },
    {
      id: 2,
      name: 'Sarah Johnson',
      email: 'sarah@example.com',
      phone: '+1 234-567-8901',
      orders: 8,
      totalSpent: 9800,
      joinDate: '2024-05-20',
      status: 'active',
      rating: 4.9,
      businessName: 'Johnson Wholesale',
      businessType: 'Wholesaler',
      panNumber: 'FGHIJ5678K',
      gstNumber: '29FGHIJ5678K1Z8',
      businessAddress: '456 Trade Center',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001',
      creditLimit: '100000',
      paymentTerms: '45'
    },
    {
      id: 3,
      name: 'Mike Davis',
      email: 'mike@example.com',
      phone: '+1 234-567-8902',
      orders: 15,
      totalSpent: 22400,
      joinDate: '2024-01-10',
      status: 'active',
      rating: 4.7,
      businessName: 'Davis Distributors',
      businessType: 'Distributor',
      panNumber: 'LMNOP9012Q',
      gstNumber: '07LMNOP9012Q1Z3',
      businessAddress: '789 Commerce Plaza',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      creditLimit: '200000',
      paymentTerms: '60'
    },
    {
      id: 4,
      name: 'Emily Brown',
      email: 'emily@example.com',
      phone: '+1 234-567-8903', 
      orders: 5,
      totalSpent: 6200,
      joinDate: '2024-08-05',
      status: 'active',
      rating: 5.0,
      businessName: 'Brown Fashion Hub',
      businessType: 'Retailer',
      panNumber: 'RSTUV3456W',
      gstNumber: '33RSTUV3456W1Z9',
      businessAddress: '321 Shopping District',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600001',
      creditLimit: '75000',
      paymentTerms: '30'
    }
  ]);

  const [products, setProducts] = useState([
    { id: 1, name: 'Blue Denim Jeans', category: 'Clothing', price: 500, stock: 45, sku: 'CLO-001' },
    { id: 2, name: 'Cotton White Shirt', category: 'Clothing', price: 495, stock: 62, sku: 'CLO-002' },
    { id: 3, name: 'Black Leather Jacket', category: 'Outerwear', price: 1500, stock: 23, sku: 'OUT-001' },
    { id: 4, name: 'Red Summer Dress', category: 'Clothing', price: 600, stock: 38, sku: 'CLO-003' },
    { id: 5, name: 'Sneakers Pro', category: 'Footwear', price: 800, stock: 55, sku: 'FOO-001' }
  ]);

  const [salesData, setSalesData] = useState({
    today: { sales: 12500, orders: 23, customers: 18 },
    week: { sales: 78900, orders: 156, customers: 89 },
    month: { sales: 325600, orders: 645, customers: 342 },
    year: { sales: 2456000, orders: 5234, customers: 2156 }
  });

  const [topProducts, setTopProducts] = useState([
    { id: 1, name: 'Blue Denim Jeans', sales: 245, revenue: 122500, image: '/api/placeholder/60/60' },
    { id: 2, name: 'Cotton White Shirt', sales: 198, revenue: 98010, image: '/api/placeholder/60/60' },
    { id: 3, name: 'Black Leather Jacket', sales: 156, revenue: 234000, image: '/api/placeholder/60/60' },
    { id: 4, name: 'Red Summer Dress', sales: 143, revenue: 85800, image: '/api/placeholder/60/60' },
    { id: 5, name: 'Sneakers Pro', sales: 134, revenue: 107200, image: '/api/placeholder/60/60' }
  ]);

  const [recentActivities, setRecentActivities] = useState([
    { id: 1, type: 'order', message: 'New order #ORD-004 received', time: '5 mins ago', icon: ShoppingCart, color: 'blue' },
    { id: 2, type: 'customer', message: 'New customer Emily Brown registered', time: '15 mins ago', icon: Users, color: 'green' },
    { id: 3, type: 'payment', message: 'Payment received for #ORD-003', time: '1 hour ago', icon: DollarSign, color: 'yellow' },
    { id: 4, type: 'shipping', message: 'Order #ORD-002 shipped', time: '2 hours ago', icon: Truck, color: 'purple' }
  ]);

  // Modal Handlers
  const openModal = (type, item = null) => {
    setModalType(type);
    setEditingItem(item);
    
    if (item) {
      if (type === 'order') {
        setOrderForm(item);
      } else if (type === 'customer') {
        setCustomerForm(item);
      } else if (type === 'product') {
        setProductForm(item);
      } else if (type === 'shipping') {
        setShippingForm(item);
      }
    } else {
      resetForms();
    }
    
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    resetForms();
  };

  const resetForms = () => {
    setOrderForm({
      customer: '',
      email: '',
      items: '',
      total: '',
      status: 'pending',
      paymentMethod: 'Credit Card',
      shippingAddress: ''
    });
    setCustomerForm({
      name: '',
      email: '',
      phone: '',
      joinDate: new Date().toISOString().split('T')[0],
      status: 'active',
      businessName: '',
      businessType: 'Retailer',
      panNumber: '',
      gstNumber: '',
      businessAddress: '',
      city: '',
      state: '',
      pincode: '',
      creditLimit: '',
      paymentTerms: '30'
    });
    setProductForm({
      name: '',
      category: '',
      price: '',
      stock: '',
      sku: '',
      description: ''
    });
    setShippingForm({
      orderId: '',
      carrier: '',
      trackingNumber: '',
      estimatedDelivery: '',
      shippingMethod: 'Standard'
    });
  };

  // CRUD Operations
  const handleAddOrder = () => {
    const newOrder = {
      ...orderForm,
      id: `ORD-${String(orders.length + 1).padStart(3, '0')}`,
      date: new Date().toISOString().split('T')[0],
      items: parseInt(orderForm.items),
      total: parseFloat(orderForm.total)
    };
    setOrders([...orders, newOrder]);
    closeModal();
  };

  const handleUpdateOrder = () => {
    setOrders(orders.map(order => 
      order.id === editingItem.id ? { ...order, ...orderForm } : order
    ));
    closeModal();
  };

  const handleDeleteOrder = (id) => {
    if (window.confirm('Are you sure you want to delete this order?')) {
      setOrders(orders.filter(order => order.id !== id));
    }
  };

  const handleAddCustomer = () => {
    const newCustomer = {
      ...customerForm,
      id: customers.length + 1,
      orders: 0,
      totalSpent: 0,
      rating: 0
    };
    setCustomers([...customers, newCustomer]);
    closeModal();
  };

  const handleUpdateCustomer = () => {
    setCustomers(customers.map(customer => 
      customer.id === editingItem.id ? { ...customer, ...customerForm } : customer
    ));
    closeModal();
  };

  const handleDeleteCustomer = (id) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      setCustomers(customers.filter(customer => customer.id !== id));
    }
  };

  const handleAddProduct = () => {
    const newProduct = {
      ...productForm,
      id: products.length + 1,
      price: parseFloat(productForm.price),
      stock: parseInt(productForm.stock)
    };
    setProducts([...products, newProduct]);
    closeModal();
  };

  const handleUpdateProduct = () => {
    setProducts(products.map(product => 
      product.id === editingItem.id ? { ...product, ...productForm } : product
    ));
    closeModal();
  };

  const handleDeleteProduct = (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      setProducts(products.filter(product => product.id !== id));
    }
  };

  // Sidebar navigation
  const navigation = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'customers', label: 'Vendors', icon: Users },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'shipping', label: 'Shipping', icon: Truck },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  const getStatusColor = (status) => {
    const colors = {
      delivered: 'bg-green-100 text-green-800 border-green-200',
      shipped: 'bg-blue-100 text-blue-800 border-blue-200',
      processing: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      pending: 'bg-orange-100 text-orange-800 border-orange-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[status] || colors.pending;
  };

  const getStatusIcon = (status) => {
    const icons = {
      delivered: CheckCircle,
      shipped: Truck,
      processing: Clock,
      pending: AlertCircle,
      cancelled: XCircle
    };
    const Icon = icons[status] || AlertCircle;
    return <Icon className="h-4 w-4" />;
  };

  // Modal Component
  const Modal = ({ children, title }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );

  // Order Form Modal
  const OrderFormModal = () => (
    <Modal title={editingItem ? 'Edit Order' : 'Create New Order'}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Vendor Name *</label>
            <input
              type="text"
              value={orderForm.customer}
              onChange={(e) => setOrderForm({...orderForm, customer: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="John Doe"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
            <input
              type="email"
              value={orderForm.email}
              onChange={(e) => setOrderForm({...orderForm, email: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="john@example.com"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Number of Items *</label>
            <input
              type="number"
              value={orderForm.items}
              onChange={(e) => setOrderForm({...orderForm, items: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="3"
              min="1"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Total Amount (₹) *</label>
            <input
              type="number"
              value={orderForm.total}
              onChange={(e) => setOrderForm({...orderForm, total: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="2499"
              min="0"
              step="0.01"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Order Status *</label>
            <select
              value={orderForm.status}
              onChange={(e) => setOrderForm({...orderForm, status: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method *</label>
            <select
              value={orderForm.paymentMethod}
              onChange={(e) => setOrderForm({...orderForm, paymentMethod: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Credit Card">Credit Card</option>
              <option value="Debit Card">Debit Card</option>
              <option value="PayPal">PayPal</option>
              <option value="Cash on Delivery">Cash on Delivery</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Shipping Address *</label>
          <textarea
            value={orderForm.shippingAddress}
            onChange={(e) => setOrderForm({...orderForm, shippingAddress: e.target.value})}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows="3"
            placeholder="123 Main St, New York, NY 10001"
            required
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={closeModal}
            className="flex-1 px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={editingItem ? handleUpdateOrder : handleAddOrder}
            className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            {editingItem ? 'Update Order' : 'Create Order'}
          </button>
        </div>
      </div>
    </Modal>
  );

  // Customer Form Modal - UPDATED WITH BUSINESS DETAILS
  const CustomerFormModal = () => (
    <Modal title={editingItem ? 'Edit Vendor' : 'Add New Vendor'}>
      <div className="space-y-6">
        {/* Personal Information Section */}
        <div>
          <h4 className="text-md font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Personal Information
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
              <input
                type="text"
                value={customerForm.name}
                onChange={(e) => setCustomerForm({...customerForm, name: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="John Smith"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({...customerForm, email: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="john@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                <input
                  type="tel"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({...customerForm, phone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+1 234-567-8900"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Join Date</label>
                <input
                  type="date"
                  value={customerForm.joinDate}
                  onChange={(e) => setCustomerForm({...customerForm, joinDate: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={customerForm.status}
                  onChange={(e) => setCustomerForm({...customerForm, status: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Business Information Section */}
        <div className="border-t pt-6">
          <h4 className="text-md font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-green-600" />
            Business Information
          </h4>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Business Name *</label>
                <input
                  type="text"
                  value={customerForm.businessName}
                  onChange={(e) => setCustomerForm({...customerForm, businessName: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Smith Retail Store"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Business Type *</label>
                <select
                  value={customerForm.businessType}
                  onChange={(e) => setCustomerForm({...customerForm, businessType: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Retailer">Retailer</option>
                  <option value="Wholesaler">Wholesaler</option>
                  <option value="Distributor">Distributor</option>
                  <option value="Manufacturer">Manufacturer</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">PAN Number *</label>
                <input
                  type="text"
                  value={customerForm.panNumber}
                  onChange={(e) => setCustomerForm({...customerForm, panNumber: e.target.value.toUpperCase()})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                  placeholder="ABCDE1234F"
                  maxLength="10"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">GST Number *</label>
                <input
                  type="text"
                  value={customerForm.gstNumber}
                  onChange={(e) => setCustomerForm({...customerForm, gstNumber: e.target.value.toUpperCase()})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                  placeholder="27ABCDE1234F1Z5"
                  maxLength="15"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Business Address *</label>
              <textarea
                value={customerForm.businessAddress}
                onChange={(e) => setCustomerForm({...customerForm, businessAddress: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows="2"
                placeholder="123 Business Park, Industrial Area"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">City *</label>
                <input
                  type="text"
                  value={customerForm.city}
                  onChange={(e) => setCustomerForm({...customerForm, city: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Mumbai"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">State *</label>
                <input
                  type="text"
                  value={customerForm.state}
                  onChange={(e) => setCustomerForm({...customerForm, state: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Maharashtra"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pincode *</label>
                <input
                  type="text"
                  value={customerForm.pincode}
                  onChange={(e) => setCustomerForm({...customerForm, pincode: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="400001"
                  maxLength="6"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Payment Terms Section */}
        <div className="border-t pt-6">
          <h4 className="text-md font-bold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-purple-600" />
            Payment Terms
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Credit Limit (₹)</label>
              <input
                type="number"
                value={customerForm.creditLimit}
                onChange={(e) => setCustomerForm({...customerForm, creditLimit: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="50000"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Terms (Days)</label>
              <select
                value={customerForm.paymentTerms}
                onChange={(e) => setCustomerForm({...customerForm, paymentTerms: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="0">Immediate</option>
                <option value="7">7 Days</option>
                <option value="15">15 Days</option>
                <option value="30">30 Days</option>
                <option value="45">45 Days</option>
                <option value="60">60 Days</option>
                <option value="90">90 Days</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={closeModal}
            className="flex-1 px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={editingItem ? handleUpdateCustomer : handleAddCustomer}
            className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            {editingItem ? 'Update Vendor' : 'Add Vendor'}
          </button>
        </div>
      </div>
    </Modal>
  );

  // Product Form Modal
  const ProductFormModal = () => (
    <Modal title={editingItem ? 'Edit Product' : 'Add New Product'}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
          <input
            type="text"
            value={productForm.name}
            onChange={(e) => setProductForm({...productForm, name: e.target.value})}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Blue Denim Jeans"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
            <select
              value={productForm.category}
              onChange={(e) => setProductForm({...productForm, category: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Category</option>
              <option value="Clothing">Clothing</option>
              <option value="Footwear">Footwear</option>
              <option value="Accessories">Accessories</option>
              <option value="Outerwear">Outerwear</option>
              <option value="Electronics">Electronics</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">SKU *</label>
            <input
              type="text"
              value={productForm.sku}
              onChange={(e) => setProductForm({...productForm, sku: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="CLO-001"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Price (₹) *</label>
            <input
              type="number"
              value={productForm.price}
              onChange={(e) => setProductForm({...productForm, price: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="500"
              min="0"
              step="0.01"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Stock Quantity *</label>
            <input
              type="number"
              value={productForm.stock}
              onChange={(e) => setProductForm({...productForm, stock: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="45"
              min="0"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            value={productForm.description}
            onChange={(e) => setProductForm({...productForm, description: e.target.value})}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows="3"
            placeholder="Enter product description..."
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={closeModal}
            className="flex-1 px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={editingItem ? handleUpdateProduct : handleAddProduct}
            className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            {editingItem ? 'Update Product' : 'Add Product'}
          </button>
        </div>
      </div>
    </Modal>
  );

  // Shipping Form Modal
  const ShippingFormModal = () => (
    <Modal title="Add Shipping Details">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Order ID *</label>
          <select
            value={shippingForm.orderId}
            onChange={(e) => setShippingForm({...shippingForm, orderId: e.target.value})}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select Order</option>
            {orders.filter(o => o.status === 'processing' || o.status === 'pending').map(order => (
              <option key={order.id} value={order.id}>{order.id} - {order.customer}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Carrier *</label>
            <select
              value={shippingForm.carrier}
              onChange={(e) => setShippingForm({...shippingForm, carrier: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Carrier</option>
              <option value="FedEx">FedEx</option>
              <option value="UPS">UPS</option>
              <option value="DHL">DHL</option>
              <option value="USPS">USPS</option>
              <option value="Blue Dart">Blue Dart</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tracking Number *</label>
            <input
              type="text"
              value={shippingForm.trackingNumber}
              onChange={(e) => setShippingForm({...shippingForm, trackingNumber: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="TRACK123456"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Shipping Method *</label>
            <select
              value={shippingForm.shippingMethod}
              onChange={(e) => setShippingForm({...shippingForm, shippingMethod: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Standard">Standard (5-7 days)</option>
              <option value="Express">Express (2-3 days)</option>
              <option value="Overnight">Overnight (1 day)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Delivery *</label>
            <input
              type="date"
              value={shippingForm.estimatedDelivery}
              onChange={(e) => setShippingForm({...shippingForm, estimatedDelivery: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min={new Date().toISOString().split('T')[0]}
              required
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={closeModal}
            className="flex-1 px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              // Update order status to shipped
              const orderId = shippingForm.orderId;
              if (orderId) {
                setOrders(orders.map(order => 
                  order.id === orderId ? { ...order, status: 'shipped' } : order
                ));
                closeModal();
              }
            }}
            className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Add Shipping Info
          </button>
        </div>
      </div>
    </Modal>
  );

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-600 mt-1">Welcome back! Here's your business overview</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option>Today</option>
            <option>This Week</option>
            <option>This Month</option>
            <option>This Year</option>
          </select>
          <button 
            onClick={() => openModal('order')}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Quick Order
          </button>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <DollarSign className="h-6 w-6" />
            </div>
            <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded">+12.5%</span>
          </div>
          <h3 className="text-2xl font-black mb-1">₹{salesData.month.sales.toLocaleString()}</h3>
          <p className="text-blue-100 text-sm">Total Sales</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded">+8.2%</span>
          </div>
          <h3 className="text-2xl font-black mb-1">{salesData.month.orders}</h3>
          <p className="text-green-100 text-sm">Total Orders</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <Users className="h-6 w-6" />
            </div>
            <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded">+15.3%</span>
          </div>
          <h3 className="text-2xl font-black mb-1">{salesData.month.customers}</h3>
          <p className="text-purple-100 text-sm">Total Vendors</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6" />
            </div>
            <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded">+5.7%</span>
          </div>
          <h3 className="text-2xl font-black mb-1">₹{Math.round(salesData.month.sales / salesData.month.orders)}</h3>
          <p className="text-orange-100 text-sm">Avg Order Value</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Recent Orders</h3>
            <button 
              onClick={() => setActiveModule('orders')}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              View All
            </button>
          </div>
          <div className="space-y-3">
            {orders.slice(0, 5).map(order => (
              <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <ShoppingCart className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{order.id}</p>
                    <p className="text-sm text-gray-600">{order.customer}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">₹{order.total}</p>
                  <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(order.status)}`}>
                    {getStatusIcon(order.status)}
                    {order.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Recent Activity</h3>
          <div className="space-y-4">
            {recentActivities.map(activity => {
              const Icon = activity.icon;
              const colors = {
                blue: 'bg-blue-100 text-blue-600',
                green: 'bg-green-100 text-green-600',
                yellow: 'bg-yellow-100 text-yellow-600',
                purple: 'bg-purple-100 text-purple-600'
              };
              return (
                <div key={activity.id} className="flex gap-3">
                  <div className={`p-2 rounded-lg h-fit ${colors[activity.color]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 font-medium">{activity.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Top Selling Products</h3>
          <button 
            onClick={() => setActiveModule('products')}
            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            View All
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {topProducts.map(product => (
            <div key={product.id} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
              <img src={product.image} alt={product.name} className="w-full h-32 object-cover rounded-lg mb-3" />
              <h4 className="font-semibold text-sm text-gray-900 mb-1">{product.name}</h4>
              <p className="text-xs text-gray-600 mb-2">{product.sales} sales</p>
              <p className="font-bold text-green-600">₹{product.revenue.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderOrders = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900">Orders Management</h2>
          <p className="text-sm text-gray-600 mt-1">Track and manage all your orders</p>
        </div>
        <button 
          onClick={() => openModal('order')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Create Order
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-md border border-gray-200">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white">
            <option>All Status</option>
            <option>Pending</option>
            <option>Processing</option>
            <option>Shipped</option>
            <option>Delivered</option>
          </select>
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <Filter className="h-5 w-5" />
            More Filters
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-bold text-gray-700">Order ID</th>
                <th className="text-left py-4 px-6 text-sm font-bold text-gray-700">Vendor</th>
                <th className="text-left py-4 px-6 text-sm font-bold text-gray-700">Date</th>
                <th className="text-left py-4 px-6 text-sm font-bold text-gray-700">Items</th>
                <th className="text-left py-4 px-6 text-sm font-bold text-gray-700">Total</th>
                <th className="text-left py-4 px-6 text-sm font-bold text-gray-700">Status</th>
                <th className="text-left py-4 px-6 text-sm font-bold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6">
                    <span className="font-semibold text-blue-600">{order.id}</span>
                  </td>
                  <td className="py-4 px-6">
                    <div>
                      <p className="font-medium text-gray-900">{order.customer}</p>
                      <p className="text-sm text-gray-500">{order.email}</p>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-600">{order.date}</td>
                  <td className="py-4 px-6 text-sm font-semibold">{order.items}</td>
                  <td className="py-4 px-6 font-bold text-gray-900">₹{order.total}</td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)}
                      {order.status}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex gap-2">
                      <button className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => openModal('order', order)}
                        className="p-2 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteOrder(order.id)}
                        className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between bg-white rounded-lg p-4 shadow-md border border-gray-200">
        <p className="text-sm text-gray-600">Showing 1 to {orders.length} of {orders.length} orders</p>
        <div className="flex gap-2">
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            Previous
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg">1</button>
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">2</button>
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">3</button>
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            Next
          </button>
        </div>
      </div>
    </div>
  );

  const renderCustomers = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900">Vendors</h2>
          <p className="text-sm text-gray-600 mt-1">Manage your customer relationships</p>
        </div>
        <button 
          onClick={() => openModal('customer')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Add Vendor
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg p-4 shadow-md border border-gray-200">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search customers..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter
          </button>
        </div>
      </div>

      {/* Customer Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <h4 className="font-semibold text-gray-700">Total Vendors</h4>
          </div>
          <p className="text-3xl font-black text-gray-900">{customers.length}</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-100 p-2 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <h4 className="font-semibold text-gray-700">Active</h4>
          </div>
          <p className="text-3xl font-black text-gray-900">{customers.filter(c => c.status === 'active').length}</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Star className="h-5 w-5 text-purple-600" />
            </div>
            <h4 className="font-semibold text-gray-700">Avg Rating</h4>
          </div>
          <p className="text-3xl font-black text-gray-900">4.8</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-orange-100 p-2 rounded-lg">
              <DollarSign className="h-5 w-5 text-orange-600" />
            </div>
            <h4 className="font-semibold text-gray-700">Total Revenue</h4>
          </div>
          <p className="text-3xl font-black text-gray-900">₹{customers.reduce((sum, c) => sum + c.totalSpent, 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Vendors Grid - UPDATED WITH BUSINESS DETAILS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers.map(customer => (
          <div key={customer.id} className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {customer.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{customer.name}</h3>
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs text-gray-600">{customer.rating}</span>
                  </div>
                </div>
              </div>
              <span className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded">
                {customer.status}
              </span>
            </div>
            
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Building2 className="h-4 w-4" />
                {customer.businessName}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">{customer.businessType}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="h-4 w-4" />
                {customer.email}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="h-4 w-4" />
                {customer.phone}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <FileCheck className="h-3 w-3" />
                GST: {customer.gstNumber}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4 pt-4 border-t border-gray-200">
              <div>
                <p className="text-xs text-gray-600">Total Orders</p>
                <p className="text-xl font-bold text-gray-900">{customer.orders}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Total Spent</p>
                <p className="text-xl font-bold text-green-600">₹{customer.totalSpent.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
                View Details
              </button>
              <button 
                onClick={() => openModal('customer', customer)}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Edit className="h-4 w-4 text-gray-600" />
              </button>
              <button 
                onClick={() => handleDeleteCustomer(customer.id)}
                className="px-3 py-2 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderProducts = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900">Products</h2>
          <p className="text-sm text-gray-600 mt-1">Manage your product inventory</p>
        </div>
        <button 
          onClick={() => openModal('product')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Add Product
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg p-4 shadow-md border border-gray-200">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white">
            <option>All Categories</option>
            <option>Clothing</option>
            <option>Footwear</option>
            <option>Accessories</option>
            <option>Outerwear</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-bold text-gray-700">SKU</th>
                <th className="text-left py-4 px-6 text-sm font-bold text-gray-700">Product Name</th>
                <th className="text-left py-4 px-6 text-sm font-bold text-gray-700">Category</th>
                <th className="text-left py-4 px-6 text-sm font-bold text-gray-700">Price</th>
                <th className="text-left py-4 px-6 text-sm font-bold text-gray-700">Stock</th>
                <th className="text-left py-4 px-6 text-sm font-bold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6">
                    <span className="font-semibold text-gray-600">{product.sku}</span>
                  </td>
                  <td className="py-4 px-6">
                    <p className="font-medium text-gray-900">{product.name}</p>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                      {product.category}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-bold text-gray-900">₹{product.price}</td>
                  <td className="py-4 px-6">
                    <span className={`font-semibold ${product.stock < 20 ? 'text-red-600' : 'text-green-600'}`}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex gap-2">
                      <button className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => openModal('product', product)}
                        className="p-2 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900">Analytics</h2>
          <p className="text-sm text-gray-600 mt-1">Detailed insights into your business performance</p>
        </div>
        <div className="flex gap-3">
          <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white">
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
            <option>Last 3 Months</option>
            <option>Last Year</option>
          </select>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Chart Placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Sales Trend</h3>
            <LineChart className="h-5 w-5 text-blue-600" />
          </div>
          <div className="h-64 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Sales trend chart visualization</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Revenue Distribution</h3>
            <PieChart className="h-5 w-5 text-green-600" />
          </div>
          <div className="h-64 bg-gradient-to-br from-green-50 to-teal-50 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <PieChart className="h-16 w-16 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Revenue distribution chart</p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Conversion Rate</h3>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-4xl font-black text-green-600">24.5%</span>
            <span className="text-green-600 font-semibold mb-2">↑ 3.2%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-green-600 h-2 rounded-full" style={{ width: '24.5%' }}></div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Vendor Retention</h3>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-4xl font-black text-blue-600">87.3%</span>
            <span className="text-blue-600 font-semibold mb-2">↑ 5.1%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full" style={{ width: '87.3%' }}></div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Vendor Satisfaction</h3>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-4xl font-black text-purple-600">4.8/5</span>
            <span className="text-purple-600 font-semibold mb-2">↑ 0.3</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-purple-600 h-2 rounded-full" style={{ width: '96%' }}></div>
          </div>
        </div>
      </div>

      {/* Category Performance */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Category Performance</h3>
        <div className="space-y-4">
          {[
            { name: 'Clothing', sales: 45600, growth: 12.5, color: 'blue' },
            { name: 'Accessories', sales: 23400, growth: 8.3, color: 'green' },
            { name: 'Footwear', sales: 18900, growth: -2.1, color: 'red' },
            { name: 'Electronics', sales: 34200, growth: 15.7, color: 'purple' }
          ].map((category, idx) => (
            <div key={idx} className="flex items-center gap-4">
              <div className="w-32">
                <p className="font-semibold text-gray-900">{category.name}</p>
              </div>
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className={`bg-${category.color}-600 h-3 rounded-full`}
                    style={{ width: `${(category.sales / 50000) * 100}%` }}
                  ></div>
                </div>
              </div>
              <div className="w-24 text-right">
                <p className="font-bold text-gray-900">₹{category.sales.toLocaleString()}</p>
              </div>
              <div className="w-16 text-right">
                <span className={`font-semibold ${category.growth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {category.growth > 0 ? '↑' : '↓'} {Math.abs(category.growth)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderReports = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900">Reports</h2>
          <p className="text-sm text-gray-600 mt-1">Generate and download business reports</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Generate Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { title: 'Sales Report', description: 'Comprehensive sales analysis', icon: DollarSign, color: 'blue' },
          { title: 'Vendor Report', description: 'Vendorr behavior insights', icon: Users, color: 'green' },
          { title: 'Inventory Report', description: 'Stock levels and movements', icon: Package, color: 'purple' },
          { title: 'Revenue Report', description: 'Revenue breakdown by category', icon: TrendingUp, color: 'orange' },
          { title: 'Order Report', description: 'Order fulfillment statistics', icon: ShoppingCart, color: 'red' },
          { title: 'Performance Report', description: 'Overall business performance', icon: Activity, color: 'pink' }
        ].map((report, idx) => {
          const Icon = report.icon;
          return (
            <div key={idx} className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-xl transition-shadow">
              <div className={`bg-${report.color}-100 p-3 rounded-lg w-fit mb-4`}>
                <Icon className={`h-6 w-6 text-${report.color}-600`} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{report.title}</h3>
              <p className="text-sm text-gray-600 mb-4">{report.description}</p>
              <div className="flex gap-2">
                <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                  <Download className="h-4 w-4" />
                  Download
                </button>
                <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <Eye className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Reports */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Reports</h3>
        <div className="space-y-3">
          {[
            { name: 'Monthly Sales Report - October 2025', date: '2025-10-31', size: '2.4 MB' },
            { name: 'Vendor Analysis Q3 2025', date: '2025-10-15', size: '1.8 MB' },
            { name: 'Inventory Status Report', date: '2025-10-10', size: '3.1 MB' }
          ].map((report, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold text-gray-900">{report.name}</p>
                  <p className="text-sm text-gray-600">{report.date} • {report.size}</p>
                </div>
              </div>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderShipping = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900">Shipping Management</h2>
          <p className="text-sm text-gray-600 mt-1">Track shipments and manage delivery</p>
        </div>
        <button 
          onClick={() => openModal('shipping')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Add Shipping Info
        </button>
      </div>

      {/* Shipping Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Truck className="h-6 w-6 text-blue-600" />
            <h4 className="font-semibold text-gray-700">In Transit</h4>
          </div>
          <p className="text-3xl font-black text-gray-900">23</p>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <h4 className="font-semibold text-gray-700">Delivered</h4>
          </div>
          <p className="text-3xl font-black text-gray-900">156</p>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="h-6 w-6 text-orange-600" />
            <h4 className="font-semibold text-gray-700">Pending</h4>
          </div>
          <p className="text-3xl font-black text-gray-900">8</p>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <XCircle className="h-6 w-6 text-red-600" />
            <h4 className="font-semibold text-gray-700">Failed</h4>
          </div>
          <p className="text-3xl font-black text-gray-900">2</p>
        </div>
      </div>

      {/* Shipment Tracking */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Active Shipments</h3>
        <div className="space-y-4">
          {orders.filter(o => o.status === 'shipped').map(order => (
            <div key={order.id} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold text-gray-900">{order.id}</p>
                  <p className="text-sm text-gray-600">{order.customer}</p>
                </div>
                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
                  In Transit
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                <MapPin className="h-4 w-4" />
                {order.shippingAddress}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '60%' }}></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">Expected delivery: 2-3 days</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-black text-gray-900">Settings</h2>
        <p className="text-sm text-gray-600 mt-1">Manage your store settings and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Store Information</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Store Name</label>
              <input
                type="text"
                defaultValue="Fashion Store"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contact Email</label>
              <input
                type="email"
                defaultValue="store@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
              <input
                type="tel"
                defaultValue="+1 234-567-8900"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Payment Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Credit/Debit Cards</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-green-600" />
                <span className="font-medium">Cash on Delivery</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Notification Preferences</h3>
        <div className="space-y-3">
          {[
            { label: 'Email notifications for new orders', checked: true },
            { label: 'SMS alerts for urgent updates', checked: false },
            { label: 'Weekly sales reports', checked: true },
            { label: 'Low inventory alerts', checked: true }
          ].map((pref, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium text-gray-700">{pref.label}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked={pref.checked} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors">
          Cancel
        </button>
        <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
          Save Changes
        </button>
      </div>
    </div>
  );

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return renderDashboard();
      case 'orders':
        return renderOrders();
      case 'customers':
        return renderCustomers();
      case 'products':
        return renderProducts();
      case 'analytics':
        return renderAnalytics();
      case 'reports':
        return renderReports();
      case 'shipping':
        return renderShipping();
      case 'settings':
        return renderSettings();
      default:
        return renderDashboard();
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 shadow-lg flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-black text-gray-900">Merchandiser</h1>
          <p className="text-sm font-semibold text-blue-600">Seller Portal</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navigation.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveModule(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                  activeModule === item.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <span>🚪</span>
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">
          {renderModule()}
        </div>
      </div>

      {/* Modals */}
      {showModal && modalType === 'order' && <OrderFormModal />}
      {showModal && modalType === 'customer' && <CustomerFormModal />}
      {showModal && modalType === 'product' && <ProductFormModal />}
      {showModal && modalType === 'shipping' && <ShippingFormModal />}
    </div>
  );
};

export default Mseller;