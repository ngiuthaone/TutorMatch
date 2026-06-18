import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import CreateRequestModal, { RequestFormData } from "@/components/CreateRequestModal";
import { trpc } from "@/lib/trpc";
import {
  Search,
  Filter,
  Users,
  FileText,
  MessageCircle,
  LogOut,
  Menu,
  X,
  Star,
  MapPin,
  Clock,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";

interface UserData {
  name: string;
  email: string;
  userType: "tutor" | "student";
  phone?: string;
}

export default function Hub() {
  const [, navigate] = useLocation();
  const [user, setUser] = useState<UserData | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("discover");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [isCreateRequestModalOpen, setIsCreateRequestModalOpen] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    try {
      const userStr = localStorage.getItem("tutormatch_user");
      if (userStr) {
        const userData = JSON.parse(userStr);
        if (userData.isAuthenticated) {
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

  const createRequestMutation = trpc.requests.create.useMutation();
  const getMyRequestsQuery = trpc.requests.getMyRequests.useQuery(undefined, {
    enabled: isAuthenticated && user?.userType === "student",
  });

  const handleCreateRequest = async (formData: RequestFormData) => {
    setIsSubmittingRequest(true);
    try {
      await createRequestMutation.mutateAsync(formData);
      
      toast.success("Yêu cầu đã được tạo thành công!");
      setIsCreateRequestModalOpen(false);
      
      // Refresh requests list
      await getMyRequestsQuery.refetch();
    } catch (error: any) {
      toast.error(error?.message || "Tạo yêu cầu thất bại. Vui lòng thử lại.");
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const goToDashboard = () => {
    if (user?.userType === "tutor") {
      navigate("/tutor-dashboard");
    } else {
      navigate("/student-dashboard");
    }
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
            Vui lòng đăng nhập để truy cập Hub.
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

  const tutors = [
    {
      id: 1,
      name: "Nguyễn Văn A",
      subjects: ["Toán học", "Vật lý"],
      grade: "Lớp 10-12",
      price: 200000,
      rating: 4.8,
      reviews: 45,
      location: "Quận 1",
      experience: 5,
      image: "N",
    },
    {
      id: 2,
      name: "Trần Thị B",
      subjects: ["Tiếng Anh", "Tiếng Pháp"],
      grade: "Lớp 6-9",
      price: 150000,
      rating: 4.9,
      reviews: 62,
      location: "Quận 3",
      experience: 7,
      image: "T",
    },
    {
      id: 3,
      name: "Lê Minh C",
      subjects: ["Hóa học", "Sinh học"],
      grade: "Lớp 10-12",
      price: 180000,
      rating: 4.7,
      reviews: 38,
      location: "Quận 7",
      experience: 4,
      image: "L",
    },
    {
      id: 4,
      name: "Phạm Hoàng D",
      subjects: ["Toán học", "Lập trình"],
      grade: "Lớp 12",
      price: 250000,
      rating: 5.0,
      reviews: 28,
      location: "Quận 1",
      experience: 6,
      image: "P",
    },
  ];

  const studentRequests = [
    {
      id: 1,
      name: "Nguyễn Thị E",
      subject: "Toán học",
      grade: "Lớp 10",
      budget: 200000,
      location: "Quận 1",
      timeframe: "Thứ 2, 4, 6",
      description: "Cần ôn tập chuẩn bị cho kỳ thi cuối kỳ",
      postedAt: "2 giờ trước",
    },
    {
      id: 2,
      name: "Trần Văn F",
      subject: "Tiếng Anh",
      grade: "Lớp 9",
      budget: 150000,
      location: "Quận 3",
      timeframe: "Thứ 3, 5, 7",
      description: "Muốn cải thiện kỹ năng nói tiếng Anh",
      postedAt: "4 giờ trước",
    },
    {
      id: 3,
      name: "Lê Hương G",
      subject: "Hóa học",
      grade: "Lớp 12",
      budget: 180000,
      location: "Quận 7",
      timeframe: "Thứ 2, 3, 5",
      description: "Ôn tập cho kỳ thi THPT quốc gia",
      postedAt: "6 giờ trước",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
            <h1 className="text-2xl font-bold text-slate-900">TutorMatch</h1>
          </div>

          <div className="hidden lg:flex items-center gap-6">
            <nav className="flex items-center gap-4">
              <button
                onClick={() => setActiveTab("discover")}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeTab === "discover"
                    ? "bg-blue-100 text-blue-600 font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Khám phá
              </button>
              {user.userType === "student" && (
                <button
                  onClick={() => setActiveTab("requests")}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    activeTab === "requests"
                      ? "bg-blue-100 text-blue-600 font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Yêu cầu của tôi
                </button>
              )}
              {user.userType === "tutor" && (
                <button
                  onClick={() => setActiveTab("requests")}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    activeTab === "requests"
                      ? "bg-blue-100 text-blue-600 font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Yêu cầu từ học sinh
                </button>
              )}
              <button
                onClick={() => setActiveTab("messages")}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === "messages"
                    ? "bg-blue-100 text-blue-600 font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                Tin nhắn
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-600">
                {user.userType === "tutor" ? "Gia sư" : "Học sinh"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={goToDashboard}
              className="hidden sm:flex"
            >
              Dashboard
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 p-4 space-y-2">
            <button
              onClick={() => {
                setActiveTab("discover");
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2 rounded-lg hover:bg-slate-100"
            >
              Khám phá
            </button>
            {user.userType === "student" && (
              <button
                onClick={() => {
                  setActiveTab("requests");
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2 rounded-lg hover:bg-slate-100"
              >
                Yêu cầu của tôi
              </button>
            )}
            {user.userType === "tutor" && (
              <button
                onClick={() => {
                  setActiveTab("requests");
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2 rounded-lg hover:bg-slate-100"
              >
                Yêu cầu từ học sinh
              </button>
            )}
            <button
              onClick={() => {
                setActiveTab("messages");
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Tin nhắn
            </button>
            <button
              onClick={goToDashboard}
              className="w-full text-left px-4 py-2 rounded-lg hover:bg-slate-100"
            >
              Dashboard
            </button>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Discover Tab */}
        {activeTab === "discover" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                {user.userType === "tutor"
                  ? "Khám phá yêu cầu từ học sinh"
                  : "Khám phá gia sư"}
              </h2>
              <p className="text-slate-600">
                {user.userType === "tutor"
                  ? "Tìm những yêu cầu phù hợp với bạn"
                  : "Tìm gia sư phù hợp cho nhu cầu của bạn"}
              </p>
            </div>

            {/* Search and Filter */}
            <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder={
                      user.userType === "tutor"
                        ? "Tìm yêu cầu..."
                        : "Tìm gia sư..."
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="relative">
                  <Filter className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                  >
                    <option value="all">Tất cả môn học</option>
                    <option value="math">Toán học</option>
                    <option value="english">Tiếng Anh</option>
                    <option value="chemistry">Hóa học</option>
                    <option value="physics">Vật lý</option>
                  </select>
                </div>

                <Button className="bg-blue-600 hover:bg-blue-700 w-full">
                  Tìm kiếm
                </Button>
              </div>
            </div>

            {/* Matching Suggestions (for students with active requests) */}
            {user.userType === "student" && getMyRequestsQuery.data && getMyRequestsQuery.data.length > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm p-6 border border-blue-200">
                <h3 className="text-xl font-bold text-slate-900 mb-4">Gia sư được đề xuất cho bạn</h3>
                <p className="text-slate-600 mb-4">Dựa trên yêu cầu của bạn, đây là những gia sư phù hợp nhất</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {tutors.slice(0, 4).map((tutor) => (
                    <div
                      key={tutor.id}
                      className="bg-white rounded-lg p-4 border border-slate-200 hover:shadow-md transition-shadow"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center mb-3 flex-shrink-0">
                        <span className="text-lg font-bold text-white">{tutor.image}</span>
                      </div>
                      <h4 className="font-semibold text-slate-900 text-sm">{tutor.name}</h4>
                      <div className="flex items-center gap-1 mt-1 mb-2">
                        <span className="text-yellow-500 text-sm">★</span>
                        <span className="text-sm font-semibold text-slate-900">{tutor.rating}</span>
                      </div>
                      <p className="text-xs text-slate-600 mb-2">{tutor.subjects.join(", ")}</p>
                      <p className="text-sm font-semibold text-blue-600">{tutor.price.toLocaleString()} đ/giờ</p>
                      <Button className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-xs" size="sm">
                        Liên hệ
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tutors List (for students) */}
            {user.userType === "student" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tutors.map((tutor) => (
                  <div
                    key={tutor.id}
                    className="bg-white rounded-lg shadow-sm p-6 border border-slate-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl font-bold text-white">
                          {tutor.image}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900">
                          {tutor.name}
                        </h3>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-yellow-500">★</span>
                          <span className="text-sm font-semibold text-slate-900">
                            {tutor.rating}
                          </span>
                          <span className="text-sm text-slate-600">
                            ({tutor.reviews})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <p className="text-sm text-slate-600">
                        <strong>Môn học:</strong> {tutor.subjects.join(", ")}
                      </p>
                      <p className="text-sm text-slate-600 flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {tutor.location}
                      </p>
                      <p className="text-sm text-slate-600 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {tutor.experience} năm kinh nghiệm
                      </p>
                      <p className="text-sm text-slate-600 flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        {tutor.price.toLocaleString()} đ/giờ
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                        size="sm"
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Liên hệ
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        size="sm"
                        onClick={() => navigate(`/tutor/${tutor.id}`)}
                      >
                        Xem hồ sơ
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Student Requests (for tutors) */}
            {user.userType === "tutor" && (
              <div className="space-y-4">
                {studentRequests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-white rounded-lg shadow-sm p-6 border border-slate-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-slate-900 text-lg">
                          {request.subject} - {request.grade}
                        </h3>
                        <p className="text-sm text-slate-600">
                          Từ: {request.name}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">
                        {request.postedAt}
                      </span>
                    </div>

                    <p className="text-slate-600 mb-4">{request.description}</p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-slate-600 font-semibold">
                          Ngân sách
                        </p>
                        <p className="text-sm font-semibold text-slate-900">
                          {request.budget.toLocaleString()} đ/giờ
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 font-semibold">
                          Địa điểm
                        </p>
                        <p className="text-sm font-semibold text-slate-900">
                          {request.location}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 font-semibold">
                          Thời gian
                        </p>
                        <p className="text-sm font-semibold text-slate-900">
                          {request.timeframe}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 font-semibold">
                          Cấp lớp
                        </p>
                        <p className="text-sm font-semibold text-slate-900">
                          {request.grade}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button className="flex-1 bg-blue-600 hover:bg-blue-700">
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Liên hệ học sinh
                      </Button>
                      <Button variant="outline" className="flex-1">
                        Xem chi tiết
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === "requests" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                {user.userType === "tutor"
                  ? "Yêu cầu từ học sinh"
                  : "Yêu cầu của tôi"}
              </h2>
            </div>

            {user.userType === "student" && (
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => setIsCreateRequestModalOpen(true)}
              >
                + Tạo yêu cầu mới
              </Button>
            )}

            <div className="space-y-4">
              {getMyRequestsQuery.isLoading && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-slate-600">Đang tải yêu cầu...</p>
                </div>
              )}
              {getMyRequestsQuery.error && (
                <div className="text-center py-8 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-red-600 mb-3">Không thể tải yêu cầu. Vui lòng thử lại.</p>
                  <Button
                    size="sm"
                    onClick={() => getMyRequestsQuery.refetch()}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Thử lại
                  </Button>
                </div>
              )}
              {getMyRequestsQuery.data && getMyRequestsQuery.data.length === 0 && (
                <div className="text-center py-8 bg-slate-50 rounded-lg">
                  <p className="text-slate-600">Bạn chưa tạo yêu cầu nào. Hãy bấm nút "Tạo yêu cầu mới" để bắt đầu.</p>
                </div>
              )}
              {getMyRequestsQuery.data?.map((request: any) => (
                <div
                  key={request.id}
                  className="bg-white rounded-lg shadow-sm p-6 border border-slate-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {request.subject} - {request.gradeLevel || request.grade}
                      </h3>
                    </div>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      request.status === "matched"
                        ? "bg-blue-100 text-blue-700"
                        : request.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : request.status === "in_progress"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-slate-100 text-slate-700"
                    }`}>
                      {request.status === "matched"
                        ? "Đã ghép cặp"
                        : request.status === "completed"
                        ? "Hoàn thành"
                        : request.status === "in_progress"
                        ? "Đang học"
                        : "Đang tìm"}
                    </span>
                  </div>

                  <p className="text-slate-600 text-sm mb-3">
                    {request.description}
                  </p>

                  <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {request.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {request.preferredTimeframe || request.timeframe}
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {parseInt(request.budget || 0).toLocaleString()} đ/giờ
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      size="sm"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Liên hệ
                    </Button>
                    <Button variant="outline" className="flex-1" size="sm">
                      Xem chi tiết
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === "messages" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                Tin nhắn
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Conversations List */}
              <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-900">Cuộc trò chuyện</h3>
                </div>
                <div className="divide-y divide-slate-200">
                  {[1, 2, 3].map((i) => (
                    <button
                      key={i}
                      className="w-full p-4 text-left hover:bg-slate-50 transition-colors border-l-4 border-transparent hover:border-blue-600"
                    >
                      <p className="font-semibold text-slate-900">
                        {user.userType === "tutor"
                          ? `Nguyễn Thị ${String.fromCharCode(64 + i)}`
                          : `Nguyễn Văn ${String.fromCharCode(64 + i)}`}
                      </p>
                      <p className="text-sm text-slate-600 truncate">
                        Cảm ơn, tôi rất hài lòng...
                      </p>
                      <p className="text-xs text-slate-500 mt-1">2 giờ trước</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Area */}
              <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-96">
                <div className="p-4 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-900">
                    Nguyễn Văn A
                  </h3>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="flex justify-start">
                    <div className="bg-slate-100 rounded-lg p-3 max-w-xs">
                      <p className="text-slate-900 text-sm">
                        Xin chào, bạn có thể giúp tôi học toán không?
                      </p>
                      <p className="text-xs text-slate-500 mt-1">10:30</p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <div className="bg-blue-600 text-white rounded-lg p-3 max-w-xs">
                      <p className="text-sm">
                        Tất nhiên, tôi rất vui lòng giúp bạn!
                      </p>
                      <p className="text-xs text-blue-100 mt-1">10:35</p>
                    </div>
                  </div>

                  <div className="flex justify-start">
                    <div className="bg-slate-100 rounded-lg p-3 max-w-xs">
                      <p className="text-slate-900 text-sm">
                        Bạn có thể dạy tôi về phương trình bậc hai không?
                      </p>
                      <p className="text-xs text-slate-500 mt-1">10:40</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-200">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nhập tin nhắn..."
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      Gửi
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Create Request Modal */}
      <CreateRequestModal
        isOpen={isCreateRequestModalOpen}
        onClose={() => setIsCreateRequestModalOpen(false)}
        onSubmit={handleCreateRequest}
        isLoading={isSubmittingRequest}
      />
    </div>
  );
}
