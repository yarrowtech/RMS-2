import React, { useState, useEffect } from 'react';
import { 
  Search,
  Package,
  Plus,
  Minus,
  Edit,
  Trash2,
  Download,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  X,
  ShoppingCart,
  ArrowLeft,
  Home,
  Filter,
  MoreHorizontal,
  Eye,
  RefreshCw
} from 'lucide-react';

export default function Inventory() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [inventoryItems, setInventoryItems] = useState([
    {
      id: 1,
      itemCode: 'GIFT-001',
      name: 'GIFT WRAP JM BAP',
      category: 'ACCESSORIES-GIFT',
      currentStock: 45,
      minStock: 10,
      costPrice: 7.50,
      sellingPrice: 9.00,
      status: 'Active'
    },
    {
      id: 2,
      itemCode: 'OFF-002',
      name: 'STAPLER HEAVY DUTY',
      category: 'OFFICE-SUPPLIES',
      currentStock: 8,
      minStock: 15,
      costPrice: 45.00,
      sellingPrice: 65.00,
      status: 'Low Stock'
    },
    {
      id: 3,
      itemCode: 'TOY-003',
      name: 'WOODEN PUZZLE SET',
      category: 'TOYS-GAMES',
      currentStock: 25,
      minStock: 20,
      costPrice: 85.00,
      sellingPrice: 120.00,
      status: 'Active'
    },
    {
      id: 4,
      itemCode: 'BOOK-004',
      name: 'NOTEBOOK A4 RULED',
      category: 'BOOKS-STATIONERY',
      currentStock: 0,
      minStock: 25,
      costPrice: 15.00,
      sellingPrice: 25.00,
      status: 'Out of Stock'
    }
  ]);

  const [newItem, setNewItem] = useState({
    itemCode: '',
    name: '',
    category: '',
    currentStock: 0,
    minStock: 0,
    costPrice: 0,
    sellingPrice: 0
  });

  const getStatusColor = (item) => {
    if (item.currentStock === 0) return 'bg-red-50 text-red-800 border-red-200';
    if (item.currentStock <= item.minStock) return 'bg-amber-50 text-amber-800 border-amber-200';
    return 'bg-green-50 text-green-800 border-green-200';
  };

  const getStatusText = (item) => {
    if (item.currentStock === 0) return 'Out of Stock';
    if (item.currentStock <= item.minStock) return 'Low Stock';
    return 'In Stock';
  };

  const filteredItems = inventoryItems
    .filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.itemCode.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    })
    .sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      }
      return aValue < bValue ? 1 : -1;
    });

  const addNewItem = () => {
    const item = {
      ...newItem,
      id: Date.now(),
      status: newItem.currentStock === 0 ? 'Out of Stock' : 
              newItem.currentStock <= newItem.minStock ? 'Low Stock' : 'Active'
    };
    setInventoryItems([...inventoryItems, item]);
    setNewItem({
      itemCode: '', name: '', category: '', currentStock: 0, 
      minStock: 0, costPrice: 0, sellingPrice: 0
    });
    setShowAddItem(false);
  };

  const updateStock = (id, newStock) => {
    setInventoryItems(inventoryItems.map(item => 
      item.id === id 
        ? { 
            ...item, 
            currentStock: Math.max(0, newStock),
            status: newStock === 0 ? 'Out of Stock' : 
                   newStock <= item.minStock ? 'Low Stock' : 'Active'
          }
        : item
    ));
  };

  const deleteItem = (id) => {
    setInventoryItems(inventoryItems.filter(item => item.id !== id));
  };

  const calculateTotalValue = () => {
    return inventoryItems.reduce((sum, item) => sum + (item.currentStock * item.costPrice), 0);
  };

  const getLowStockCount = () => {
    return inventoryItems.filter(item => item.currentStock <= item.minStock && item.currentStock > 0).length;
  };

  const getOutOfStockCount = () => {
    return inventoryItems.filter(item => item.currentStock === 0).length;
  };

  const ProfessionalCard = ({ title, children, actions, className = "" }) => (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 ${className}`}>
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{title}</h3>
        {actions && <div className="flex items-center space-x-1">{actions}</div>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );

  const StatCard = ({ label, value, icon: Icon, trend }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:border-gray-300">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className="p-3 bg-gray-100 rounded-lg">
          <Icon className="w-6 h-6 text-gray-700" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Professional Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg text-gray-700 hover:text-gray-900 transition-all duration-200 font-medium">
              <ArrowLeft className="w-4 h-4" />
              <Home className="w-4 h-4" />
              <span className="text-sm">Return to Dashboard</span>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Inventory Management System</h1>
              <p className="text-sm text-gray-600">Advanced Stock Control & Analytics</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200">
              <RefreshCw className="w-5 h-5" />
            </button>
            <div className="text-sm text-gray-600 font-medium">
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} | {currentTime.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Key Performance Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            label="Total Inventory Items" 
            value={inventoryItems.length} 
            icon={Package}
          />
          <StatCard 
            label="Low Stock Alerts" 
            value={getLowStockCount()} 
            icon={AlertTriangle}
          />
          <StatCard 
            label="Out of Stock Items" 
            value={getOutOfStockCount()} 
            icon={TrendingDown}
          />
          <StatCard 
            label="Total Inventory Value" 
            value={`₹${calculateTotalValue().toLocaleString()}`} 
            icon={DollarSign}
          />
        </div>

        {/* Search and Control Panel */}
        <ProfessionalCard 
          title="Inventory Control Panel"
          actions={[
            <button key="filter" className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200">
              <Filter className="w-4 h-4" />
            </button>,
            <button key="view" className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200">
              <Eye className="w-4 h-4" />
            </button>
          ]}
        >
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                  placeholder="Search inventory by name or item code..."
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-gray-100 border border-gray-200 rounded-lg px-4 py-2 text-gray-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                <option value="name">Sort by Name</option>
                <option value="currentStock">Sort by Stock Level</option>
                <option value="sellingPrice">Sort by Price</option>
                <option value="category">Sort by Category</option>
              </select>
              
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-colors duration-200"
              >
                {sortOrder === 'asc' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </button>
              
              <button 
                onClick={() => setShowAddItem(true)}
                className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 font-medium transition-colors duration-200"
              >
                <Plus className="w-4 h-4" />
                Add New Item
              </button>
              
              <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 font-medium transition-colors duration-200">
                <Download className="w-4 h-4" />
                Export Data
              </button>
            </div>
          </div>
        </ProfessionalCard>

        {/* Inventory Table */}
        <ProfessionalCard title="Inventory Database">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-4 px-4 text-gray-700 font-semibold">Item Code</th>
                  <th className="text-left py-4 px-4 text-gray-700 font-semibold">Product Name</th>
                  <th className="text-left py-4 px-4 text-gray-700 font-semibold">Category</th>
                  <th className="text-center py-4 px-4 text-gray-700 font-semibold">Stock Level</th>
                  <th className="text-right py-4 px-4 text-gray-700 font-semibold">Cost Price</th>
                  <th className="text-right py-4 px-4 text-gray-700 font-semibold">Selling Price</th>
                  <th className="text-center py-4 px-4 text-gray-700 font-semibold">Status</th>
                  <th className="text-center py-4 px-4 text-gray-700 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors duration-200">
                    <td className="py-4 px-4 text-gray-600 font-mono text-sm">{item.itemCode}</td>
                    <td className="py-4 px-4 text-gray-900 font-semibold">{item.name}</td>
                    <td className="py-4 px-4 text-gray-600 font-medium">{item.category}</td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => updateStock(item.id, item.currentStock - 1)}
                          className="w-7 h-7 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors duration-200 border border-gray-200"
                        >
                          <Minus className="w-3 h-3 text-gray-600" />
                        </button>
                        <span className="w-12 text-center text-gray-900 font-semibold">{item.currentStock}</span>
                        <button 
                          onClick={() => updateStock(item.id, item.currentStock + 1)}
                          className="w-7 h-7 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors duration-200 border border-gray-200"
                        >
                          <Plus className="w-3 h-3 text-gray-600" />
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right text-gray-900 font-medium">₹{item.costPrice.toFixed(2)}</td>
                    <td className="py-4 px-4 text-right text-gray-900 font-semibold">₹{item.sellingPrice.toFixed(2)}</td>
                    <td className="py-4 px-4 text-center">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(item)}`}>
                        {getStatusText(item)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => deleteItem(item.id)}
                          className="text-gray-500 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors duration-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ProfessionalCard>
      </div>

      {/* Professional Add Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-8 w-[600px] max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Add New Inventory Item</h3>
              <button 
                onClick={() => setShowAddItem(false)} 
                className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Item Code</label>
                  <input
                    type="text"
                    value={newItem.itemCode}
                    onChange={(e) => setNewItem({...newItem, itemCode: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    placeholder="e.g., ITEM-001"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                  <input
                    type="text"
                    value={newItem.category}
                    onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    placeholder="e.g., ELECTRONICS"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Product Name</label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                  placeholder="Enter complete product name"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Current Stock Level</label>
                  <input
                    type="number"
                    value={newItem.currentStock}
                    onChange={(e) => setNewItem({...newItem, currentStock: parseInt(e.target.value) || 0})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Minimum Stock Level</label>
                  <input
                    type="number"
                    value={newItem.minStock}
                    onChange={(e) => setNewItem({...newItem, minStock: parseInt(e.target.value) || 0})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    placeholder="0"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Cost Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newItem.costPrice}
                    onChange={(e) => setNewItem({...newItem, costPrice: parseFloat(e.target.value) || 0})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Selling Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newItem.sellingPrice}
                    onChange={(e) => setNewItem({...newItem, sellingPrice: parseFloat(e.target.value) || 0})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={() => setShowAddItem(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-medium transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={addNewItem}
                className="flex-1 bg-gray-900 hover:bg-gray-800 text-white py-3 px-6 rounded-lg font-medium transition-colors duration-200"
              >
                Add Item to Inventory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}