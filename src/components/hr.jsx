import React, { useState, useEffect } from 'react';
import { logoutOrReturnToDepartmentSelector } from "../utils/authRedirect";
import { Users, Calendar, DollarSign, Clock, Plane, UserX, UserPlus, Building, Award, Settings, BarChart3, TrendingUp, AlertCircle, User, LogOut, Bell, X, Plus, Edit, Save, Search, Filter, Download, Upload } from 'lucide-react';

const HR = () => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('all');

  // State for form inputs
  const [formData, setFormData] = useState({});
  const [editingId, setEditingId] = useState(null);

  // Demo data with state management
  const [employees, setEmployees] = useState([
    { id: 1, name: 'John Smith', department: 'Engineering', position: 'Senior Developer', salary: 95000, status: 'Active', joinDate: '2022-03-15', email: 'john.smith@company.com', phone: '+1 (555) 123-4567' },
    { id: 2, name: 'Sarah Johnson', department: 'Marketing', position: 'Marketing Manager', salary: 78000, status: 'Active', joinDate: '2021-08-22', email: 'sarah.johnson@company.com', phone: '+1 (555) 234-5678' },
    { id: 3, name: 'Mike Chen', department: 'Sales', position: 'Sales Representative', salary: 65000, status: 'Active', joinDate: '2023-01-10', email: 'mike.chen@company.com', phone: '+1 (555) 345-6789' },
    { id: 4, name: 'Emily Davis', department: 'HR', position: 'HR Specialist', salary: 72000, status: 'Active', joinDate: '2022-11-05', email: 'emily.davis@company.com', phone: '+1 (555) 456-7890' },
    { id: 5, name: 'David Wilson', department: 'Finance', position: 'Financial Analyst', salary: 68000, status: 'On Leave', joinDate: '2021-06-18', email: 'david.wilson@company.com', phone: '+1 (555) 567-8901' },
  ]);

  const [departments, setDepartments] = useState([
    { id: 1, name: 'Engineering', employees: 15, budget: 1250000, manager: 'Alex Thompson', location: 'Building A' },
    { id: 2, name: 'Marketing', employees: 8, budget: 650000, manager: 'Lisa Parker', location: 'Building B' },
    { id: 3, name: 'Sales', employees: 12, budget: 800000, manager: 'Robert Brown', location: 'Building C' },
    { id: 4, name: 'HR', employees: 4, budget: 320000, manager: 'Jessica White', location: 'Building A' },
    { id: 5, name: 'Finance', employees: 6, budget: 480000, manager: 'Michael Green', location: 'Building B' },
  ]);

  const [attendance, setAttendance] = useState([
    { id: 1, employee: 'John Smith', date: '2025-11-07', checkIn: '09:00 AM', checkOut: '06:00 PM', hours: 8, status: 'Present' },
    { id: 2, employee: 'Sarah Johnson', date: '2025-11-07', checkIn: '08:30 AM', checkOut: '05:30 PM', hours: 8, status: 'Present' },
    { id: 3, employee: 'Mike Chen', date: '2025-11-07', checkIn: '09:15 AM', checkOut: '06:15 PM', hours: 8, status: 'Late' },
    { id: 4, employee: 'Emily Davis', date: '2025-11-07', checkIn: '-', checkOut: '-', hours: 0, status: 'Absent' },
    { id: 5, employee: 'David Wilson', date: '2025-11-07', checkIn: '-', checkOut: '-', hours: 0, status: 'On Leave' },
  ]);

  const [leaves, setLeaves] = useState([
    { id: 1, employee: 'David Wilson', type: 'Sick Leave', startDate: '2025-11-05', endDate: '2025-11-09', days: 5, status: 'Approved', reason: 'Medical treatment' },
    { id: 2, employee: 'Sarah Johnson', type: 'Vacation', startDate: '2025-12-15', endDate: '2025-12-22', days: 6, status: 'Pending', reason: 'Family vacation' },
    { id: 3, employee: 'Mike Chen', type: 'Personal Leave', startDate: '2025-11-20', endDate: '2025-11-20', days: 1, status: 'Approved', reason: 'Personal matters' },
  ]);

  const [holidays, setHolidays] = useState([
    { id: 1, date: '2025-12-25', name: 'Christmas Day', type: 'Federal Holiday', description: 'National celebration' },
    { id: 2, date: '2026-01-01', name: 'New Year Day', type: 'Federal Holiday', description: 'New year celebration' },
    { id: 3, date: '2026-01-26', name: 'Republic Day', type: 'National Holiday', description: 'Indian national day' },
  ]);

  const [salaries, setSalaries] = useState([
    { id: 1, employee: 'John Smith', basicSalary: 95000, allowances: 15000, deductions: 8000, netSalary: 102000, month: 'November 2025' },
    { id: 2, employee: 'Sarah Johnson', basicSalary: 78000, allowances: 12000, deductions: 6500, netSalary: 83500, month: 'November 2025' },
    { id: 3, employee: 'Mike Chen', basicSalary: 65000, allowances: 10000, deductions: 5500, netSalary: 69500, month: 'November 2025' },
  ]);

  const [recruitments, setRecruitments] = useState([
    { id: 1, position: 'Senior Developer', department: 'Engineering', applicants: 45, status: 'Open', postedDate: '2025-10-15' },
    { id: 2, position: 'Marketing Specialist', department: 'Marketing', applicants: 28, status: 'In Progress', postedDate: '2025-10-20' },
    { id: 3, position: 'Sales Manager', department: 'Sales', applicants: 62, status: 'Open', postedDate: '2025-11-01' },
  ]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.user-dropdown')) {
        setShowUserDropdown(false);
      }
    };

    if (showUserDropdown) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showUserDropdown]);

  const handleLogout = () => logoutOrReturnToDepartmentSelector();

  // Generic form handlers
  const openModal = (type, data = null) => {
    setModalType(type);
    setShowModal(true);
    if (data) {
      setFormData(data);
      setEditingId(data.id);
    } else {
      setFormData({});
      setEditingId(null);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setFormData({});
    setEditingId(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    switch(modalType) {
      case 'employee':
        if (editingId) {
          setEmployees(prev => prev.map(emp => emp.id === editingId ? { ...formData, id: editingId } : emp));
        } else {
          setEmployees(prev => [...prev, { ...formData, id: Date.now() }]);
        }
        break;
      case 'department':
        if (editingId) {
          setDepartments(prev => prev.map(dept => dept.id === editingId ? { ...formData, id: editingId } : dept));
        } else {
          setDepartments(prev => [...prev, { ...formData, id: Date.now() }]);
        }
        break;
      case 'attendance':
        if (editingId) {
          setAttendance(prev => prev.map(att => att.id === editingId ? { ...formData, id: editingId } : att));
        } else {
          setAttendance(prev => [...prev, { ...formData, id: Date.now() }]);
        }
        break;
      case 'leave':
        if (editingId) {
          setLeaves(prev => prev.map(leave => leave.id === editingId ? { ...formData, id: editingId } : leave));
        } else {
          setLeaves(prev => [...prev, { ...formData, id: Date.now() }]);
        }
        break;
      case 'holiday':
        if (editingId) {
          setHolidays(prev => prev.map(holiday => holiday.id === editingId ? { ...formData, id: editingId } : holiday));
        } else {
          setHolidays(prev => [...prev, { ...formData, id: Date.now() }]);
        }
        break;
      case 'salary':
        if (editingId) {
          setSalaries(prev => prev.map(salary => salary.id === editingId ? { ...formData, id: editingId } : salary));
        } else {
          setSalaries(prev => [...prev, { ...formData, id: Date.now() }]);
        }
        break;
      case 'recruitment':
        if (editingId) {
          setRecruitments(prev => prev.map(rec => rec.id === editingId ? { ...formData, id: editingId } : rec));
        } else {
          setRecruitments(prev => [...prev, { ...formData, id: Date.now() }]);
        }
        break;
    }
    
    closeModal();
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'salary', label: 'Salary', icon: DollarSign },
    { id: 'leaves', label: 'Leaves', icon: Calendar },
    { id: 'holidays', label: 'Holidays', icon: Plane },
    { id: 'recruitment', label: 'Recruitment', icon: UserPlus },
    { id: 'departments', label: 'Departments', icon: Building },
    { id: 'settings', label: 'HR Settings', icon: Settings },
  ];

  // Modal Component
  const Modal = ({ children }) => {
    if (!showModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {children}
        </div>
      </div>
    );
  };

  // Employee Form
  const EmployeeForm = () => (
    <form onSubmit={handleSubmit}>
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">{editingId ? 'Edit Employee' : 'Add New Employee'}</h3>
          <button type="button" onClick={closeModal} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              name="name"
              value={formData.name || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select
              name="department"
              value={formData.department || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select Department</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.name}>{dept.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
            <input
              type="text"
              name="position"
              value={formData.position || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Salary</label>
            <input
              type="number"
              name="salary"
              value={formData.salary || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Join Date</label>
            <input
              type="date"
              name="joinDate"
              value={formData.joinDate || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              name="status"
              value={formData.status || 'Active'}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Active">Active</option>
              <option value="On Leave">On Leave</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>
      <div className="p-6 border-t flex justify-end space-x-3">
        <button
          type="button"
          onClick={closeModal}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center space-x-2"
        >
          <Save className="w-4 h-4" />
          <span>{editingId ? 'Update' : 'Save'}</span>
        </button>
      </div>
    </form>
  );

  // Department Form
  const DepartmentForm = () => (
    <form onSubmit={handleSubmit}>
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">{editingId ? 'Edit Department' : 'Add New Department'}</h3>
          <button type="button" onClick={closeModal} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Department Name</label>
          <input
            type="text"
            name="name"
            value={formData.name || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Manager</label>
            <input
              type="text"
              name="manager"
              value={formData.manager || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              name="location"
              value={formData.location || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Number of Employees</label>
            <input
              type="number"
              name="employees"
              value={formData.employees || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
            <input
              type="number"
              name="budget"
              value={formData.budget || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
        </div>
      </div>
      <div className="p-6 border-t flex justify-end space-x-3">
        <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center space-x-2">
          <Save className="w-4 h-4" />
          <span>{editingId ? 'Update' : 'Save'}</span>
        </button>
      </div>
    </form>
  );

  // Attendance Form
  const AttendanceForm = () => (
    <form onSubmit={handleSubmit}>
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">{editingId ? 'Edit Attendance' : 'Mark Attendance'}</h3>
          <button type="button" onClick={closeModal} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
          <select
            name="employee"
            value={formData.employee || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Select Employee</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.name}>{emp.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            name="date"
            value={formData.date || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Check In</label>
            <input
              type="time"
              name="checkIn"
              value={formData.checkIn || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Check Out</label>
            <input
              type="time"
              name="checkOut"
              value={formData.checkOut || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hours Worked</label>
            <input
              type="number"
              name="hours"
              value={formData.hours || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              name="status"
              value={formData.status || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select Status</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Absent">Absent</option>
              <option value="On Leave">On Leave</option>
            </select>
          </div>
        </div>
      </div>
      <div className="p-6 border-t flex justify-end space-x-3">
        <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center space-x-2">
          <Save className="w-4 h-4" />
          <span>{editingId ? 'Update' : 'Save'}</span>
        </button>
      </div>
    </form>
  );

  // Leave Form
  const LeaveForm = () => (
    <form onSubmit={handleSubmit}>
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">{editingId ? 'Edit Leave Request' : 'New Leave Request'}</h3>
          <button type="button" onClick={closeModal} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
          <select
            name="employee"
            value={formData.employee || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Select Employee</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.name}>{emp.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
          <select
            name="type"
            value={formData.type || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Select Type</option>
            <option value="Sick Leave">Sick Leave</option>
            <option value="Vacation">Vacation</option>
            <option value="Personal Leave">Personal Leave</option>
            <option value="Maternity Leave">Maternity Leave</option>
            <option value="Paternity Leave">Paternity Leave</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              name="endDate"
              value={formData.endDate || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Number of Days</label>
          <input
            type="number"
            name="days"
            value={formData.days || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
          <textarea
            name="reason"
            value={formData.reason || ''}
            onChange={handleInputChange}
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            name="status"
            value={formData.status || 'Pending'}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>
      <div className="p-6 border-t flex justify-end space-x-3">
        <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center space-x-2">
          <Save className="w-4 h-4" />
          <span>{editingId ? 'Update' : 'Submit'}</span>
        </button>
      </div>
    </form>
  );

  // Holiday Form
  const HolidayForm = () => (
    <form onSubmit={handleSubmit}>
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">{editingId ? 'Edit Holiday' : 'Add New Holiday'}</h3>
          <button type="button" onClick={closeModal} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Holiday Name</label>
          <input
            type="text"
            name="name"
            value={formData.name || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            name="date"
            value={formData.date || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            name="type"
            value={formData.type || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Select Type</option>
            <option value="Federal Holiday">Federal Holiday</option>
            <option value="National Holiday">National Holiday</option>
            <option value="Company Holiday">Company Holiday</option>
            <option value="Optional Holiday">Optional Holiday</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            name="description"
            value={formData.description || ''}
            onChange={handleInputChange}
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
      <div className="p-6 border-t flex justify-end space-x-3">
        <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center space-x-2">
          <Save className="w-4 h-4" />
          <span>{editingId ? 'Update' : 'Save'}</span>
        </button>
      </div>
    </form>
  );

  // Salary Form
  const SalaryForm = () => (
    <form onSubmit={handleSubmit}>
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">{editingId ? 'Edit Salary Record' : 'Add Salary Record'}</h3>
          <button type="button" onClick={closeModal} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
          <select
            name="employee"
            value={formData.employee || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Select Employee</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.name}>{emp.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
          <input
            type="text"
            name="month"
            value={formData.month || ''}
            onChange={handleInputChange}
            placeholder="e.g., November 2025"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Basic Salary</label>
            <input
              type="number"
              name="basicSalary"
              value={formData.basicSalary || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Allowances</label>
            <input
              type="number"
              name="allowances"
              value={formData.allowances || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deductions</label>
            <input
              type="number"
              name="deductions"
              value={formData.deductions || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Net Salary</label>
            <input
              type="number"
              name="netSalary"
              value={formData.netSalary || (Number(formData.basicSalary || 0) + Number(formData.allowances || 0) - Number(formData.deductions || 0))}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              readOnly
            />
          </div>
        </div>
      </div>
      <div className="p-6 border-t flex justify-end space-x-3">
        <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center space-x-2">
          <Save className="w-4 h-4" />
          <span>{editingId ? 'Update' : 'Save'}</span>
        </button>
      </div>
    </form>
  );

  // Recruitment Form
  const RecruitmentForm = () => (
    <form onSubmit={handleSubmit}>
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">{editingId ? 'Edit Job Posting' : 'Create Job Posting'}</h3>
          <button type="button" onClick={closeModal} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Position Title</label>
          <input
            type="text"
            name="position"
            value={formData.position || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
          <select
            name="department"
            value={formData.department || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Select Department</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.name}>{dept.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Number of Applicants</label>
            <input
              type="number"
              name="applicants"
              value={formData.applicants || '0'}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              name="status"
              value={formData.status || 'Open'}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Posted Date</label>
          <input
            type="date"
            name="postedDate"
            value={formData.postedDate || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
      </div>
      <div className="p-6 border-t flex justify-end space-x-3">
        <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center space-x-2">
          <Save className="w-4 h-4" />
          <span>{editingId ? 'Update' : 'Post Job'}</span>
        </button>
      </div>
    </form>
  );

  // Dashboard View
  const DashboardView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-blue-500 text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Total Employees</h3>
              <p className="text-3xl font-bold">{employees.length}</p>
            </div>
            <Users className="w-12 h-12 opacity-80" />
          </div>
        </div>
        <div className="bg-green-500 text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Present Today</h3>
              <p className="text-3xl font-bold">{attendance.filter(a => a.status === 'Present' || a.status === 'Late').length}</p>
            </div>
            <Clock className="w-12 h-12 opacity-80" />
          </div>
        </div>
        <div className="bg-orange-500 text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">On Leave</h3>
              <p className="text-3xl font-bold">{attendance.filter(a => a.status === 'On Leave').length}</p>
            </div>
            <Calendar className="w-12 h-12 opacity-80" />
          </div>
        </div>
        <div className="bg-purple-500 text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Departments</h3>
              <p className="text-3xl font-bold">{departments.length}</p>
            </div>
            <Building className="w-12 h-12 opacity-80" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-4">Recent Activities</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span className="text-sm">New employee John Smith joined Engineering department</span>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-green-50 rounded">
              <Calendar className="w-5 h-5 text-green-600" />
              <span className="text-sm">Leave request approved for David Wilson</span>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-orange-50 rounded">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <span className="text-sm">Pending leave approval for Sarah Johnson</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-4">Department Overview</h3>
          <div className="space-y-3">
            {departments.slice(0, 5).map(dept => (
              <div key={dept.id} className="flex justify-between items-center p-2 border-b">
                <span className="font-medium">{dept.name}</span>
                <span className="text-sm text-gray-600">{dept.employees} employees</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Employees View
  const EmployeesView = () => {
    const filteredEmployees = employees.filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           emp.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDept = filterDept === 'all' || emp.department === filterDept;
      return matchesSearch && matchesDept;
    });

    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Employee Management</h2>
            <button
              onClick={() => openModal('employee')}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Employee</span>
            </button>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Departments</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.name}>{dept.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salary</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredEmployees.map(employee => (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium">{employee.name}</div>
                      <div className="text-sm text-gray-500">{employee.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">{employee.department}</td>
                  <td className="px-6 py-4">{employee.position}</td>
                  <td className="px-6 py-4">${employee.salary.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      employee.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {employee.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => openModal('employee', employee)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Attendance View
  const AttendanceView = () => (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Attendance Tracking</h2>
          <button
            onClick={() => openModal('attendance')}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Mark Attendance</span>
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check In</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check Out</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {attendance.map((record) => (
              <tr key={record.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">{record.employee}</td>
                <td className="px-6 py-4">{record.date}</td>
                <td className="px-6 py-4">{record.checkIn}</td>
                <td className="px-6 py-4">{record.checkOut}</td>
                <td className="px-6 py-4">{record.hours}h</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    record.status === 'Present' ? 'bg-green-100 text-green-800' :
                    record.status === 'Late' ? 'bg-yellow-100 text-yellow-800' :
                    record.status === 'Absent' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {record.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => openModal('attendance', record)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Salary View
  const SalaryView = () => (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Salary Management</h2>
          <button
            onClick={() => openModal('salary')}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Salary Record</span>
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Basic Salary</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Allowances</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deductions</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net Salary</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {salaries.map((salary) => (
              <tr key={salary.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">{salary.employee}</td>
                <td className="px-6 py-4">{salary.month}</td>
                <td className="px-6 py-4">${salary.basicSalary.toLocaleString()}</td>
                <td className="px-6 py-4 text-green-600">${salary.allowances.toLocaleString()}</td>
                <td className="px-6 py-4 text-red-600">${salary.deductions.toLocaleString()}</td>
                <td className="px-6 py-4 font-semibold">${salary.netSalary.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => openModal('salary', salary)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Leaves View
  const LeavesView = () => (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Leave Management</h2>
          <button
            onClick={() => openModal('leave')}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Request Leave</span>
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {leaves.map((leave) => (
              <tr key={leave.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">{leave.employee}</td>
                <td className="px-6 py-4">{leave.type}</td>
                <td className="px-6 py-4">{leave.startDate}</td>
                <td className="px-6 py-4">{leave.endDate}</td>
                <td className="px-6 py-4">{leave.days}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    leave.status === 'Approved' ? 'bg-green-100 text-green-800' : 
                    leave.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {leave.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => openModal('leave', leave)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Departments View
  const DepartmentsView = () => (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => openModal('department')}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Department</span>
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map(dept => (
          <div key={dept.id} className="bg-white border rounded-lg p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">{dept.name}</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => openModal('department', dept)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <Building className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            <div className="space-y-2">
              <p><span className="font-medium">Manager:</span> {dept.manager}</p>
              <p><span className="font-medium">Location:</span> {dept.location}</p>
              <p><span className="font-medium">Employees:</span> {dept.employees}</p>
              <p><span className="font-medium">Budget:</span> ${dept.budget.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Holidays View
  const HolidaysView = () => (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => openModal('holiday')}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Holiday</span>
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {holidays.map((holiday) => (
          <div key={holiday.id} className="bg-white border rounded-lg p-4 flex items-center justify-between hover:shadow-lg transition-shadow">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-full">
                <Plane className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold">{holiday.name}</h3>
                <p className="text-sm text-gray-600">{holiday.date}</p>
                <p className="text-xs text-gray-500">{holiday.type}</p>
              </div>
            </div>
            <button
              onClick={() => openModal('holiday', holiday)}
              className="text-blue-600 hover:text-blue-800"
            >
              <Edit className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  // Recruitment View
  const RecruitmentView = () => (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => openModal('recruitment')}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Create Job Posting</span>
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recruitments.map(rec => (
          <div key={rec.id} className="bg-white border rounded-lg p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">{rec.position}</h3>
              <button
                onClick={() => openModal('recruitment', rec)}
                className="text-blue-600 hover:text-blue-800"
              >
                <Edit className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <p><span className="font-medium">Department:</span> {rec.department}</p>
              <p><span className="font-medium">Applicants:</span> {rec.applicants}</p>
              <p><span className="font-medium">Posted:</span> {rec.postedDate}</p>
              <p>
                <span className="font-medium">Status:</span>{' '}
                <span className={`px-2 py-1 rounded-full text-xs ${
                  rec.status === 'Open' ? 'bg-green-100 text-green-800' :
                  rec.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {rec.status}
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderContent = () => {
    switch(activeSection) {
      case 'dashboard': return <DashboardView />;
      case 'employees': return <EmployeesView />;
      case 'attendance': return <AttendanceView />;
      case 'salary': return <SalaryView />;
      case 'leaves': return <LeavesView />;
      case 'departments': return <DepartmentsView />;
      case 'holidays': return <HolidaysView />;
      case 'recruitment': return <RecruitmentView />;
      default: return <DashboardView />;
    }
  };

  const renderModalContent = () => {
    switch(modalType) {
      case 'employee': return <EmployeeForm />;
      case 'department': return <DepartmentForm />;
      case 'attendance': return <AttendanceForm />;
      case 'leave': return <LeaveForm />;
      case 'holiday': return <HolidayForm />;
      case 'salary': return <SalaryForm />;
      case 'recruitment': return <RecruitmentForm />;
      default: return null;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-sky-400 text-white flex flex-col">
        <div className="p-6 text-center">
          <h1 className="text-xl font-bold">MENU</h1>
        </div>
        <nav className="flex-1">
          {menuItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center px-6 py-3 text-left hover:bg-sky-500 transition-colors ${
                  activeSection === item.id ? 'bg-sky-500 border-r-4 border-white' : ''
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </button>
            );
          })}
        </nav>
        
        <div className="p-4 bg-sky-500">
          <div className="bg-white text-sky-600 px-3 py-2 rounded font-bold text-center">
            HR DEPARTMENT
          </div>
          <div className="mt-4 text-sm">
            <p>Dear RECRUITER,</p>
            <p className="mt-2">Congratulations</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">HR Management System</h2>
              <p className="text-sm text-gray-600">Human Resources Dashboard</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{new Date().toLocaleTimeString()}</span>
              </div>
              
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-all duration-200">
                <Bell className="h-5 w-5" />
              </button>
              
              {/* User Dropdown */}
              <div className="relative user-dropdown">
                <button 
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-all duration-200"
                >
                  <User className="h-5 w-5" />
                </button>
                
                {showUserDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">HR Admin</p>
                      <p className="text-xs text-gray-500">hr.admin@company.com</p>
                    </div>
                    <div className="py-1">
                      <button 
                        onClick={() => {
                          setActiveSection('settings');
                          setShowUserDropdown(false);
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                      >
                        <Settings className="w-4 h-4 mr-3" />
                        Account Settings
                      </button>
                      <button 
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200"
                      >
                        <LogOut className="w-4 h-4 mr-3" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="p-8">
          {renderContent()}
        </div>
      </div>

      {/* Modal */}
      <Modal>
        {renderModalContent()}
      </Modal>
    </div>
  );
};

export default HR;