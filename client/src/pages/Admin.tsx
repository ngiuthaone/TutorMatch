import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import {
  Lock,
  LogOut,
  Users,
  FileText,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  BarChart3,
  Settings,
} from "lucide-react";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: "tutor" | "student";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

interface StudentRequest {
  id: number;
  studentName: string;
  subject: string;
  grade: string;
  status: "open" | "matched" | "completed";
  createdAt: string;
}

// Mock data
const mockTutors: AdminUser[] = [
  {
    id: 1,
    name: "Trần Minh Anh",
    email: "minh.anh@example.com",
    role: "tutor",
    status: "pending",
    createdAt: "2026-05-10",
  },
  {
    id: 2,
    name: "Lý Hoàng Phúc",
    email: "hoang.phuc@example.com",
    role: "tutor",
    status: "approved",
    createdAt: "2026-05-08",
  },
];

const mockRequests: StudentRequest[] = [
  {
    id: 1,
    studentName: "Nguyễn Thanh Tháo",
    subject: "Toán học",
    grade: "Trung học phổ thông",
    status: "open",
    createdAt: "2026-05-12",
  },
  {
    id: 2,
    studentName: "Đặng Hồng Nhân",
    subject: "Tiếng Anh",
    grade: "Trung học cơ sở",
    status: "matched",
    createdAt: "2026-05-11",
  },
];

export default function Admin() {
  const [, navigate] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "tutors" | "requests" | "matches" | "analytics"
  >("tutors");
  const [error, setError] = useState("");

  useEffect(() => {
    // Check if already authenticated
    const adminToken = localStorage.getItem("admin_token");
    if (adminToken) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Replace with real authentication
    const correctPassword = "admin123";
    if (password === correctPassword) {
      localStorage.setItem("admin_token", "authenticated");
      setIsAuthenticated(true);
      setError("");
      setPassword("");
    } else {
      setError("Mật khẩu không đúng");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setIsAuthenticated(false);
    setPassword("");
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Lock className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center text-slate-900 mb-2">
            Admin CMS
          </h1>
          <p className="text-center text-slate-600 mb-8">
            Nhập mật khẩu để truy cập bảng điều khiển quản trị
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Nhập mật khẩu"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {error && (
                <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                  <XCircle className="w-4 h-4" />
                  {error}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-2"
            >
              Đăng nhập
            </Button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Demo:</strong> Mật khẩu: admin123
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Lock className="w-6 h-6 text-blue-600" />
            Admin CMS - TutorMatch
          </h1>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Đăng xuất
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-8">
            {[
              { id: "tutors", label: "Gia sư", icon: Users },
              { id: "requests", label: "Yêu cầu học sinh", icon: FileText },
              { id: "matches", label: "Ghép cặp", icon: CheckCircle },
              { id: "analytics", label: "Thống kê", icon: BarChart3 },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() =>
                    setActiveTab(
                      tab.id as
                        | "tutors"
                        | "requests"
                        | "matches"
                        | "analytics"
                    )
                  }
                  className={`py-4 px-4 border-b-2 font-semibold flex items-center gap-2 transition ${
                    activeTab === tab.id
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tutors Tab */}
        {activeTab === "tutors" && (
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              Quản lý gia sư
            </h2>
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                      Tên
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                      Trạng thái
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                      Ngày đăng ký
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mockTutors.map((tutor) => (
                    <tr
                      key={tutor.id}
                      className="border-b border-slate-200 hover:bg-slate-50 transition"
                    >
                      <td className="px-6 py-4 text-slate-900 font-semibold">
                        {tutor.name}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{tutor.email}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            tutor.status === "approved"
                              ? "bg-green-100 text-green-700"
                              : tutor.status === "pending"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {tutor.status === "approved"
                            ? "Đã phê duyệt"
                            : tutor.status === "pending"
                            ? "Chờ xử lý"
                            : "Từ chối"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {tutor.createdAt}
                      </td>
                      <td className="px-6 py-4 flex gap-2">
                        {tutor.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Phê duyệt
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-600 hover:bg-red-50"
                            >
                              Từ chối
                            </Button>
                          </>
                        )}
                        {tutor.status === "approved" && (
                          <Button size="sm" variant="outline">
                            Xem chi tiết
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === "requests" && (
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              Yêu cầu từ học sinh
            </h2>
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                      Học sinh
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                      Môn học
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                      Cấp lớp
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                      Trạng thái
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                      Ngày gửi
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mockRequests.map((request) => (
                    <tr
                      key={request.id}
                      className="border-b border-slate-200 hover:bg-slate-50 transition"
                    >
                      <td className="px-6 py-4 text-slate-900 font-semibold">
                        {request.studentName}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {request.subject}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {request.grade}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            request.status === "matched"
                              ? "bg-green-100 text-green-700"
                              : request.status === "open"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {request.status === "matched"
                            ? "Đã ghép cặp"
                            : request.status === "open"
                            ? "Mở"
                            : "Hoàn thành"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {request.createdAt}
                      </td>
                      <td className="px-6 py-4">
                        <Button size="sm" variant="outline">
                          Xem chi tiết
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Matches Tab */}
        {activeTab === "matches" && (
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              Quản lý ghép cặp
            </h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <p className="text-slate-600">
                Tính năng ghép cặp sẽ được cập nhật sớm
              </p>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              Thống kê
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: "Tổng gia sư", value: "48", color: "blue" },
                { label: "Tổng học sinh", value: "125", color: "green" },
                { label: "Yêu cầu mở", value: "12", color: "yellow" },
                { label: "Ghép cặp thành công", value: "89", color: "purple" },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className={`bg-${stat.color}-50 border border-${stat.color}-200 rounded-lg p-6`}
                >
                  <p className={`text-${stat.color}-600 text-sm font-semibold`}>
                    {stat.label}
                  </p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
