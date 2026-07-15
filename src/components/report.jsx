import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  DollarSign, 
  Users, 
  Package, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  Bell,
  Calendar,
  BarChart3,
  FileText,
  Settings,
  User,
  LogOut,
  Search,
  Filter,
  Download,
  RefreshCw,
  Menu,
  ChevronDown,
  Clock,
  MapPin,
  Truck,
  CreditCard,
  ShoppingCart,
  Database,
  Activity,
  Target,
  Zap,
  Globe,
  Mail,
  Phone,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Star,
  Layers,
  Maximize2,
  ChevronRight,
  Scan,
  Plus,
  Minus,
  Trash2,
  Receipt,
  Calculator,
  ArrowLeft,
  Home,
  Percent,
  X,
  Check,
  PieChart,
  LineChart,
  BarChart2,
  MousePointer,
  Monitor,
  Wifi,
  Server,
  HardDrive
} from 'lucide-react';
import { LineChart as RechartsLineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, PieChart as RechartsPieChart, Pie, Cell, RadialBarChart, RadialBar, ComposedChart } from 'recharts';

export default function Report() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDateRange, setSelectedDateRange] = useState('7days');
  const [selectedReport, setSelectedReport] = useState('overview');
  const [animatedValues, setAnimatedValues] = useState({});
  const [activePage, setActivePage] = useState('report');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      [0, 1, 2, 3, 4, 5].forEach((index) => {
        setTimeout(() => {
          setAnimatedValues(prev => ({
            ...prev,
            [index]: true
          }));
        }, index * 100);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Sample data for analytics
  const salesTrendData = [
    { date: '2025-01-24', sales: 45600, orders: 124, customers: 89, avgOrder: 367.74 },
    { date: '2025-01-25', sales: 52300, orders: 143, customers: 98, avgOrder: 365.73 },
    { date: '2025-01-26', sales: 48900, orders: 132, customers: 95, avgOrder: 370.45 },
    { date: '2025-01-27', sales: 58700, orders: 156, customers: 112, avgOrder: 376.28 },
    { date: '2025-01-28', sales: 63400, orders: 171, customers: 125, avgOrder: 370.76 },
    { date: '2025-01-29', sales: 67800, orders: 189, customers: 134, avgOrder: 358.73 },
    { date: '2025-01-30', sales: 72100, orders: 198, customers: 145, avgOrder: 364.14 }
  ];

  const stockAnalyticsData = [
    { category: 'Electronics', totalValue: 234500, items: 156, lowStock: 12, outOfStock: 3, turnover: 8.2 },
    { category: 'Clothing', totalValue: 189600, items: 324, lowStock: 18, outOfStock: 7, turnover: 12.4 },
    { category: 'Home & Garden', totalValue: 156700, items: 89, lowStock: 8, outOfStock: 2, turnover: 6.8 },
    { category: 'Books & Stationery', totalValue: 98400, items: 267, lowStock: 23, outOfStock: 9, turnover: 15.2 },
    { category: 'Sports & Recreation', totalValue: 134200, items: 78, lowStock: 5, outOfStock: 1, turnover: 9.7 },
    { category: 'Health & Beauty', totalValue: 87300, items: 143, lowStock: 14, outOfStock: 4, turnover: 11.3 }
  ];

  const posPerformanceData = [
    { terminal: 'Terminal 01', transactions: 234, revenue: 45600, avgTransaction: 194.87, uptime: 99.2, errors: 2 },
    { terminal: 'Terminal 02', transactions: 198, revenue: 38900, avgTransaction: 196.46, uptime: 98.7, errors: 4 },
    { terminal: 'Terminal 03', transactions: 267, revenue: 52300, avgTransaction: 195.88, uptime: 99.8, errors: 1 },
    { terminal: 'Terminal 04', transactions: 189, revenue: 36700, avgTransaction: 194.18, uptime: 97.3, errors: 8 },
    { terminal: 'Terminal 05', transactions: 156, revenue: 29800, avgTransaction: 191.03, uptime: 99.5, errors: 2 }
  ];

  const hourlyTransactionData = [
    { hour: '06:00', transactions: 12, revenue: 2340 },
    { hour: '07:00', transactions: 18, revenue: 3560 },
    { hour: '08:00', transactions: 34, revenue: 6780 },
    { hour: '09:00', transactions: 45, revenue: 8900 },
    { hour: '10:00', transactions: 67, revenue: 12400 },
    { hour: '11:00', transactions: 89, revenue: 16700 },
    { hour: '12:00', transactions: 123, revenue: 23400 },
    { hour: '13:00', transactions: 145, revenue: 27800 },
    { hour: '14:00', transactions: 167, revenue: 31200 },
    { hour: '15:00', transactions: 189, revenue: 35600 },
    { hour: '16:00', transactions: 198, revenue: 37900 },
    { hour: '17:00', transactions: 234, revenue: 44500 },
    { hour: '18:00', transactions: 267, revenue: 50800 },
    { hour: '19:00', transactions: 189, revenue: 36200 },
    { hour: '20:00', transactions: 123, revenue: 23100 },
    { hour: '21:00', transactions: 78, revenue: 14600 },
    { hour: '22:00', transactions: 34, revenue: 6400 }
  ];

  const paymentMethodData = [
    { method: 'Cash', value: 35, color: '#374151', amount: 126800 },
    { method: 'Credit Card', value: 28, color: '#4B5563', amount: 101400 },
    { method: 'Debit Card', value: 22, color: '#6B7280', amount: 79700 },
    { method: 'UPI/Digital', value: 12, color: '#9CA3AF', amount: 43500 },
    { method: 'Gift Voucher', value: 3, color: '#D1D5DB', amount: 10800 }
  ];

  const topSellingProducts = [
    { name: 'iPhone 15 Pro Max', category: 'Electronics', sold: 234, revenue: 234000, profit: 46800 },
    { name: 'Samsung Galaxy Watch', category: 'Electronics', sold: 189, revenue: 94500, profit: 28350 },
    { name: 'Nike Air Jordan', category: 'Clothing', sold: 156, revenue: 78000, profit: 31200 },
    { name: 'MacBook Pro M3', category: 'Electronics', sold: 78, revenue: 156000, profit: 31200 },
    { name: 'Adidas Running Shoes', category: 'Sports', sold: 267, revenue: 80100, profit: 24030 },
    { name: 'Sony Headphones', category: 'Electronics', sold: 198, revenue: 59400, profit: 17820 }
  ];

  const kpiMetrics = [
    { label: 'Total Revenue (7 Days)', value: '₹4.08M', target: '₹3.8M', variance: '+7.4%', trend: 'up', icon: DollarSign },
    { label: 'Total Transactions', value: '1,313', target: '1,200', variance: '+9.4%', trend: 'up', icon: Receipt },
    { label: 'Average Order Value', value: '₹368.42', target: '₹350', variance: '+5.3%', trend: 'up', icon: Calculator },
    { label: 'Customer Conversion', value: '68.4%', target: '65%', variance: '+3.4pp', trend: 'up', icon: Target },
    { label: 'Inventory Turnover', value: '10.6x', target: '9.5x', variance: '+11.6%', trend: 'up', icon: Package },
    { label: 'System Uptime', value: '98.9%', target: '98%', variance: '+0.9pp', trend: 'up', icon: Activity }
  ];

  const dateRangeOptions = [
    { value: '1day', label: 'Last 24 Hours' },
    { value: '7days', label: 'Last 7 Days' },
    { value: '30days', label: 'Last 30 Days' },
    { value: '3months', label: 'Last 3 Months' },
    { value: 'custom', label: 'Custom Range' }
  ];

  const reportCategories = [
    { value: 'overview', label: 'Executive Overview', icon: BarChart3 },
    { value: 'sales', label: 'Sales Analytics', icon: TrendingUp },
    { value: 'inventory', label: 'Stock Management', icon: Package },
    { value: 'pos', label: 'POS Performance', icon: Monitor },
    { value: 'financial', label: 'Financial Reports', icon: DollarSign },
    { value: 'customer', label: 'Customer Insights', icon: Users }
  ];

  const ProfessionalCard = ({ title, children, actions, className = "" }) => (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 ${className}`}>
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{title}</h3>
        {actions && <div className="flex items-center space-x-1">{actions}</div>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );

  const MetricCard = ({ metric, index }) => {
    const IconComponent = metric.icon;

    return (
      <div 
        className={`group bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-lg transition-all duration-500 hover:border-gray-300 hover:-translate-y-1 ${
          animatedValues[index] ? 'animate-in slide-in-from-bottom-2 fade-in duration-700' : 'opacity-0'
        }`}
        style={{ animationDelay: `${index * 100}ms` }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors duration-300">
            <IconComponent className="w-5 h-5 text-gray-700" />
          </div>
          <div className={`flex items-center text-sm font-medium ${metric.trend === 'up' ? 'text-gray-700' : 'text-gray-600'}`}>
            {metric.trend === 'up' ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
            {metric.variance}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{metric.label}</p>
          <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
          <p className="text-sm text-gray-600">Target: {metric.target}</p>
        </div>

        <div className="mt-4 h-1 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gray-800 transition-all duration-1000 ease-out"
            style={{ 
              width: '75%',
              transform: `translateX(${animatedValues[index] ? '0' : '-100%'})`
            }}
          ></div>
        </div>
      </div>
    );
  };

  const exportReport = (format) => {
    alert(`Exporting ${selectedReport} report in ${format.toUpperCase()} format...`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Professional Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => window.location.href = '/'}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg text-gray-700 hover:text-gray-900 transition-all duration-200 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <Home className="w-4 h-4" />
              <span className="text-sm">Return to Dashboard</span>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Advanced Reports & Analytics Center</h1>
              <p className="text-sm text-gray-600">Comprehensive Business Intelligence & Performance Metrics</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-gray-100 rounded-lg px-4 py-2 border border-gray-200">
              <Calendar className="w-4 h-4 text-gray-500" />
              <select 
                value={selectedDateRange} 
                onChange={(e) => setSelectedDateRange(e.target.value)}
                className="bg-transparent text-sm text-gray-700 border-none outline-none font-medium"
              >
                {dateRangeOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </div>
            
            <button 
              onClick={() => exportReport('pdf')}
              className="flex items-center space-x-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
            >
              <Download className="w-4 h-4" />
              <span>Export PDF</span>
            </button>
            
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
        {/* Report Category Navigation */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Report Categories</h3>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {reportCategories.map((category) => {
                const IconComponent = category.icon;
                return (
                  <button
                    key={category.value}
                    onClick={() => setSelectedReport(category.value)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      selectedReport === category.value
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span>{category.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Key Performance Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {kpiMetrics.map((metric, index) => (
            <MetricCard key={index} metric={metric} index={index} />
          ))}
        </div>

        {/* Main Analytics Dashboard */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Sales Trend Analysis */}
          <div className="xl:col-span-2">
            <ProfessionalCard 
              title="Sales Performance Analytics"
              actions={[
                <button key="view" className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                  <Eye className="w-4 h-4" />
                </button>,
                <button key="filter" className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                  <Filter className="w-4 h-4" />
                </button>,
                <button key="download" className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                  <Download className="w-4 h-4" />
                </button>
              ]}
            >
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={salesTrendData}>
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#374151" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#374151" stopOpacity={0.05}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#6B7280" 
                      fontSize={12} 
                      fontWeight={500}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis 
                      yAxisId="sales"
                      stroke="#6B7280" 
                      fontSize={12} 
                      fontWeight={500}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      yAxisId="orders"
                      orientation="right"
                      stroke="#6B7280" 
                      fontSize={12} 
                      fontWeight={500}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        color: '#111827'
                      }}
                      labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    />
                    <Area 
                      yAxisId="sales"
                      type="monotone" 
                      dataKey="sales" 
                      stroke="#374151" 
                      fill="url(#salesGradient)"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#374151', strokeWidth: 2, stroke: '#fff' }}
                    />
                    <Bar 
                      yAxisId="orders"
                      dataKey="orders" 
                      fill="#6B7280" 
                      radius={[2, 2, 0, 0]}
                      opacity={0.7}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </ProfessionalCard>
          </div>

          {/* Payment Methods Distribution */}
          <div>
            <ProfessionalCard title="Payment Methods Analysis">
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={paymentMethodData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {paymentMethodData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value, name, props) => [
                        `${value}% (₹${props.payload.amount.toLocaleString()})`,
                        name
                      ]}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-3">
                {paymentMethodData.map((method, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-sm mr-3" 
                        style={{ backgroundColor: method.color }}
                      ></div>
                      <span className="text-gray-700 font-medium">{method.method}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-gray-900">{method.value}%</span>
                      <div className="text-xs text-gray-600">₹{method.amount.toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </ProfessionalCard>
          </div>
        </div>

        {/* Hourly Transaction Analysis */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ProfessionalCard title="Hourly Transaction Pattern">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyTransactionData}>
                  <defs>
                    <linearGradient id="transactionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4B5563" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#4B5563" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="hour" 
                    stroke="#6B7280" 
                    fontSize={12}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#6B7280" 
                    fontSize={12}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="transactions" 
                    stroke="#4B5563" 
                    fill="url(#transactionGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ProfessionalCard>

          {/* Top Selling Products */}
          <ProfessionalCard title="Top Performing Products">
            <div className="space-y-4 max-h-64 overflow-y-auto">
              {topSellingProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors duration-200">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">#{index + 1}</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">{product.name}</h4>
                      <p className="text-xs text-gray-600">{product.category}</p>
                      <p className="text-xs text-gray-500">{product.sold} units sold</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-900">₹{product.revenue.toLocaleString()}</div>
                    <div className="text-xs text-green-600 font-medium">₹{product.profit.toLocaleString()} profit</div>
                  </div>
                </div>
              ))}
            </div>
          </ProfessionalCard>
        </div>

        {/* Stock Analytics & POS Performance */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Stock Analytics */}
          <ProfessionalCard title="Inventory Analytics by Category">
            <div className="space-y-4">
              {stockAnalyticsData.map((category, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900">{category.category}</h4>
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded font-medium">
                      {category.turnover}x turnover
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{category.items}</div>
                      <div className="text-xs text-gray-600">Total Items</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">₹{(category.totalValue / 1000).toFixed(0)}K</div>
                      <div className="text-xs text-gray-600">Total Value</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-amber-600">{category.lowStock}</div>
                      <div className="text-xs text-gray-600">Low Stock</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-red-600">{category.outOfStock}</div>
                      <div className="text-xs text-gray-600">Out of Stock</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ProfessionalCard>

          {/* POS Terminal Performance */}
          <ProfessionalCard title="POS Terminal Performance Analysis">
            <div className="space-y-4">
              {posPerformanceData.map((terminal, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                        <Monitor className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">{terminal.terminal}</h4>
                        <p className="text-xs text-gray-600">{terminal.transactions} transactions</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                        terminal.uptime >= 99 ? 'bg-green-100 text-green-800' :
                        terminal.uptime >= 97 ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {terminal.uptime}% Uptime
                      </span>
                      {terminal.errors > 0 && (
                        <span className="inline-block px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800">
                          {terminal.errors} Errors
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">₹{terminal.revenue.toLocaleString()}</div>
                      <div className="text-xs text-gray-600">Revenue</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">₹{terminal.avgTransaction.toFixed(2)}</div>
                      <div className="text-xs text-gray-600">Avg Transaction</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{terminal.transactions}</div>
                      <div className="text-xs text-gray-600">Total Transactions</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ProfessionalCard>
        </div>

        {/* Export Options & System Status */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Export Options */}
          <ProfessionalCard title="Export & Download Options">
            <div className="space-y-3">
              <button 
                onClick={() => exportReport('pdf')}
                className="w-full flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg text-sm font-medium transition-colors duration-200"
              >
                <FileText className="w-4 h-4" />
                <span>Export PDF Report</span>
              </button>
              <button 
                onClick={() => exportReport('excel')}
                className="w-full flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg text-sm font-medium transition-colors duration-200"
              >
                <Download className="w-4 h-4" />
                <span>Download Excel Data</span>
              </button>
              <button 
                onClick={() => exportReport('csv')}
                className="w-full flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg text-sm font-medium transition-colors duration-200"
              >
                <Database className="w-4 h-4" />
                <span>Export CSV Data</span>
              </button>
            </div>
          </ProfessionalCard>

          {/* System Health */}
          <ProfessionalCard title="System Health Status">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Database Connection</span>
                </div>
                <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded font-medium">ACTIVE</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Network Connectivity</span>
                </div>
                <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded font-medium">STABLE</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">Backup Status</span>
                </div>
                <span className="text-xs bg-amber-200 text-amber-800 px-2 py-1 rounded font-medium">PENDING</span>
              </div>
            </div>
          </ProfessionalCard>

          {/* Quick Actions */}
          <ProfessionalCard title="Quick Actions">
            <div className="space-y-3">
              <button className="w-full flex items-center justify-center space-x-2 bg-gray-900 hover:bg-gray-800 text-white py-3 px-4 rounded-lg text-sm font-medium transition-colors duration-200">
                <RefreshCw className="w-4 h-4" />
                <span>Refresh All Data</span>
              </button>
              <button className="w-full flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg text-sm font-medium transition-colors duration-200">
                <Settings className="w-4 h-4" />
                <span>Configure Reports</span>
              </button>
              <button className="w-full flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg text-sm font-medium transition-colors duration-200">
                <Bell className="w-4 h-4" />
                <span>Set Alert Thresholds</span>
              </button>
            </div>
          </ProfessionalCard>
        </div>

        {/* Professional Status Bar */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-gray-700" />
                <span className="text-gray-700 font-medium">Reports System: <span className="text-gray-900 font-semibold">Active</span></span>
              </div>
              <div className="flex items-center space-x-2">
                <Database className="w-5 h-5 text-gray-700" />
                <span className="text-gray-700 font-medium">Data Sync: <span className="text-gray-900 font-semibold">Real-time</span></span>
              </div>
              <div className="flex items-center space-x-2">
                <Server className="w-5 h-5 text-gray-700" />
                <span className="text-gray-700 font-medium">Processing: <span className="text-gray-900 font-semibold">Optimized</span></span>
              </div>
            </div>
            <div className="flex items-center space-x-8 text-gray-600">
              <span className="font-medium">Report Generated: {currentTime.toLocaleTimeString()}</span>
              <span className="font-medium">Analytics Engine v3.2.1</span>
              <span className="bg-gray-900 text-white px-3 py-1 rounded text-xs font-semibold">
                ENTERPRISE ANALYTICS
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}