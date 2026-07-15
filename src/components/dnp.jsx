import React, { useState } from "react";
import { 
  Palette, Search, TrendingUp, Sparkles, Camera, Scissors, 
  Layers, ShoppingBag, Eye, BookOpen, Package, Users, 
  Cpu, ShoppingCart, BarChart3, Megaphone, Target,
  ChevronRight, Plus, FileText, Download, Upload, Filter
} from "lucide-react";

const DesignPattern = () => {
  const [activeTab, setActiveTab] = useState("research");
  const [searchQuery, setSearchQuery] = useState("");

  // Research Categories
  const researchCategories = [
    {
      id: "forecasting",
      title: "Research Forecasting",
      icon: <TrendingUp className="w-6 h-6" />,
      color: "from-blue-500 to-cyan-500",
      items: ["Market Analysis", "Consumer Behavior", "Seasonal Predictions", "Industry Reports"]
    },
    {
      id: "trends",
      title: "Trends",
      icon: <Sparkles className="w-6 h-6" />,
      color: "from-purple-500 to-pink-500",
      items: ["Global Fashion Trends", "Street Style", "Runway Analysis", "Social Media Trends"]
    },
    {
      id: "fashion",
      title: "Fashion",
      icon: <ShoppingBag className="w-6 h-6" />,
      color: "from-rose-500 to-orange-500",
      items: ["Collection Analysis", "Designer Insights", "Fashion Week", "Editorial Looks"]
    },
    {
      id: "design",
      title: "Design",
      icon: <Palette className="w-6 h-6" />,
      color: "from-emerald-500 to-teal-500",
      items: ["CAD Designs", "Sketches", "Mood Boards", "Design Archives"]
    },
    {
      id: "style",
      title: "Style",
      icon: <Eye className="w-6 h-6" />,
      color: "from-indigo-500 to-blue-500",
      items: ["Style Guides", "Lookbooks", "Styling Tips", "Silhouettes"]
    },
    {
      id: "colour",
      title: "Colour",
      icon: <Palette className="w-6 h-6" />,
      color: "from-pink-500 to-rose-500",
      items: ["Pantone Forecast", "Color Palettes", "Color Theory", "Seasonal Colors"]
    },
    {
      id: "effects",
      title: "Effects",
      icon: <Sparkles className="w-6 h-6" />,
      color: "from-amber-500 to-yellow-500",
      items: ["Finishing Techniques", "Surface Treatments", "Textile Effects", "Embellishments"]
    }
  ];

  // Technical Research
  const technicalResearch = [
    {
      category: "Stitching Methods",
      icon: <Scissors className="w-5 h-5" />,
      items: ["Lock Stitch", "Chain Stitch", "Overlock", "Flatlock", "Blind Stitch", "Decorative Stitching"]
    },
    {
      category: "Embroidery",
      icon: <Sparkles className="w-5 h-5" />,
      items: ["Hand Embroidery", "Machine Embroidery", "Zardozi", "Thread Work", "Bead Work", "Sequin Work"]
    },
    {
      category: "Fabric",
      icon: <Layers className="w-5 h-5" />,
      items: ["Cotton", "Silk", "Wool", "Synthetics", "Blends", "Technical Fabrics", "Sustainable Materials"]
    },
    {
      category: "Neck Variation",
      icon: <Target className="w-5 h-5" />,
      items: ["Round Neck", "V-Neck", "Boat Neck", "Collar Styles", "Cowl Neck", "Halter", "Off-Shoulder"]
    },
    {
      category: "Sleeve Variation",
      icon: <Target className="w-5 h-5" />,
      items: ["Full Sleeve", "Half Sleeve", "Cap Sleeve", "Bell Sleeve", "Bishop Sleeve", "Puff Sleeve", "Raglan"]
    },
    {
      category: "Pattern Variation",
      icon: <BookOpen className="w-5 h-5" />,
      items: ["Basic Blocks", "Dart Manipulation", "Pleats", "Gathers", "Draping", "Grading", "Marker Making"]
    },
    {
      category: "Pocket Styles",
      icon: <Package className="w-5 h-5" />,
      items: ["Patch Pocket", "Welt Pocket", "Flap Pocket", "In-seam Pocket", "Kangaroo Pocket", "Hidden Pocket"]
    }
  ];

  // Associated Teams
  const associatedTeams = [
    {
      id: 1,
      name: "IT Department",
      icon: <Cpu className="w-8 h-8" />,
      color: "bg-blue-500",
      role: "Digital Tools & CAD Support",
      tasks: ["Software Management", "Digital Asset Storage", "Tech Infrastructure", "Data Analytics"]
    },
    {
      id: 2,
      name: "Procurement",
      icon: <ShoppingCart className="w-8 h-8" />,
      color: "bg-green-500",
      role: "Material Sourcing",
      tasks: ["Fabric Procurement", "Trim Sourcing", "Vendor Management", "Quality Control"]
    },
    {
      id: 3,
      name: "Managing",
      icon: <BarChart3 className="w-8 h-8" />,
      color: "bg-purple-500",
      role: "Project Oversight",
      tasks: ["Timeline Management", "Resource Allocation", "Budget Control", "Team Coordination"]
    },
    {
      id: 4,
      name: "Marketing",
      icon: <Megaphone className="w-8 h-8" />,
      color: "bg-orange-500",
      role: "Brand Strategy",
      tasks: ["Market Research", "Campaign Planning", "Brand Positioning", "Consumer Insights"]
    },
    {
      id: 5,
      name: "IMC",
      icon: <Target className="w-8 h-8" />,
      color: "bg-pink-500",
      role: "Integrated Communications",
      tasks: ["Content Strategy", "Visual Communications", "Brand Messaging", "Campaign Integration"]
    }
  ];

  const tabs = [
    { id: "research", label: "Research Hub", icon: <Search className="w-4 h-4" /> },
    { id: "technical", label: "Technical Library", icon: <BookOpen className="w-4 h-4" /> },
    { id: "brands", label: "Brand Research", icon: <ShoppingBag className="w-4 h-4" /> },
    { id: "prints", label: "Print Patterns", icon: <Layers className="w-4 h-4" /> },
    { id: "teams", label: "Collaboration", icon: <Users className="w-4 h-4" /> }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-3 rounded-xl">
                <Palette className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Design & Pattern Department</h1>
                <p className="text-sm text-gray-600">Creative Innovation & Technical Excellence</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                <Upload className="w-4 h-4" />
                <span className="text-sm font-medium">Upload</span>
              </button>
              <button className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-lg transition-all">
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">New Project</span>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-4 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search trends, patterns, techniques, brands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <button className="absolute right-3 top-1/2 transform -translate-y-1/2 px-4 py-1.5 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors">
              Search
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center space-x-2 mt-4 overflow-x-auto pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Research Hub Tab */}
        {activeTab === "research" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Research Hub</h2>
              <div className="flex items-center space-x-2">
                <button className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Filter className="w-4 h-4" />
                  <span className="text-sm">Filter</span>
                </button>
                <button className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Export</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {researchCategories.map((category) => (
                <div
                  key={category.id}
                  className="bg-white rounded-xl border border-gray-200 hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer"
                >
                  <div className={`bg-gradient-to-br ${category.color} p-6`}>
                    <div className="text-white">{category.icon}</div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">{category.title}</h3>
                    <ul className="space-y-2">
                      {category.items.map((item, idx) => (
                        <li key={idx} className="flex items-center text-sm text-gray-600">
                          <ChevronRight className="w-4 h-4 text-purple-500 mr-2 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <button className="mt-4 w-full py-2 bg-gray-100 hover:bg-gradient-to-r hover:from-purple-500 hover:to-pink-500 hover:text-white rounded-lg font-medium transition-all text-sm">
                      Explore
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Trendy Content Section */}
            <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Trending Now</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border-2 border-dashed border-purple-300 rounded-lg p-6 text-center hover:border-purple-500 transition-all cursor-pointer">
                  <Camera className="w-12 h-12 text-purple-500 mx-auto mb-3" />
                  <h4 className="font-semibold text-gray-900 mb-1">Trendy Pictures</h4>
                  <p className="text-sm text-gray-600">Visual inspiration & references</p>
                </div>
                <div className="border-2 border-dashed border-pink-300 rounded-lg p-6 text-center hover:border-pink-500 transition-all cursor-pointer">
                  <FileText className="w-12 h-12 text-pink-500 mx-auto mb-3" />
                  <h4 className="font-semibold text-gray-900 mb-1">Trending Terms</h4>
                  <p className="text-sm text-gray-600">Industry vocabulary & keywords</p>
                </div>
                <div className="border-2 border-dashed border-orange-300 rounded-lg p-6 text-center hover:border-orange-500 transition-all cursor-pointer">
                  <Sparkles className="w-12 h-12 text-orange-500 mx-auto mb-3" />
                  <h4 className="font-semibold text-gray-900 mb-1">Style Photos</h4>
                  <p className="text-sm text-gray-600">Different photography techniques</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Technical Library Tab */}
        {activeTab === "technical" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Technical Library</h2>
              <button className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-lg">
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Add Reference</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {technicalResearch.map((section, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-3 rounded-lg text-white">
                      {section.icon}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">{section.category}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {section.items.map((item, i) => (
                      <div
                        key={i}
                        className="px-3 py-2 bg-gray-50 hover:bg-purple-50 rounded-lg text-sm text-gray-700 hover:text-purple-700 transition-all cursor-pointer border border-gray-200 hover:border-purple-300"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Brand Research Tab */}
        {activeTab === "brands" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Brand Research</h2>
              <button className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-lg">
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Add Brand</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {["Luxury Brands", "Contemporary Brands", "Fast Fashion", "Sustainable Brands", "Emerging Designers", "Heritage Brands"].map((brandType, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-xl transition-all cursor-pointer group">
                  <div className="flex items-center justify-between mb-4">
                    <ShoppingBag className="w-8 h-8 text-purple-500 group-hover:text-pink-500 transition-colors" />
                    <span className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-medium">
                      Research
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{brandType}</h3>
                  <p className="text-sm text-gray-600 mb-4">Comprehensive analysis and insights</p>
                  <div className="flex items-center text-sm text-purple-600 font-medium group-hover:text-pink-600">
                    <span>View Details</span>
                    <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-6">
              <div className="flex items-start space-x-4">
                <div className="bg-purple-500 p-3 rounded-lg">
                  <Eye className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Competitive Analysis</h3>
                  <p className="text-gray-600 mb-4">
                    Track competitor strategies, product launches, pricing, and market positioning across all major brands
                  </p>
                  <button className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-medium">
                    Start Analysis
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Print Patterns Tab */}
        {activeTab === "prints" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Upcoming Print Patterns</h2>
              <button className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-lg">
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Upload Pattern</span>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {["Florals", "Geometric", "Abstract", "Animal Print", "Checks", "Stripes", "Digital Prints", "Ethnic Motifs"].map((pattern, idx) => (
                <div key={idx} className="aspect-square bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl border-2 border-purple-200 hover:border-purple-400 transition-all cursor-pointer group relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm p-4 transform translate-y-full group-hover:translate-y-0 transition-transform">
                    <h4 className="font-bold text-gray-900">{pattern}</h4>
                    <p className="text-xs text-gray-600 mt-1">View Collection</p>
                  </div>
                  <div className="absolute top-4 right-4">
                    <span className="bg-purple-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                      {Math.floor(Math.random() * 50) + 10}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Seasonal Forecast</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {["Spring/Summer 2026", "Fall/Winter 2026"].map((season, idx) => (
                  <div key={idx} className="border-2 border-gray-200 rounded-lg p-6 hover:border-purple-300 transition-all">
                    <h4 className="font-bold text-gray-900 mb-3">{season}</h4>
                    <ul className="space-y-2">
                      {["Print Trends", "Color Forecasts", "Texture Innovations", "Pattern Directions"].map((item, i) => (
                        <li key={i} className="flex items-center text-sm text-gray-600">
                          <div className="w-2 h-2 bg-purple-500 rounded-full mr-3" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Collaboration Tab */}
        {activeTab === "teams" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Associated Teams</h2>
              <p className="text-gray-600">Cross-functional collaboration for design excellence</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {associatedTeams.map((team) => (
                <div
                  key={team.id}
                  className="bg-white rounded-xl border border-gray-200 hover:shadow-xl transition-all overflow-hidden group"
                >
                  <div className="p-6">
                    <div className="flex items-start space-x-4 mb-4">
                      <div className={`${team.color} p-4 rounded-xl text-white`}>
                        {team.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900">{team.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{team.role}</p>
                      </div>
                      <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">
                        Connect
                      </button>
                    </div>
                    <div className="border-t border-gray-200 pt-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">Key Responsibilities:</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {team.tasks.map((task, idx) => (
                          <div
                            key={idx}
                            className="px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-700 border border-gray-200"
                          >
                            {task}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-3 border-t border-gray-200">
                    <button className="flex items-center text-sm font-medium text-purple-600 hover:text-purple-700 group-hover:translate-x-1 transition-all">
                      <span>View Collaboration Details</span>
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Collaboration Workflow */}
            <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-8 text-white">
              <h3 className="text-2xl font-bold mb-4">Integrated Workflow</h3>
              <p className="mb-6 text-purple-100">
                Seamless coordination between Design & Pattern Department and all associated teams for efficient project execution
              </p>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {associatedTeams.map((team, idx) => (
                  <div key={team.id} className="text-center">
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 mb-2">
                      <div className="text-white mb-2">{team.icon}</div>
                      <p className="text-xs font-medium">{team.name}</p>
                    </div>
                    {idx < associatedTeams.length - 1 && (
                      <div className="hidden md:block">
                        <ChevronRight className="w-5 h-5 mx-auto text-white/60" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer Stats */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold text-purple-600">2.5K+</div>
              <div className="text-sm text-gray-600 mt-1">Design References</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-pink-600">500+</div>
              <div className="text-sm text-gray-600 mt-1">Pattern Libraries</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-orange-600">150+</div>
              <div className="text-sm text-gray-600 mt-1">Brand Studies</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">5</div>
              <div className="text-sm text-gray-600 mt-1">Team Collaborations</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default DesignPattern;