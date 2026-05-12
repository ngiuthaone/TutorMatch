import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Search,
  Filter,
} from "lucide-react";

interface MatchSuggestion {
  id: number;
  tutorName: string;
  studentName: string;
  subject: string;
  grade: string;
  tutorRating: number;
  matchScore: number;
  reason: string;
}

interface ActiveMatch {
  id: number;
  tutorName: string;
  studentName: string;
  subject: string;
  status: "pending" | "accepted" | "active" | "completed";
  startDate: string;
  lastLesson: string;
}

// Mock data
const mockSuggestions: MatchSuggestion[] = [
  {
    id: 1,
    tutorName: "Trần Minh Anh",
    studentName: "Nguyễn Thanh Tháo",
    subject: "Toán học",
    grade: "Trung học phổ thông",
    tutorRating: 4.9,
    matchScore: 95,
    reason: "Gia sư chuyên dạy Toán DSE, học sinh cần chuẩn bị thi",
  },
  {
    id: 2,
    tutorName: "Lý Hoàng Phúc",
    studentName: "Đặng Hồng Nhân",
    subject: "Tiếng Anh",
    grade: "Trung học cơ sở",
    tutorRating: 4.8,
    matchScore: 92,
    reason: "Giáo viên bản xứ, phù hợp với học sinh muốn cải thiện phát âm",
  },
];

const mockActiveMatches: ActiveMatch[] = [
  {
    id: 1,
    tutorName: "Nguyễn Thị Hương",
    studentName: "Lý Minh Anh",
    subject: "Tiếng Trung",
    status: "active",
    startDate: "2026-04-15",
    lastLesson: "2026-05-10",
  },
  {
    id: 2,
    tutorName: "Đặng Hồng Nhân",
    studentName: "Trần Văn A",
    subject: "Hóa học",
    status: "accepted",
    startDate: "2026-05-01",
    lastLesson: "2026-05-08",
  },
];

export default function Matching() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"suggestions" | "active">(
    "suggestions"
  );
  const [searchQuery, setSearchQuery] = useState("");

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700";
      case "accepted":
        return "bg-blue-100 text-blue-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "completed":
        return "bg-slate-100 text-slate-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Đang học";
      case "accepted":
        return "Đã chấp nhận";
      case "pending":
        return "Chờ xác nhận";
      case "completed":
        return "Hoàn thành";
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Quay lại
          </button>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Hệ thống ghép cặp
          </h1>
          <p className="text-lg text-slate-600">
            Quản lý ghép cặp giữa gia sư và học sinh
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-slate-200 mb-8 rounded-t-lg">
          <div className="flex gap-8 px-6">
            {[
              { id: "suggestions", label: "Gợi ý ghép cặp", icon: Zap },
              { id: "active", label: "Ghép cặp đang hoạt động", icon: CheckCircle },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() =>
                    setActiveTab(tab.id as "suggestions" | "active")
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

        {/* Search & Filter */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm gia sư hoặc học sinh..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Bộ lọc
            </Button>
          </div>
        </div>

        {/* Content */}
        {activeTab === "suggestions" && (
          <div className="space-y-4">
            {mockSuggestions.length === 0 ? (
              <div className="bg-white rounded-lg p-12 text-center">
                <Zap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600">
                  Không có gợi ý ghép cặp nào lúc này
                </p>
              </div>
            ) : (
              mockSuggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-slate-900 mb-1">
                        {suggestion.tutorName} ↔ {suggestion.studentName}
                      </h3>
                      <p className="text-slate-600 text-sm">
                        {suggestion.subject} • {suggestion.grade}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        {suggestion.matchScore}%
                      </div>
                      <p className="text-xs text-slate-500">Độ phù hợp</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-4 mb-4">
                    <p className="text-sm text-slate-700">
                      <strong>Lý do:</strong> {suggestion.reason}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className={`w-4 h-4 rounded-full ${
                              i < Math.floor(suggestion.tutorRating)
                                ? "bg-yellow-400"
                                : "bg-slate-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-slate-900">
                        {suggestion.tutorRating}
                      </span>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Chấp nhận
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Từ chối
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "active" && (
          <div className="space-y-4">
            {mockActiveMatches.length === 0 ? (
              <div className="bg-white rounded-lg p-12 text-center">
                <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600">
                  Không có ghép cặp đang hoạt động
                </p>
              </div>
            ) : (
              mockActiveMatches.map((match) => (
                <div
                  key={match.id}
                  className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-slate-900 mb-1">
                        {match.tutorName} ↔ {match.studentName}
                      </h3>
                      <p className="text-slate-600 text-sm">
                        {match.subject}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                        match.status
                      )}`}
                    >
                      {getStatusLabel(match.status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-600 mb-1">Ngày bắt đầu</p>
                      <p className="font-semibold text-slate-900">
                        {match.startDate}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-600 mb-1">
                        Buổi học cuối
                      </p>
                      <p className="font-semibold text-slate-900">
                        {match.lastLesson}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-600 mb-1">Tổng buổi</p>
                      <p className="font-semibold text-slate-900">8</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-600 mb-1">Đánh giá</p>
                      <p className="font-semibold text-slate-900">-</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => navigate(`/tutor/${match.id}`)}
                    >
                      Xem chi tiết
                    </Button>
                    {match.status === "active" && (
                      <Button
                        size="sm"
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                      >
                        Lên lịch buổi tiếp theo
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
