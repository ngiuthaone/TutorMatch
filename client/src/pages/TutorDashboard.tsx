import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  BarChart3,
  Users,
  Calendar,
  Star,
  Edit,
  LogOut,
  Menu,
  X,
  Settings,
  FileText,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface UserData {
  name: string;
  email: string;
  userType: "tutor" | "student";
  phone?: string;
}

export default function TutorDashboard() {
  const [, navigate] = useLocation();
  const [user, setUser] = useState<UserData | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication on mount
  useEffect(() => {
    try {
      const userStr = localStorage.getItem("tutormatch_user");
      if (userStr) {
        const userData = JSON.parse(userStr);
        if (userData.isAuthenticated && userData.userType === "tutor") {
          setUser(userData);
          setIsAuthenticated(true);
        } else {
          navigate("/auth");
        }
      } else {
        navigate("/auth");
      }
    } catch (error) {
      console.error("Error reading user data:", error);
      navigate("/auth");
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("tutormatch_user");
    toast.success("Đã đăng xuất thành công");
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 shadow-lg max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Cần đăng nhập
          </h2>
          <p className="text-slate-600 mb-6">
            Vui lòng đăng nhập để truy cập dashboard gia sư.
          </p>
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={() => navigate("/auth")}
          >
            Đăng nhập
          </Button>
        </div>
      </div>
    );
  }

  const menuItems = [
    { id: "overview", label: "Tổng quan", icon: BarChart3 },
    { id: "profile", label: "Hồ sơ của tôi", icon: FileText },
    { id: "requests", label: "Yêu cầu từ học sinh", icon: Users },
    { id: "lessons", label: "Lịch sử buổi học", icon: Calendar },
    { id: "ratings", label: "Đánh giá", icon: Star },
    { id: "settings", label: "Cài đặt", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"
            >
              {sidebarOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
            <h1 className="text-2xl font-bold text-slate-900">TutorMatch</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">
              Xin chào, <strong>{user.name}</strong>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Đăng xuất
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "w-64" : "w-0"
          } bg-white border-r border-slate-200 transition-all duration-300 overflow-hidden lg:w-64`}
        >
          <nav className="p-6 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === item.id
                      ? "bg-blue-100 text-blue-600 font-semibold"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">
                  Tổng quan
                </h2>
                <p className="text-slate-600">
                  Chào mừng trở lại, {user.name}!
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-600 text-sm">Yêu cầu mới</p>
                      <p className="text-3xl font-bold text-slate-900">12</p>
                    </div>
                    <Users className="w-8 h-8 text-blue-600 opacity-20" />
                  </div>
                </div>

                <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-600 text-sm">Buổi học sắp tới</p>
                      <p className="text-3xl font-bold text-slate-900">5</p>
                    </div>
                    <Calendar className="w-8 h-8 text-green-600 opacity-20" />
                  </div>
                </div>

                <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-600 text-sm">Đánh giá trung bình</p>
                      <p className="text-3xl font-bold text-slate-900">4.8</p>
                    </div>
                    <Star className="w-8 h-8 text-yellow-600 opacity-20" />
                  </div>
                </div>

                <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-600 text-sm">Tổng thu nhập</p>
                      <p className="text-3xl font-bold text-slate-900">
                        2.4M đ
                      </p>
                    </div>
                    <BarChart3 className="w-8 h-8 text-purple-600 opacity-20" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">
                  Hoạt động gần đây
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 pb-4 border-b border-slate-200">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">
                        Yêu cầu mới từ Nguyễn Thị B
                      </p>
                      <p className="text-sm text-slate-600">
                        Toán học - Lớp 10 - 2 giờ/tuần
                      </p>
                    </div>
                    <span className="text-sm text-slate-500">2 giờ trước</span>
                  </div>

                  <div className="flex items-center gap-4 pb-4 border-b border-slate-200">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">
                        Buổi học với Trần Văn C
                      </p>
                      <p className="text-sm text-slate-600">
                        Tiếng Anh - Hôm nay lúc 14:00
                      </p>
                    </div>
                    <span className="text-sm text-slate-500">Hôm nay</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                      <Star className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">
                        Đánh giá mới từ Lê Thị D
                      </p>
                      <p className="text-sm text-slate-600">
                        5 sao - Gia sư rất tuyệt vời
                      </p>
                    </div>
                    <span className="text-sm text-slate-500">1 ngày trước</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "profile" && (
            <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">
                Hồ sơ của tôi
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Tên
                  </label>
                  <p className="text-slate-600">{user.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Email
                  </label>
                  <p className="text-slate-600">{user.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Số điện thoại
                  </label>
                  <p className="text-slate-600">{user.phone || "Chưa cập nhật"}</p>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700 mt-4">
                  <Edit className="w-4 h-4 mr-2" />
                  Chỉnh sửa hồ sơ
                </Button>
              </div>
            </div>
          )}

          {activeTab === "requests" && (
            <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">
                Yêu cầu từ học sinh
              </h2>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          Yêu cầu {i}: Toán học - Lớp 10
                        </h3>
                        <p className="text-sm text-slate-600 mt-1">
                          Học sinh: Nguyễn Thị {String.fromCharCode(64 + i)}
                        </p>
                        <p className="text-sm text-slate-600">
                          Ngân sách: 200,000 đ/giờ | Địa điểm: Quận 1
                        </p>
                      </div>
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                        Chấp nhận
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "lessons" && (
            <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">
                Lịch sử buổi học
              </h2>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="p-4 border border-slate-200 rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Buổi học {i}: Tiếng Anh
                      </h3>
                      <p className="text-sm text-slate-600">
                        Học sinh: Trần Văn {String.fromCharCode(64 + i)} | 2 giờ
                      </p>
                      <p className="text-sm text-slate-600">
                        Ngày: {new Date(Date.now() - i * 86400000).toLocaleDateString("vi-VN")}
                      </p>
                    </div>
                    <Button size="sm" variant="outline">
                      Chi tiết
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "ratings" && (
            <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">
                Đánh giá
              </h2>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="p-4 border border-slate-200 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-slate-900">
                        Nguyễn Thị {String.fromCharCode(64 + i)}
                      </h3>
                      <span className="text-yellow-500">★★★★★</span>
                    </div>
                    <p className="text-slate-600">
                      Gia sư rất tuyệt vời, giảng dạy rõ ràng và có kiên nhẫn.
                      Tôi đã tiến bộ rất nhiều.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">
                Cài đặt
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Thông báo email
                    </h3>
                    <p className="text-sm text-slate-600">
                      Nhận thông báo về yêu cầu mới
                    </p>
                  </div>
                  <input type="checkbox" defaultChecked className="w-5 h-5" />
                </div>
                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Thông báo SMS
                    </h3>
                    <p className="text-sm text-slate-600">
                      Nhận thông báo qua tin nhắn
                    </p>
                  </div>
                  <input type="checkbox" defaultChecked className="w-5 h-5" />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
