import React, { useState } from 'react';
import {
  Cpu, Users, FolderGit2, Settings, Shield, Database,
  Plus, Save, Trash2, Edit, Search, Filter, ChevronRight,
  Upload, X, Check, LayoutDashboard, Monitor, HardDrive,
  Activity, Bell, Clock, Calendar, User, Mail, Phone,
  AlertTriangle, CheckCircle, XCircle, RefreshCw, Download,
  FileText, Wrench, Code, Server, Wifi, Lock, Key,
  GitBranch, Package, Zap, TrendingUp, BarChart3, Eye
} from 'lucide-react';

export function IT() {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  // People/Team Management State
  const [team, setTeam] = useState([
    {
      id: 1,
      name: 'Alex Thompson',
      role: 'IT Manager',
      email: 'alex.thompson@company.com',
      phone: '+1234567890',
      department: 'IT',
      skills: ['Leadership', 'Project Management', 'Cloud Architecture'],
      status: 'active',
      joinDate: '2020-01-15',
      projects: ['ERP Migration', 'Cloud Infrastructure'],
      photo: '/api/placeholder/100/100'
    },
    {
      id: 2,
      name: 'Sarah Chen',
      role: 'Senior Developer',
      email: 'sarah.chen@company.com',
      phone: '+0987654321',
      department: 'IT',
      skills: ['React', 'Node.js', 'Python', 'Database Design'],
      status: 'active',
      joinDate: '2021-03-20',
      projects: ['Inventory System', 'Mobile App'],
      photo: '/api/placeholder/100/100'
    },
    {
      id: 3,
      name: 'Mike Rodriguez',
      role: 'Network Administrator',
      email: 'mike.rodriguez@company.com',
      phone: '+1122334455',
      department: 'IT',
      skills: ['Network Security', 'Cisco', 'Firewall Management'],
      status: 'active',
      joinDate: '2019-07-10',
      projects: ['Network Upgrade', 'Security Audit'],
      photo: '/api/placeholder/100/100'
    }
  ]);

  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPerson, setNewPerson] = useState({
    name: '',
    role: '',
    email: '',
    phone: '',
    department: 'IT',
    skills: '',
    status: 'active'
  });

  // Projects State
  const [projects, setProjects] = useState([
    {
      id: 1,
      name: 'ERP System Migration',
      description: 'Migrate legacy ERP to cloud-based solution',
      status: 'in-progress',
      priority: 'high',
      startDate: '2024-10-01',
      endDate: '2025-03-31',
      progress: 45,
      teamMembers: ['Alex Thompson', 'Sarah Chen'],
      budget: 500000,
      spent: 225000,
      tags: ['Cloud', 'ERP', 'Migration'],
      updates: [
        { date: '2024-11-01', update: 'Phase 1 completed successfully', by: 'Alex Thompson' },
        { date: '2024-10-15', update: 'Started data migration process', by: 'Sarah Chen' }
      ]
    },
    {
      id: 2,
      name: 'Network Infrastructure Upgrade',
      description: 'Upgrade network equipment and implement new security protocols',
      status: 'planning',
      priority: 'medium',
      startDate: '2024-12-01',
      endDate: '2025-02-28',
      progress: 10,
      teamMembers: ['Mike Rodriguez'],
      budget: 200000,
      spent: 20000,
      tags: ['Network', 'Security', 'Infrastructure'],
      updates: [
        { date: '2024-11-05', update: 'Equipment procurement initiated', by: 'Mike Rodriguez' }
      ]
    },
    {
      id: 3,
      name: 'Mobile App Development',
      description: 'Develop mobile application for inventory management',
      status: 'in-progress',
      priority: 'high',
      startDate: '2024-09-15',
      endDate: '2025-01-15',
      progress: 60,
      teamMembers: ['Sarah Chen'],
      budget: 150000,
      spent: 90000,
      tags: ['Mobile', 'Development', 'Inventory'],
      updates: [
        { date: '2024-11-08', update: 'Beta version released for testing', by: 'Sarah Chen' },
        { date: '2024-10-20', update: 'UI/UX design completed', by: 'Sarah Chen' }
      ]
    }
  ]);

  const [showAddProject, setShowAddProject] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    status: 'planning',
    priority: 'medium',
    startDate: '',
    endDate: '',
    teamMembers: [],
    budget: '',
    tags: ''
  });

  const [selectedProject, setSelectedProject] = useState(null);
  const [projectUpdate, setProjectUpdate] = useState('');

  // Change Requests State
  const [changeRequests, setChangeRequests] = useState([
    {
      id: 'CR-001',
      title: 'Add Two-Factor Authentication',
      requestedBy: 'Security Team',
      date: '2024-11-01',
      priority: 'high',
      status: 'approved',
      category: 'security',
      description: 'Implement 2FA for all user accounts',
      impact: 'High - affects all users',
      estimatedHours: 40,
      assignedTo: 'Sarah Chen',
      approver: 'Alex Thompson',
      implementationDate: '2024-11-20'
    },
    {
      id: 'CR-002',
      title: 'Database Performance Optimization',
      requestedBy: 'Operations Team',
      date: '2024-11-05',
      priority: 'medium',
      status: 'pending',
      category: 'database',
      description: 'Optimize database queries and add indexing',
      impact: 'Medium - improves system performance',
      estimatedHours: 24,
      assignedTo: null,
      approver: null,
      implementationDate: null
    },
    {
      id: 'CR-003',
      title: 'New Report Module',
      requestedBy: 'Finance Department',
      date: '2024-11-03',
      priority: 'low',
      status: 'in-review',
      category: 'feature',
      description: 'Add custom reporting capabilities',
      impact: 'Low - new feature addition',
      estimatedHours: 60,
      assignedTo: null,
      approver: null,
      implementationDate: null
    }
  ]);

  const [showAddChangeRequest, setShowAddChangeRequest] = useState(false);
  const [newChangeRequest, setNewChangeRequest] = useState({
    title: '',
    requestedBy: '',
    priority: 'medium',
    category: 'feature',
    description: '',
    impact: '',
    estimatedHours: ''
  });

  // System Updates/Holdings State
  const [systemUpdates, setSystemUpdates] = useState([
    {
      id: 1,
      system: 'Production Server',
      type: 'security-patch',
      version: 'v2.4.1',
      status: 'scheduled',
      scheduledDate: '2024-11-15',
      duration: '2 hours',
      description: 'Critical security patches and bug fixes',
      downtime: true,
      affectedUsers: 'All users',
      performedBy: null,
      notes: 'Scheduled during off-peak hours'
    },
    {
      id: 2,
      system: 'Database Server',
      type: 'upgrade',
      version: 'PostgreSQL 15.2',
      status: 'completed',
      scheduledDate: '2024-11-01',
      duration: '4 hours',
      description: 'Database version upgrade',
      downtime: true,
      affectedUsers: 'Backend systems',
      performedBy: 'Mike Rodriguez',
      completedDate: '2024-11-01',
      notes: 'Completed successfully without issues'
    },
    {
      id: 3,
      system: 'Email Server',
      type: 'maintenance',
      version: null,
      status: 'in-progress',
      scheduledDate: '2024-11-08',
      duration: '1 hour',
      description: 'Routine maintenance and cleanup',
      downtime: false,
      affectedUsers: 'None',
      performedBy: 'Alex Thompson',
      notes: 'No downtime expected'
    }
  ]);

  const [showAddUpdate, setShowAddUpdate] = useState(false);
  const [newUpdate, setNewUpdate] = useState({
    system: '',
    type: 'maintenance',
    version: '',
    scheduledDate: '',
    duration: '',
    description: '',
    downtime: false,
    affectedUsers: '',
    notes: ''
  });

  // Data Input/Forms State
  const [dataForms, setDataForms] = useState([
    {
      id: 1,
      name: 'Hardware Asset Entry',
      category: 'assets',
      fields: ['Asset Type', 'Serial Number', 'Purchase Date', 'Assigned To', 'Location', 'Warranty End']
    },
    {
      id: 2,
      name: 'Software License Registration',
      category: 'software',
      fields: ['Software Name', 'License Key', 'Purchase Date', 'Expiry Date', 'Number of Licenses', 'Vendor']
    },
    {
      id: 3,
      name: 'Incident Report',
      category: 'support',
      fields: ['Issue Title', 'Description', 'Severity', 'Reported By', 'System Affected', 'Resolution']
    }
  ]);

  const [activeForm, setActiveForm] = useState(null);
  const [formData, setFormData] = useState({});

  // Assets State
  const [assets, setAssets] = useState([
    {
      id: 'AST-001',
      type: 'Laptop',
      brand: 'Dell',
      model: 'Latitude 7420',
      serialNumber: 'DL7420-12345',
      assignedTo: 'Sarah Chen',
      location: 'Office - Floor 2',
      purchaseDate: '2023-06-15',
      warrantyEnd: '2026-06-15',
      status: 'active',
      condition: 'good'
    },
    {
      id: 'AST-002',
      type: 'Server',
      brand: 'HP',
      model: 'ProLiant DL380',
      serialNumber: 'HP380-98765',
      assignedTo: 'Server Room',
      location: 'Data Center',
      purchaseDate: '2022-03-10',
      warrantyEnd: '2025-03-10',
      status: 'active',
      condition: 'excellent'
    }
  ]);

  // Navigation
  const navigation = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'people', label: 'Team Management', icon: Users },
    { id: 'projects', label: 'Projects', icon: FolderGit2 },
    { id: 'change-requests', label: 'Change Requests', icon: GitBranch },
    { id: 'updates', label: 'System Updates', icon: RefreshCw },
    { id: 'data-input', label: 'Data Input', icon: Database },
    { id: 'assets', label: 'Asset Management', icon: Package },
    { id: 'monitoring', label: 'System Monitoring', icon: Activity },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 }
  ];

  // Handlers - People Management
  const handleAddPerson = () => {
    if (newPerson.name && newPerson.email) {
      setTeam([...team, {
        id: Date.now(),
        ...newPerson,
        skills: newPerson.skills.split(',').map(s => s.trim()),
        projects: [],
        joinDate: new Date().toISOString().split('T')[0],
        photo: '/api/placeholder/100/100'
      }]);
      setNewPerson({
        name: '',
        role: '',
        email: '',
        phone: '',
        department: 'IT',
        skills: '',
        status: 'active'
      });
      setShowAddPerson(false);
    }
  };

  const updatePersonStatus = (personId, newStatus) => {
    setTeam(team.map(person =>
      person.id === personId ? { ...person, status: newStatus } : person
    ));
  };

  // Handlers - Projects
  const handleAddProject = () => {
    if (newProject.name && newProject.description) {
      setProjects([...projects, {
        id: Date.now(),
        ...newProject,
        progress: 0,
        spent: 0,
        teamMembers: newProject.teamMembers.split(',').map(s => s.trim()),
        tags: newProject.tags.split(',').map(s => s.trim()),
        updates: []
      }]);
      setNewProject({
        name: '',
        description: '',
        status: 'planning',
        priority: 'medium',
        startDate: '',
        endDate: '',
        teamMembers: [],
        budget: '',
        tags: ''
      });
      setShowAddProject(false);
    }
  };

  const handleAddProjectUpdate = (projectId) => {
    if (projectUpdate.trim()) {
      setProjects(projects.map(project => {
        if (project.id === projectId) {
          return {
            ...project,
            updates: [
              { date: new Date().toISOString().split('T')[0], update: projectUpdate, by: 'Current User' },
              ...project.updates
            ]
          };
        }
        return project;
      }));
      setProjectUpdate('');
      setSelectedProject(null);
    }
  };

  const updateProjectProgress = (projectId, progress) => {
    setProjects(projects.map(project =>
      project.id === projectId ? { ...project, progress: parseInt(progress) } : project
    ));
  };

  // Handlers - Change Requests
  const handleAddChangeRequest = () => {
    if (newChangeRequest.title && newChangeRequest.description) {
      setChangeRequests([...changeRequests, {
        id: `CR-${String(changeRequests.length + 1).padStart(3, '0')}`,
        ...newChangeRequest,
        date: new Date().toISOString().split('T')[0],
        status: 'pending',
        assignedTo: null,
        approver: null,
        implementationDate: null
      }]);
      setNewChangeRequest({
        title: '',
        requestedBy: '',
        priority: 'medium',
        category: 'feature',
        description: '',
        impact: '',
        estimatedHours: ''
      });
      setShowAddChangeRequest(false);
    }
  };

  const updateChangeRequestStatus = (requestId, newStatus) => {
    setChangeRequests(changeRequests.map(request =>
      request.id === requestId ? { ...request, status: newStatus } : request
    ));
  };

  // Handlers - System Updates
  const handleAddUpdate = () => {
    if (newUpdate.system && newUpdate.description) {
      setSystemUpdates([...systemUpdates, {
        id: Date.now(),
        ...newUpdate,
        status: 'scheduled',
        performedBy: null
      }]);
      setNewUpdate({
        system: '',
        type: 'maintenance',
        version: '',
        scheduledDate: '',
        duration: '',
        description: '',
        downtime: false,
        affectedUsers: '',
        notes: ''
      });
      setShowAddUpdate(false);
    }
  };

  const updateSystemStatus = (updateId, newStatus) => {
    setSystemUpdates(systemUpdates.map(update =>
      update.id === updateId ? { 
        ...update, 
        status: newStatus,
        completedDate: newStatus === 'completed' ? new Date().toISOString().split('T')[0] : update.completedDate
      } : update
    ));
  };

  // Handlers - Data Input
  const handleFormSubmit = (formId) => {
    console.log('Form submitted:', formId, formData);
    // Here you would typically save the data to your backend
    alert('Data saved successfully!');
    setFormData({});
    setActiveForm(null);
  };

  // Dashboard Module
  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-blue-600" />
          IT Department Dashboard
        </h2>
        <p className="text-sm text-gray-600 mt-1">Overview of IT operations and metrics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-8 w-8 opacity-80" />
            <TrendingUp className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-medium opacity-90">Team Members</h3>
          <p className="text-3xl font-bold mt-2">{team.filter(p => p.status === 'active').length}</p>
          <p className="text-xs mt-2 opacity-75">{team.length} total</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <FolderGit2 className="h-8 w-8 opacity-80" />
            <TrendingUp className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-medium opacity-90">Active Projects</h3>
          <p className="text-3xl font-bold mt-2">{projects.filter(p => p.status === 'in-progress').length}</p>
          <p className="text-xs mt-2 opacity-75">{projects.length} total projects</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <GitBranch className="h-8 w-8 opacity-80" />
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-medium opacity-90">Pending Changes</h3>
          <p className="text-3xl font-bold mt-2">{changeRequests.filter(r => r.status === 'pending').length}</p>
          <p className="text-xs mt-2 opacity-75">{changeRequests.length} total requests</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <RefreshCw className="h-8 w-8 opacity-80" />
            <Clock className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-medium opacity-90">Scheduled Updates</h3>
          <p className="text-3xl font-bold mt-2">{systemUpdates.filter(u => u.status === 'scheduled').length}</p>
          <p className="text-xs mt-2 opacity-75">{systemUpdates.length} total updates</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <h3 className="font-bold text-lg mb-4 text-gray-900">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => setActiveModule('people')}
            className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-left transition-colors"
          >
            <Users className="h-6 w-6 text-blue-600 mb-2" />
            <p className="font-semibold text-sm text-gray-900">Add Team Member</p>
          </button>
          <button
            onClick={() => setActiveModule('projects')}
            className="p-4 bg-green-50 hover:bg-green-100 rounded-lg text-left transition-colors"
          >
            <FolderGit2 className="h-6 w-6 text-green-600 mb-2" />
            <p className="font-semibold text-sm text-gray-900">Create Project</p>
          </button>
          <button
            onClick={() => setActiveModule('change-requests')}
            className="p-4 bg-orange-50 hover:bg-orange-100 rounded-lg text-left transition-colors"
          >
            <GitBranch className="h-6 w-6 text-orange-600 mb-2" />
            <p className="font-semibold text-sm text-gray-900">New Change Request</p>
          </button>
          <button
            onClick={() => setActiveModule('data-input')}
            className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg text-left transition-colors"
          >
            <Database className="h-6 w-6 text-purple-600 mb-2" />
            <p className="font-semibold text-sm text-gray-900">Data Entry</p>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <h3 className="font-bold text-lg mb-4 text-gray-900">Recent Project Updates</h3>
          <div className="space-y-3">
            {projects.flatMap(p => p.updates.slice(0, 2).map((update, idx) => (
              <div key={`${p.id}-${idx}`} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-600 mt-1">{update.update}</p>
                  <p className="text-xs text-gray-500 mt-1">{update.date} • {update.by}</p>
                </div>
              </div>
            )))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <h3 className="font-bold text-lg mb-4 text-gray-900">System Status</h3>
          <div className="space-y-3">
            {[
              { name: 'Production Server', status: 'online', uptime: '99.9%' },
              { name: 'Database Server', status: 'online', uptime: '99.8%' },
              { name: 'Email Server', status: 'maintenance', uptime: '98.5%' },
              { name: 'Backup Server', status: 'online', uptime: '99.7%' }
            ].map((system, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    system.status === 'online' ? 'bg-green-500' : 'bg-yellow-500'
                  }`}></div>
                  <span className="font-medium text-sm text-gray-900">{system.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Uptime</p>
                  <p className="text-sm font-semibold text-gray-900">{system.uptime}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // People Management Module
  const renderPeople = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            Team Management
          </h2>
          <p className="text-sm text-gray-600 mt-1">Manage IT team members and assignments</p>
        </div>
        <button
          onClick={() => setShowAddPerson(!showAddPerson)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Add Team Member
        </button>
      </div>

      {/* Add Person Form */}
      {showAddPerson && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
          <h3 className="font-bold text-lg mb-4 text-gray-900">Add New Team Member</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Full Name"
              value={newPerson.name}
              onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Role (e.g., Developer, Network Admin)"
              value={newPerson.role}
              onChange={(e) => setNewPerson({ ...newPerson, role: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="email"
              placeholder="Email"
              value={newPerson.email}
              onChange={(e) => setNewPerson({ ...newPerson, email: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={newPerson.phone}
              onChange={(e) => setNewPerson({ ...newPerson, phone: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Skills (comma-separated)"
              value={newPerson.skills}
              onChange={(e) => setNewPerson({ ...newPerson, skills: e.target.value })}
              className="md:col-span-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleAddPerson}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Add Member
            </button>
            <button
              onClick={() => setShowAddPerson(false)}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Team Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {team.map(person => (
          <div key={person.id} className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                  {person.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900">{person.name}</h3>
                  <p className="text-sm text-gray-600">{person.role}</p>
                </div>
              </div>
              <select
                value={person.status}
                onChange={(e) => updatePersonStatus(person.id, e.target.value)}
                className={`text-xs px-2 py-1 rounded border-0 font-medium ${
                  person.status === 'active' ? 'bg-green-100 text-green-800' :
                  person.status === 'on-leave' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}
              >
                <option value="active">Active</option>
                <option value="on-leave">On Leave</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="space-y-2 text-sm mb-4">
              <div className="flex items-center gap-2 text-gray-600">
                <Mail className="h-4 w-4" />
                <span>{person.email}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="h-4 w-4" />
                <span>{person.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="h-4 w-4" />
                <span>Joined: {person.joinDate}</span>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">Skills</p>
              <div className="flex flex-wrap gap-2">
                {person.skills.slice(0, 3).map((skill, idx) => (
                  <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {skill}
                  </span>
                ))}
                {person.skills.length > 3 && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                    +{person.skills.length - 3}
                  </span>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <p className="text-xs text-gray-500 mb-2">Current Projects ({person.projects.length})</p>
              <div className="space-y-1">
                {person.projects.slice(0, 2).map((project, idx) => (
                  <p key={idx} className="text-xs text-gray-700">{project}</p>
                ))}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <Edit className="h-4 w-4" />
                Edit
              </button>
              <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
                <Eye className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Projects Module
  const renderProjects = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FolderGit2 className="h-6 w-6 text-blue-600" />
            Project Management
          </h2>
          <p className="text-sm text-gray-600 mt-1">Track and manage IT projects</p>
        </div>
        <button
          onClick={() => setShowAddProject(!showAddProject)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          New Project
        </button>
      </div>

      {/* Add Project Form */}
      {showAddProject && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
          <h3 className="font-bold text-lg mb-4 text-gray-900">Create New Project</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Project Name"
              value={newProject.name}
              onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <select
              value={newProject.priority}
              onChange={(e) => setNewProject({ ...newProject, priority: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
            <input
              type="date"
              placeholder="Start Date"
              value={newProject.startDate}
              onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="date"
              placeholder="End Date"
              value={newProject.endDate}
              onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="number"
              placeholder="Budget"
              value={newProject.budget}
              onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Team Members (comma-separated)"
              value={newProject.teamMembers}
              onChange={(e) => setNewProject({ ...newProject, teamMembers: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Tags (comma-separated)"
              value={newProject.tags}
              onChange={(e) => setNewProject({ ...newProject, tags: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <select
              value={newProject.status}
              onChange={(e) => setNewProject({ ...newProject, status: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="planning">Planning</option>
              <option value="in-progress">In Progress</option>
              <option value="on-hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
            <textarea
              placeholder="Project Description"
              value={newProject.description}
              onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              className="md:col-span-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleAddProject}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Create Project
            </button>
            <button
              onClick={() => setShowAddProject(false)}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Projects List */}
      <div className="space-y-6">
        {projects.map(project => (
          <div key={project.id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            {/* Project Header */}
            <div className={`p-6 ${
              project.priority === 'high' ? 'bg-gradient-to-r from-red-50 to-orange-50' :
              project.priority === 'medium' ? 'bg-gradient-to-r from-yellow-50 to-amber-50' :
              'bg-gradient-to-r from-green-50 to-emerald-50'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-900">{project.name}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      project.priority === 'high' ? 'bg-red-100 text-red-800' :
                      project.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {project.priority.toUpperCase()}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      project.status === 'completed' ? 'bg-green-100 text-green-800' :
                      project.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                      project.status === 'on-hold' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {project.status.toUpperCase().replace('-', ' ')}
                    </span>
                  </div>
                  <p className="text-gray-700 mb-3">{project.description}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {project.tags.map((tag, idx) => (
                      <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Progress</span>
                  <span className="text-sm font-bold text-gray-900">{project.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={project.progress}
                  onChange={(e) => updateProjectProgress(project.id, e.target.value)}
                  className="w-full mt-2"
                />
              </div>
            </div>

            {/* Project Body */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Start Date</p>
                  <p className="font-semibold text-gray-900">{project.startDate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">End Date</p>
                  <p className="font-semibold text-gray-900">{project.endDate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Budget</p>
                  <p className="font-semibold text-gray-900">₹{project.budget.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Spent</p>
                  <p className="font-semibold text-red-600">₹{project.spent.toLocaleString()}</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-700 mb-2">Team Members</p>
                <div className="flex flex-wrap gap-2">
                  {project.teamMembers.map((member, idx) => (
                    <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-lg flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {member}
                    </span>
                  ))}
                </div>
              </div>

              {/* Project Updates */}
              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-lg text-gray-900">Project Updates</h4>
                  <button
                    onClick={() => setSelectedProject(project.id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Update
                  </button>
                </div>

                {selectedProject === project.id && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <textarea
                      value={projectUpdate}
                      onChange={(e) => setProjectUpdate(e.target.value)}
                      placeholder="Enter project update..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                    />
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleAddProjectUpdate(project.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Save Update
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProject(null);
                          setProjectUpdate('');
                        }}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {project.updates.map((update, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-gray-700">{update.update}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            {update.date} • {update.by}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Change Requests Module
  const renderChangeRequests = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GitBranch className="h-6 w-6 text-blue-600" />
            Change Requests
          </h2>
          <p className="text-sm text-gray-600 mt-1">Manage system and process change requests</p>
        </div>
        <button
          onClick={() => setShowAddChangeRequest(!showAddChangeRequest)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          New Request
        </button>
      </div>

      {/* Add Change Request Form */}
      {showAddChangeRequest && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
          <h3 className="font-bold text-lg mb-4 text-gray-900">Create Change Request</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Request Title"
              value={newChangeRequest.title}
              onChange={(e) => setNewChangeRequest({ ...newChangeRequest, title: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Requested By"
              value={newChangeRequest.requestedBy}
              onChange={(e) => setNewChangeRequest({ ...newChangeRequest, requestedBy: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <select
              value={newChangeRequest.priority}
              onChange={(e) => setNewChangeRequest({ ...newChangeRequest, priority: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
            <select
              value={newChangeRequest.category}
              onChange={(e) => setNewChangeRequest({ ...newChangeRequest, category: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="feature">Feature Request</option>
              <option value="bug-fix">Bug Fix</option>
              <option value="security">Security</option>
              <option value="database">Database</option>
              <option value="infrastructure">Infrastructure</option>
            </select>
            <input
              type="number"
              placeholder="Estimated Hours"
              value={newChangeRequest.estimatedHours}
              onChange={(e) => setNewChangeRequest({ ...newChangeRequest, estimatedHours: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <textarea
              placeholder="Description"
              value={newChangeRequest.description}
              onChange={(e) => setNewChangeRequest({ ...newChangeRequest, description: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
            />
            <textarea
              placeholder="Impact Assessment"
              value={newChangeRequest.impact}
              onChange={(e) => setNewChangeRequest({ ...newChangeRequest, impact: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
            />
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleAddChangeRequest}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Submit Request
            </button>
            <button
              onClick={() => setShowAddChangeRequest(false)}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Change Requests Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">ID</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Title</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Category</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Priority</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Requested By</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {changeRequests.map(request => (
                <tr key={request.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm font-mono text-gray-900">{request.id}</td>
                  <td className="py-3 px-4 text-sm text-gray-900 font-medium">{request.title}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full capitalize">
                      {request.category.replace('-', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                      request.priority === 'high' ? 'bg-red-100 text-red-800' :
                      request.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {request.priority.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">{request.requestedBy}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{request.date}</td>
                  <td className="py-3 px-4">
                    <select
                      value={request.status}
                      onChange={(e) => updateChangeRequestStatus(request.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded border-0 font-medium ${
                        request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        request.status === 'in-review' ? 'bg-blue-100 text-blue-800' :
                        request.status === 'approved' ? 'bg-green-100 text-green-800' :
                        request.status === 'implemented' ? 'bg-purple-100 text-purple-800' :
                        'bg-red-100 text-red-800'
                      }`}
                    >
                      <option value="pending">Pending</option>
                      <option value="in-review">In Review</option>
                      <option value="approved">Approved</option>
                      <option value="implemented">Implemented</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <button className="p-1 hover:bg-blue-50 rounded">
                      <Eye className="h-4 w-4 text-blue-600" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // System Updates Module
  const renderUpdates = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-blue-600" />
            System Updates & Holdings
          </h2>
          <p className="text-sm text-gray-600 mt-1">Schedule and track system maintenance</p>
        </div>
        <button
          onClick={() => setShowAddUpdate(!showAddUpdate)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Schedule Update
        </button>
      </div>

      {/* Add Update Form */}
      {showAddUpdate && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
          <h3 className="font-bold text-lg mb-4 text-gray-900">Schedule System Update</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="System Name"
              value={newUpdate.system}
              onChange={(e) => setNewUpdate({ ...newUpdate, system: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <select
              value={newUpdate.type}
              onChange={(e) => setNewUpdate({ ...newUpdate, type: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="maintenance">Maintenance</option>
              <option value="security-patch">Security Patch</option>
              <option value="upgrade">Upgrade</option>
              <option value="hotfix">Hotfix</option>
            </select>
            <input
              type="text"
              placeholder="Version (if applicable)"
              value={newUpdate.version}
              onChange={(e) => setNewUpdate({ ...newUpdate, version: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="datetime-local"
              value={newUpdate.scheduledDate}
              onChange={(e) => setNewUpdate({ ...newUpdate, scheduledDate: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Duration (e.g., 2 hours)"
              value={newUpdate.duration}
              onChange={(e) => setNewUpdate({ ...newUpdate, duration: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Affected Users"
              value={newUpdate.affectedUsers}
              onChange={(e) => setNewUpdate({ ...newUpdate, affectedUsers: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="flex items-center gap-3 px-4">
              <input
                type="checkbox"
                checked={newUpdate.downtime}
                onChange={(e) => setNewUpdate({ ...newUpdate, downtime: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <label className="text-sm text-gray-700">System Downtime Required</label>
            </div>
            <textarea
              placeholder="Description"
              value={newUpdate.description}
              onChange={(e) => setNewUpdate({ ...newUpdate, description: e.target.value })}
              className="md:col-span-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
            />
            <textarea
              placeholder="Notes"
              value={newUpdate.notes}
              onChange={(e) => setNewUpdate({ ...newUpdate, notes: e.target.value })}
              className="md:col-span-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
            />
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleAddUpdate}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Schedule Update
            </button>
            <button
              onClick={() => setShowAddUpdate(false)}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Updates List */}
      <div className="space-y-4">
        {systemUpdates.map(update => (
          <div key={update.id} className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-bold text-gray-900">{update.system}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    update.type === 'security-patch' ? 'bg-red-100 text-red-800' :
                    update.type === 'upgrade' ? 'bg-blue-100 text-blue-800' :
                    update.type === 'hotfix' ? 'bg-orange-100 text-orange-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {update.type.toUpperCase().replace('-', ' ')}
                  </span>
                  {update.downtime && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      DOWNTIME
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 mb-2">{update.description}</p>
                {update.version && (
                  <p className="text-sm text-gray-600">Version: <span className="font-semibold">{update.version}</span></p>
                )}
              </div>
              <select
                value={update.status}
                onChange={(e) => updateSystemStatus(update.id, e.target.value)}
                className={`text-xs px-3 py-1 rounded border-0 font-medium ${
                  update.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                  update.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                  update.status === 'completed' ? 'bg-green-100 text-green-800' :
                  'bg-red-100 text-red-800'
                }`}
              >
                <option value="scheduled">Scheduled</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500 mb-1">Scheduled Date</p>
                <p className="font-semibold text-gray-900">{update.scheduledDate}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Duration</p>
                <p className="font-semibold text-gray-900">{update.duration}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Affected Users</p>
                <p className="font-semibold text-gray-900">{update.affectedUsers}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Performed By</p>
                <p className="font-semibold text-gray-900">{update.performedBy || 'Not assigned'}</p>
              </div>
            </div>

            {update.notes && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700"><span className="font-semibold">Notes:</span> {update.notes}</p>
              </div>
            )}

            {update.completedDate && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  <CheckCircle className="h-4 w-4 inline mr-2" />
                  Completed on {update.completedDate}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // Data Input Module
  const renderDataInput = () => (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Database className="h-6 w-6 text-blue-600" />
          Data Input Forms
        </h2>
        <p className="text-sm text-gray-600 mt-1">Enter and manage system data</p>
      </div>

      {!activeForm ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dataForms.map(form => (
            <div
              key={form.id}
              onClick={() => setActiveForm(form.id)}
              className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <Database className="h-6 w-6 text-blue-600" />
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">{form.name}</h3>
              <p className="text-xs text-gray-500 uppercase mb-3">{form.category}</p>
              <p className="text-sm text-gray-600">{form.fields.length} fields</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{dataForms.find(f => f.id === activeForm)?.name}</h3>
              <p className="text-sm text-gray-600 mt-1">Fill in the required information</p>
            </div>
            <button
              onClick={() => {
                setActiveForm(null);
                setFormData({});
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {dataForms.find(f => f.id === activeForm)?.fields.map((field, idx) => (
              <div key={idx}>
                <label className="block text-sm font-medium text-gray-700 mb-2">{field}</label>
                <input
                  type="text"
                  value={formData[field] || ''}
                  onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={`Enter ${field.toLowerCase()}`}
                />
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleFormSubmit(activeForm)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Save className="h-5 w-5" />
              Save Data
            </button>
            <button
              onClick={() => {
                setActiveForm(null);
                setFormData({});
              }}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Asset Management Module
  const renderAssets = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="h-6 w-6 text-blue-600" />
            Asset Management
          </h2>
          <p className="text-sm text-gray-600 mt-1">Track IT hardware and software assets</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {assets.map(asset => (
          <div key={asset.id} className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Package className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900">{asset.type}</h3>
                  <p className="text-sm text-gray-600">{asset.brand} {asset.model}</p>
                  <p className="text-xs text-gray-500 font-mono mt-1">{asset.id}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                asset.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {asset.status.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <p className="text-gray-500 mb-1">Serial Number</p>
                <p className="font-mono font-semibold text-gray-900">{asset.serialNumber}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Assigned To</p>
                <p className="font-semibold text-gray-900">{asset.assignedTo}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Location</p>
                <p className="font-semibold text-gray-900">{asset.location}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Condition</p>
                <p className="font-semibold text-gray-900 capitalize">{asset.condition}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Purchase Date</p>
                <p className="font-semibold text-gray-900">{asset.purchaseDate}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Warranty End</p>
                <p className="font-semibold text-gray-900">{asset.warrantyEnd}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <Edit className="h-4 w-4" />
                Edit
              </button>
              <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
                <Eye className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return renderDashboard();
      case 'people':
        return renderPeople();
      case 'projects':
        return renderProjects();
      case 'change-requests':
        return renderChangeRequests();
      case 'updates':
        return renderUpdates();
      case 'data-input':
        return renderDataInput();
      case 'assets':
        return renderAssets();
      default:
        return renderDashboard();
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 shadow-lg flex flex-col overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
              <Cpu className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900">IT Department</h1>
              <p className="text-xs font-semibold text-blue-600">Information Technology</p>
            </div>
          </div>
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
          <div className="bg-blue-50 rounded-lg p-4 mb-3">
            <p className="text-xs text-blue-600 font-semibold mb-1">System Status</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <p className="text-sm font-medium text-gray-900">All Systems Online</p>
            </div>
          </div>
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
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
    </div>
  );
}