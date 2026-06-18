import { useState } from "react";
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
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function StudentDashboard() {
  const [, navigate] = useLocation();
  const { user, logout, isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const logoutMutation = trpc.auth.logout.useMutation();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      logout();
      navigate("/");
    } catch (error) {
      toast.error("Có lỗi xảy ra khi đăng xuất");
    }
  };

  if (!isAuthenticated) {
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
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={() => navigate("/login")}
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
            <h1 className="text-2xl font-bold text-blue-600">TutorMatch</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
              <p className="text-xs text-slate-600">{user?.email}</p>
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
                    Chào mừng, {user?.name}!
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
                            Nguyễn Văn A
                          </h3>
                          <p className="text-sm text-slate-600">
                            Toán học, Vật lý
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            {[1, 2, 3, 4, 5].map((j) => (
                              <Star
                                key={j}
                                className={`w-4 h-4 ${
                                  j <= 4
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-slate-300"
                                }`}
                              />
                            ))}
                            <span className="text-xs text-slate-600 ml-1">
                              (25)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4 text-sm text-slate-600">
                        <p>
                          <span className="font-semibold">Kinh nghiệm:</span> 5
                          năm
                        </p>
                        <p>
                          <span className="font-semibold">Giá:</span> 150.000
                          VND/giờ
                        </p>
                        <p>
                          <span className="font-semibold">Địa chỉ:</span> Quận 1
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          className="flex-1 bg-purple-600 hover:bg-purple-700"
                          onClick={() => navigate("/tutor/1")}
                        >
                          Xem hồ sơ
                        </Button>
                        <Button variant="outline" className="flex-1">
                          Liên hệ
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
                      className="border border-slate-200 rounded-lg p-4 flex items-center justify-between"
                    >
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          Buổi học Toán học
                        </h3>
                        <p className="text-sm text-slate-600">
                          Gia sư: Nguyễn Văn A
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          20/06/2026 18:00-20:00
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">
                          300.000 VND
                        </p>
                        <Button size="sm" variant="outline" className="mt-2">
                          Xem chi tiết
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ratings Tab */}
            {activeTab === "ratings" && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">
                  Đánh giá gia sư
                </h2>

                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="border border-slate-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            Nguyễn Văn A
                          </p>
                          <p className="text-sm text-slate-600">
                            Buổi học Toán học - 20/06/2026
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                          Chưa đánh giá
                        </span>
                      </div>

                      <Button className="w-full bg-purple-600 hover:bg-purple-700">
                        Đánh giá gia sư
                      </Button>
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

                <div className="space-y-6">
                  <div className="pb-6 border-b border-slate-200">
                    <h3 className="font-semibold text-slate-900 mb-3">
                      Thông báo
                    </h3>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-slate-700">
                          Thông báo gia sư được đề xuất
                        </span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-slate-700">
                          Nhắc nhở buổi học sắp tới
                        </span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-slate-700">
                          Thông báo tin nhắn từ gia sư
                        </span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3">
                      Bảo mật
                    </h3>
                    <Button variant="outline">Đổi mật khẩu</Button>
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
