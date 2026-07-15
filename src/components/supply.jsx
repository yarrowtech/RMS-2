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
  HardDrive,
  Factory,
  Warehouse,
  Route,
  Box,
  Timer,
  Shield,
  Gauge,
  Archive,
  Link,
  Navigation,
  Compass,
  Plane,
  Train
} from 'lucide-react';
import { LineChart as RechartsLineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, PieChart as RechartsPieChart, Pie, Cell, RadialBarChart, RadialBar, ComposedChart } from 'recharts';

export default function Supply() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDateRange, setSelectedDateRange] = useState('30days');
  const [selectedView, setSelectedView] = useState('overview');
  const [animatedValues, setAnimatedValues] = useState({});

  const handleNavigateHome = () => {
    // Navigate back to home route
    window.location.href = '/';
  };

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

  // Supply Chain Data
  const supplierPerformanceData = [
    { date: '2025-01-24', onTimeDelivery: 89, qualityScore: 94, costEfficiency: 87, totalOrders: 145 },
    { date: '2025-01-25', onTimeDelivery: 92, qualityScore: 91, costEfficiency: 89, totalOrders: 158 },
    { date: '2025-01-26', onTimeDelivery: 88, qualityScore: 96, costEfficiency: 92, totalOrders: 134 },
    { date: '2025-01-27', onTimeDelivery: 94, qualityScore: 89, costEfficiency: 85, totalOrders: 167 },
    { date: '2025-01-28', onTimeDelivery: 91, qualityScore: 93, costEfficiency: 88, totalOrders: 189 },
    { date: '2025-01-29', onTimeDelivery: 96, qualityScore: 95, costEfficiency: 90, totalOrders: 203 },
    { date: '2025-01-30', onTimeDelivery: 93, qualityScore: 97, costEfficiency: 94, totalOrders: 176 }
  ];

  const inventoryFlowData = [
    { stage: 'Raw Materials', inbound: 2340, outbound: 2180, buffer: 160, efficiency: 93.2 },
    { stage: 'Work in Progress', inbound: 2180, outbound: 2050, buffer: 130, efficiency: 94.0 },
    { stage: 'Finished Goods', inbound: 2050, outbound: 1980, buffer: 70, efficiency: 96.6 },
    { stage: 'Distribution', inbound: 1980, outbound: 1920, buffer: 60, efficiency: 97.0 },
    { stage: 'Retail', inbound: 1920, outbound: 1860, buffer: 60, efficiency: 96.9 }
  ];

  const transportationData = [
    { mode: 'Road Transport', percentage: 45, cost: 156780, emissions: 234, reliability: 92 },
    { mode: 'Rail Transport', percentage: 28, cost: 98450, emissions: 145, reliability: 96 },
    { mode: 'Air Freight', percentage: 12, cost: 89650, emissions: 456, reliability: 98 },
    { mode: 'Sea Freight', percentage: 15, cost: 67890, emissions: 89, reliability: 87 }
  ];

  const supplierData = [
    { name: 'Global Materials Ltd', category: 'Raw Materials', rating: 4.8, orders: 156, deliveryRate: 94, riskLevel: 'Low' },
    { name: 'Tech Components Inc', category: 'Electronics', rating: 4.6, orders: 234, deliveryRate: 91, riskLevel: 'Medium' },
    { name: 'Premium Packaging Co', category: 'Packaging', rating: 4.9, orders: 89, deliveryRate: 97, riskLevel: 'Low' },
    { name: 'Industrial Supplies Pro', category: 'Machinery', rating: 4.4, orders: 67, deliveryRate: 88, riskLevel: 'Medium' },
    { name: 'Quality Textiles Group', category: 'Textiles', rating: 4.7, orders: 123, deliveryRate: 95, riskLevel: 'Low' },
    { name: 'Chemical Solutions Ltd', category: 'Chemicals', rating: 4.2, orders: 45, deliveryRate: 85, riskLevel: 'High' }
  ];

  const purchaseOrderData = [
    { id: 'PO-2025-001', supplier: 'Global Materials Ltd', amount: 45600, status: 'Delivered', dueDate: '2025-02-15', progress: 100 },
    { id: 'PO-2025-002', supplier: 'Tech Components Inc', amount: 78900, status: 'In Transit', dueDate: '2025-02-10', progress: 75 },
    { id: 'PO-2025-003', supplier: 'Premium Packaging Co', amount: 23400, status: 'Processing', dueDate: '2025-02-08', progress: 45 },
    { id: 'PO-2025-004', supplier: 'Industrial Supplies Pro', amount: 56700, status: 'Pending', dueDate: '2025-02-20', progress: 20 },
    { id: 'PO-2025-005', supplier: 'Quality Textiles Group', amount: 34500, status: 'Confirmed', dueDate: '2025-02-12', progress: 60 }
  ];

  const kpiMetrics = [
    { label: 'Supply Chain Efficiency', value: '94.2%', target: '92%', variance: '+2.2pp', trend: 'up', icon: Gauge },
    { label: 'On-Time Delivery Rate', value: '91.8%', target: '90%', variance: '+1.8pp', trend: 'up', icon: Timer },
    { label: 'Total Procurement Cost', value: '$28.4M', target: '$30M', variance: '-5.3%', trend: 'up', icon: DollarSign },
    { label: 'Supplier Quality Score', value: '4.6/5', target: '4.5/5', variance: '+0.1', trend: 'up', icon: Star },
    { label: 'Inventory Turnover', value: '12.4x', target: '11x', variance: '+12.7%', trend: 'up', icon: RefreshCw },
    { label: 'Risk Mitigation Index', value: '87.3%', target: '85%', variance: '+2.3pp', trend: 'up', icon: Shield }
  ];

  const warehouseData = [
    { location: 'Mumbai Central', capacity: 85, utilization: 78, throughput: 2340, efficiency: 92.4, status: 'Optimal' },
    { location: 'Delhi North', capacity: 92, utilization: 89, throughput: 1980, efficiency: 89.7, status: 'Near Capacity' },
    { location: 'Bangalore Tech', capacity: 76, utilization: 65, throughput: 1560, efficiency: 94.2, status: 'Optimal' },
    { location: 'Chennai Port', capacity: 88, utilization: 82, throughput: 2100, efficiency: 91.8, status: 'Optimal' },
    { location: 'Kolkata East', capacity: 73, utilization: 68, throughput: 1340, efficiency: 88.5, status: 'Underutilized' }
  ];

  const dateRangeOptions = [
    { value: '7days', label: 'Last 7 Days' },
    { value: '30days', label: 'Last 30 Days' },
    { value: '3months', label: 'Last 3 Months' },
    { value: '6months', label: 'Last 6 Months' },
    { value: 'custom', label: 'Custom Range' }
  ];

  const viewOptions = [
    { value: 'overview', label: 'Executive Overview', icon: BarChart3 },
    { value: 'suppliers', label: 'Supplier Management', icon: Building2 },
    { value: 'logistics', label: 'Logistics & Transportation', icon: Truck },
    { value: 'warehouses', label: 'Warehouse Operations', icon: Warehouse },
    { value: 'procurement', label: 'Procurement Analytics', icon: ShoppingCart },
    { value: 'risk', label: 'Risk Management', icon: Shield }
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
              width: '85%',
              transform: `translateX(${animatedValues[index] ? '0' : '-100%'})`
            }}
          ></div>
        </div>
      </div>
    );
  };

  const getStatusColor = (status) => {
    switch(status.toLowerCase()) {
      case 'delivered': case 'optimal': return 'bg-green-50 text-green-800 border-green-200';
      case 'in transit': case 'confirmed': case 'near capacity': return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'processing': case 'underutilized': return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'pending': return 'bg-gray-50 text-gray-800 border-gray-200';
      default: return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };

  const getRiskColor = (risk) => {
    switch(risk.toLowerCase()) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-amber-100 text-amber-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const exportData = (format) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `supply-chain-report-${timestamp}`;

    switch(format.toLowerCase()) {
      case 'csv':
        exportCSV(filename);
        break;
      case 'excel':
        exportExcel(filename);
        break;
      case 'pdf':
        exportPDF(filename);
        break;
      default:
        alert(`Unsupported format: ${format}`);
    }
  };

  const exportCSV = (filename) => {
    let csvContent = "Supply Chain Management Report\n";
    csvContent += `Generated on: ${new Date().toLocaleString()}\n\n`;

    csvContent += "KEY PERFORMANCE INDICATORS\n";
    csvContent += "Metric,Current Value,Target,Variance,Status\n";
    kpiMetrics.forEach(metric => {
      csvContent += `"${metric.label}","${metric.value}","${metric.target}","${metric.variance}","${metric.trend}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert('CSV report exported successfully!');
  };

  const exportExcel = (filename) => {
    let excelContent = "SUPPLY CHAIN MANAGEMENT DASHBOARD REPORT\n";
    excelContent += `Report Generated: ${new Date().toLocaleString()}\n`;
    excelContent += `Date Range: ${selectedDateRange}\n\n`;

    const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert('Excel report exported successfully!');
  };

  const exportPDF = (filename) => {
    const reportWindow = window.open('', '_blank');
    const reportHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Supply Chain Management Report</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; margin: 20px; color: #333; }
          .header { text-align: center; border-bottom: 3px solid #374151; padding-bottom: 20px; margin-bottom: 30px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Supply Chain Management Report</h1>
          <p>Generated on: ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `;

    reportWindow.document.write(reportHTML);
    reportWindow.document.close();
    
    setTimeout(() => {
      reportWindow.print();
    }, 1000);
    
    alert('PDF report opened in new window. Use browser print to save as PDF.');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Professional Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={handleNavigateHome}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg text-gray-700 hover:text-gray-900 transition-all duration-200 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <Home className="w-4 h-4" />
              <span className="text-sm">Return to Dashboard</span>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Supply Chain Management Center</h1>
              <p className="text-sm text-gray-600">End-to-End Supply Chain Analytics & Operations Control</p>
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
              onClick={() => exportData('pdf')}
              className="flex items-center space-x-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
            >
              <Download className="w-4 h-4" />
              <span>Export Report</span>
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
        {/* View Selection */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Supply Chain Views</h3>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {viewOptions.map((view) => {
                const IconComponent = view.icon;
                return (
                  <button
                    key={view.value}
                    onClick={() => setSelectedView(view.value)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      selectedView === view.value
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span>{view.label}</span>
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

        {/* Supply Chain Performance Analytics */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Supplier Performance Trends */}
          <div className="xl:col-span-2">
            <ProfessionalCard 
              title="Supplier Performance Analytics"
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
                  <ComposedChart data={supplierPerformanceData}>
                    <defs>
                      <linearGradient id="deliveryGradient" x1="0" y1="0" x2="0" y2="1">
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
                      type="monotone" 
                      dataKey="onTimeDelivery" 
                      stroke="#374151" 
                      fill="url(#deliveryGradient)"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#374151', strokeWidth: 2, stroke: '#fff' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="qualityScore" 
                      stroke="#6B7280" 
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#6B7280' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="costEfficiency" 
                      stroke="#9CA3AF" 
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#9CA3AF' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex justify-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-700 rounded-full"></div>
                  <span className="text-gray-600">On-Time Delivery</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                  <span className="text-gray-600">Quality Score</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span className="text-gray-600">Cost Efficiency</span>
                </div>
              </div>
            </ProfessionalCard>
          </div>

          {/* Transportation Mode Distribution */}
          <div>
            <ProfessionalCard title="Transportation Mix Analysis">
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={transportationData.map((item, index) => ({
                        ...item,
                        color: ['#374151', '#4B5563', '#6B7280', '#9CA3AF'][index]
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="percentage"
                    >
                      {transportationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#374151', '#4B5563', '#6B7280', '#9CA3AF'][index]} />
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
                        `${value}% ($${props.payload.cost.toLocaleString()})`,
                        name
                      ]}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-3">
                {transportationData.map((transport, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-sm mr-3" 
                        style={{ backgroundColor: ['#374151', '#4B5563', '#6B7280', '#9CA3AF'][index] }}
                      ></div>
                      <span className="text-gray-700 font-medium">{transport.mode}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-gray-900">{transport.percentage}%</span>
                      <div className="text-xs text-gray-600">{transport.reliability}% reliable</div>
                    </div>
                  </div>
                ))}
              </div>
            </ProfessionalCard>
          </div>
        </div>

        {/* Inventory Flow & Warehouse Performance */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Inventory Flow Analysis */}
          <ProfessionalCard title="Supply Chain Flow Analysis">
            <div className="space-y-4">
              {inventoryFlowData.map((stage, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900">{stage.stage}</h4>
                    <span className={`text-xs px-2 py-1 rounded font-medium ${
                      stage.efficiency >= 95 ? 'bg-green-100 text-green-800' :
                      stage.efficiency >= 90 ? 'bg-amber-100 text-amber-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {stage.efficiency}% efficient
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{stage.inbound.toLocaleString()}</div>
                      <div className="text-xs text-gray-600">Inbound</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{stage.outbound.toLocaleString()}</div>
                      <div className="text-xs text-gray-600">Outbound</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{stage.buffer}</div>
                      <div className="text-xs text-gray-600">Buffer</div>
                    </div>
                    <div className="text-center">
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div 
                          className="bg-gray-800 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${stage.efficiency}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ProfessionalCard>

          {/* Warehouse Operations */}
          <ProfessionalCard title="Warehouse Operations Dashboard">
            <div className="space-y-4">
              {warehouseData.map((warehouse, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                        <Warehouse className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">{warehouse.location}</h4>
                        <p className="text-xs text-gray-600">{warehouse.throughput} units/day</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded border ${getStatusColor(warehouse.status)}`}>
                        {warehouse.status}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{warehouse.capacity}%</div>
                      <div className="text-xs text-gray-600">Capacity</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{warehouse.utilization}%</div>
                      <div className="text-xs text-gray-600">Utilization</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{warehouse.efficiency}%</div>
                      <div className="text-xs text-gray-600">Efficiency</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ProfessionalCard>
        </div>

        {/* Supplier Management & Purchase Orders */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Supplier Performance */}
          <ProfessionalCard title="Supplier Performance Management">
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {supplierData.map((supplier, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors duration-200">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-900 rounded-lg flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">{supplier.name}</h4>
                      <p className="text-xs text-gray-600">{supplier.category}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <div className="flex items-center space-x-1">
                          <Star className="w-3 h-3 text-yellow-500 fill-current" />
                          <span className="text-xs text-gray-600">{supplier.rating}</span>
                        </div>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-600">{supplier.orders} orders</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-900">{supplier.deliveryRate}%</div>
                    <div className="text-xs text-gray-600">On-time delivery</div>
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded mt-1 ${getRiskColor(supplier.riskLevel)}`}>
                      {supplier.riskLevel} Risk
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ProfessionalCard>

          {/* Purchase Orders Tracking */}
          <ProfessionalCard title="Purchase Orders Tracking">
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {purchaseOrderData.map((order, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">{order.id}</h4>
                      <p className="text-xs text-gray-600">{order.supplier}</p>
                      <p className="text-xs text-gray-500">Due: {new Date(order.dueDate).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-gray-900">${order.amount.toLocaleString()}</div>
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded border ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gray-800 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${order.progress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600 mt-2">
                    <span>Progress</span>
                    <span>{order.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          </ProfessionalCard>
        </div>

        {/* Quick Actions & System Status */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <ProfessionalCard title="Supply Chain Actions">
            <div className="space-y-3">
              <button className="w-full flex items-center justify-center space-x-2 bg-gray-900 hover:bg-gray-800 text-white py-3 px-4 rounded-lg text-sm font-medium transition-colors duration-200">
                <Plus className="w-4 h-4" />
                <span>Create Purchase Order</span>
              </button>
              <button className="w-full flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg text-sm font-medium transition-colors duration-200">
                <Building2 className="w-4 h-4" />
                <span>Add New Supplier</span>
              </button>
              <button className="w-full flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg text-sm font-medium transition-colors duration-200">
                <Truck className="w-4 h-4" />
                <span>Track Shipments</span>
              </button>
            </div>
          </ProfessionalCard>

          {/* System Health */}
          <ProfessionalCard title="Supply Chain System Status">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800">ERP Integration</span>
                </div>
                <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded font-medium">ACTIVE</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Supplier Network</span>
                </div>
                <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded font-medium">CONNECTED</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">Risk Assessment</span>
                </div>
                <span className="text-xs bg-amber-200 text-amber-800 px-2 py-1 rounded font-medium">MONITORING</span>
              </div>
            </div>
          </ProfessionalCard>

          {/* Export Options */}
          <ProfessionalCard title="Data Export & Reports">
            <div className="space-y-3">
              <button 
                onClick={() => exportData('pdf')}
                className="w-full flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg text-sm font-medium transition-colors duration-200"
              >
                <FileText className="w-4 h-4" />
                <span>Export Supply Chain Report</span>
              </button>
              <button 
                onClick={() => exportData('excel')}
                className="w-full flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg text-sm font-medium transition-colors duration-200"
              >
                <Download className="w-4 h-4" />
                <span>Download Supplier Data</span>
              </button>
              <button 
                onClick={() => exportData('csv')}
                className="w-full flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg text-sm font-medium transition-colors duration-200"
              >
                <Database className="w-4 h-4" />
                <span>Export Logistics Data</span>
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
                <span className="text-gray-700 font-medium">Supply Chain Status: <span className="text-gray-900 font-semibold">Operational</span></span>
              </div>
              <div className="flex items-center space-x-2">
                <Globe className="w-5 h-5 text-gray-700" />
                <span className="text-gray-700 font-medium">Global Network: <span className="text-gray-900 font-semibold">Connected</span></span>
              </div>
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-gray-700" />
                <span className="text-gray-700 font-medium">Risk Level: <span className="text-gray-900 font-semibold">Low</span></span>
              </div>
            </div>
            <div className="flex items-center space-x-8 text-gray-600">
              <span className="font-medium">Last Updated: {currentTime.toLocaleTimeString()}</span>
              <span className="font-medium">SCM Platform v2.8.4</span>
              <span className="bg-gray-900 text-white px-3 py-1 rounded text-xs font-semibold">
                SUPPLY CHAIN COMMAND CENTER
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}