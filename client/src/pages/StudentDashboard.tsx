import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  BarChart3,
  Users,
  Calendar,
  Star,
  Plus,
  LogOut,
  Menu,
  X,
  Settings,
  FileText,
  Clock,
  MapPin,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";

interface UserData {
  name: string;
  email: string;
  userType: "tutor" | "student";
  phone?: string;
}

export default function StudentDashboard() {
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
        if (userData.isAuthenticated && userData.userType === "student") {
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
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
            Vui lòng đăng nhập để truy cập dashboard học sinh.
          </p>
          <Button
            className="w-full bg-purple-600 hover:bg-purple-700"
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
    { id: "requests", label: "Yêu cầu của tôi", icon: FileText },
    { id: "tutors", label: "Gia sư được đề xuất", icon: Users },
    { id: "lessons", label: "Buổi học", icon: Calendar },
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
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-600">{user.email}</p>
            </div>
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <aside
            className={`${
              sidebarOpen ? "block" : "hidden"
            } lg:block lg:col-span-1`}
          >
            <nav className="bg-white rounded-lg shadow-sm p-4 space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      activeTab === item.id
                        ? "bg-purple-100 text-purple-700 font-semibold"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-3 space-y-6">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-2xl font-bold text-slate-900 mb-6">
                    Chào mừng, {user.name}!
                  </h2>

                  {/* Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-blue-700 font-semibold">
                            Yêu cầu đang chờ
                          </p>
                          <p className="text-3xl font-bold text-blue-900 mt-2">
                            2
                          </p>
                        </div>
                        <FileText className="w-8 h-8 text-blue-600 opacity-50" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-green-700 font-semibold">
                            Gia sư được đề xuất
                          </p>
                          <p className="text-3xl font-bold text-green-900 mt-2">
                            8
                          </p>
                        </div>
                        <Users className="w-8 h-8 text-green-600 opacity-50" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-6 border border-yellow-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-yellow-700 font-semibold">
                            Buổi học này tuần
                          </p>
                          <p className="text-3xl font-bold text-yellow-900 mt-2">
                            2
                          </p>
                        </div>
                        <Calendar className="w-8 h-8 text-yellow-600 opacity-50" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-purple-700 font-semibold">
                            Tổng chi phí tháng này
                          </p>
                          <p className="text-3xl font-bold text-purple-900 mt-2">
                            3M
                          </p>
                        </div>
                        <DollarSign className="w-8 h-8 text-purple-600 opacity-50" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">
                    Hoạt động gần đây
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 pb-4 border-b border-slate-200">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">
                          Gia sư mới được đề xuất
                        </p>
                        <p className="text-sm text-slate-600">
                          Nguyễn Văn A - Toán học
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">1 giờ trước</span>
                    </div>

                    <div className="flex items-center gap-4 pb-4 border-b border-slate-200">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">
                          Buổi học sắp tới
                        </p>
                        <p className="text-sm text-slate-600">
                          Hôm nay lúc 18:00 với Nguyễn Văn A
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">Sắp tới</span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                        <Star className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">
                          Yêu cầu đánh giá gia sư
                        </p>
                        <p className="text-sm text-slate-600">
                          Buổi học với Nguyễn Văn A đã kết thúc
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">2 giờ trước</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Requests Tab */}
            {activeTab === "requests" && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">
                    Yêu cầu của tôi
                  </h2>
                  <Button
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
                    onClick={() => navigate("/find-tutor")}
                  >
                    <Plus className="w-4 h-4" />
                    Yêu cầu mới
                  </Button>
                </div>

                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            Toán học - Trung học phổ thông
                          </h3>
                          <p className="text-sm text-slate-600">
                            Chuẩn bị cho kỳ thi cuối kỳ
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                          Đang tìm
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          Quận 1
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Thứ 2, 4, 6
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          150.000-200.000 VND/giờ
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                        >
                          Xem chi tiết
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 text-red-600 hover:text-red-700"
                        >
                          Hủy yêu cầu
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tutors Tab */}
            {activeTab === "tutors" && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">
                  Gia sư được đề xuất
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-2xl font-bold text-white">
                            N
                          </span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900">
                            Nguyễn Văn {String.fromCharCode(64 + i)}
                          </h3>
                          <p className="text-sm text-slate-600">
                            Toán học, Vật lý
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-yellow-500">★★★★★</span>
                            <span className="text-sm text-slate-600">(4.8)</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-sm text-slate-600 mb-3">
                        Kinh nghiệm: {3 + i} năm
                      </p>

                      <div className="flex gap-2">
                        <Button
                          className="flex-1 bg-purple-600 hover:bg-purple-700"
                          size="sm"
                        >
                          Liên hệ
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          size="sm"
                        >
                          Xem hồ sơ
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lessons Tab */}
            {activeTab === "lessons" && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">
                  Buổi học
                </h2>

                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            Buổi học {i}: Toán học
                          </h3>
                          <p className="text-sm text-slate-600">
                            Gia sư: Nguyễn Văn A
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                          Sắp tới
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(Date.now() + i * 86400000).toLocaleDateString("vi-VN")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          14:00 - 16:00
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          Online
                        </span>
                      </div>

                      <Button
                        className="w-full bg-purple-600 hover:bg-purple-700"
                        size="sm"
                      >
                        Tham gia buổi học
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ratings Tab */}
            {activeTab === "ratings" && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">
                  Đánh giá
                </h2>

                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="border border-slate-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-slate-900">
                          Nguyễn Văn {String.fromCharCode(64 + i)}
                        </h3>
                        <span className="text-yellow-500">★★★★★</span>
                      </div>
                      <p className="text-sm text-slate-600">
                        Gia sư rất tuyệt vời, giảng dạy rõ ràng và có kiên nhẫn.
                        Tôi đã tiến bộ rất nhiều.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === "settings" && (
              <div className="bg-white rounded-lg shadow-sm p-6">
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
                        Nhận thông báo về gia sư mới
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
    </div>
  );
}
