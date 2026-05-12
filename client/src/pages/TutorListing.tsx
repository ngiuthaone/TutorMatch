import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import {
  Star,
  MapPin,
  BookOpen,
  DollarSign,
  Search,
  ChevronDown,
  MessageCircle,
} from "lucide-react";

interface Tutor {
  id: number;
  name: string;
  avatar: string;
  subjects: string[];
  grades: string[];
  hourlyRate: number;
  rating: number;
  totalRatings: number;
  location: string;
  district: string;
  experience: number;
  bio: string;
}

// Mock data - replace with real data from backend
const mockTutors: Tutor[] = [
  {
    id: 1,
    name: "Trần Minh Anh",
    avatar: "https://via.placeholder.com/100",
    subjects: ["Toán học", "Vật lý"],
    grades: ["Trung học phổ thông", "DSE"],
    hourlyRate: 350,
    rating: 4.9,
    totalRatings: 48,
    location: "Mong Kok, Kowloon",
    district: "Mong Kok",
    experience: 8,
    bio: "Gia sư toán học có 8 năm kinh nghiệm. Chuyên dạy DSE và IB.",
  },
  {
    id: 2,
    name: "Lý Hoàng Phúc",
    avatar: "https://via.placeholder.com/100",
    subjects: ["Tiếng Anh", "IELTS"],
    grades: ["Tiểu học", "Trung học cơ sở"],
    hourlyRate: 300,
    rating: 4.8,
    totalRatings: 35,
    location: "Central, Hong Kong Island",
    district: "Central",
    experience: 6,
    bio: "Giáo viên tiếng Anh bản xứ với bằng TEFL. Chuyên dạy trẻ em.",
  },
  {
    id: 3,
    name: "Nguyễn Thị Hương",
    avatar: "https://via.placeholder.com/100",
    subjects: ["Tiếng Trung", "Văn học"],
    grades: ["Trung học cơ sở", "Trung học phổ thông"],
    hourlyRate: 280,
    rating: 4.7,
    totalRatings: 42,
    location: "Causeway Bay, Hong Kong Island",
    district: "Causeway Bay",
    experience: 5,
    bio: "Gia sư tiếng Trung có kinh nghiệm dạy học sinh quốc tế.",
  },
  {
    id: 4,
    name: "Đặng Hồng Nhân",
    avatar: "https://via.placeholder.com/100",
    subjects: ["Hóa học", "Sinh học"],
    grades: ["Trung học phổ thông", "IB"],
    hourlyRate: 330,
    rating: 4.9,
    totalRatings: 51,
    location: "Shatin, New Territories",
    district: "Shatin",
    experience: 10,
    bio: "Giáo viên khoa học chuyên dạy IB và DSE.",
  },
];

export default function TutorListing() {
  const [, navigate] = useLocation();
  const [filters, setFilters] = useState({
    subject: "",
    grade: "",
    maxPrice: "",
    minRating: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filteredTutors = mockTutors.filter((tutor) => {
    const matchesSubject =
      !filters.subject ||
      tutor.subjects.some((s) =>
        s.toLowerCase().includes(filters.subject.toLowerCase())
      );
    const matchesGrade =
      !filters.grade ||
      tutor.grades.some((g) =>
        g.toLowerCase().includes(filters.grade.toLowerCase())
      );
    const matchesPrice =
      !filters.maxPrice || tutor.hourlyRate <= parseInt(filters.maxPrice);
    const matchesRating = tutor.rating >= filters.minRating;
    const matchesSearch =
      !searchQuery ||
      tutor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tutor.subjects.some((s) =>
        s.toLowerCase().includes(searchQuery.toLowerCase())
      );

    return (
      matchesSubject &&
      matchesGrade &&
      matchesPrice &&
      matchesRating &&
      matchesSearch
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">
            Danh sách gia sư
          </h1>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Tìm kiếm gia sư, môn học..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              Bộ lọc
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  showFilters ? "rotate-180" : ""
                }`}
              />
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white border-b border-slate-200 sticky top-20 z-40">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Môn học
                </label>
                <Input
                  type="text"
                  placeholder="Ví dụ: Toán học"
                  value={filters.subject}
                  onChange={(e) =>
                    setFilters({ ...filters, subject: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Cấp lớp
                </label>
                <Input
                  type="text"
                  placeholder="Ví dụ: Trung học phổ thông"
                  value={filters.grade}
                  onChange={(e) =>
                    setFilters({ ...filters, grade: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Giá tối đa (HKD/h)
                </label>
                <Input
                  type="number"
                  placeholder="Ví dụ: 400"
                  value={filters.maxPrice}
                  onChange={(e) =>
                    setFilters({ ...filters, maxPrice: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Đánh giá tối thiểu
                </label>
                <select
                  value={filters.minRating}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      minRating: parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="0">Tất cả</option>
                  <option value="4">4 sao trở lên</option>
                  <option value="4.5">4.5 sao trở lên</option>
                  <option value="4.8">4.8 sao trở lên</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() =>
                  setFilters({
                    subject: "",
                    grade: "",
                    maxPrice: "",
                    minRating: 0,
                  })
                }
              >
                Xóa bộ lọc
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => setShowFilters(false)}
              >
                Áp dụng
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-4 text-slate-600">
          Tìm thấy {filteredTutors.length} gia sư
        </div>

        {filteredTutors.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center">
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              Không tìm thấy gia sư
            </h3>
            <p className="text-slate-600 mb-6">
              Hãy thử thay đổi bộ lọc hoặc tìm kiếm khác
            </p>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() =>
                setFilters({
                  subject: "",
                  grade: "",
                  maxPrice: "",
                  minRating: 0,
                })
              }
            >
              Xóa bộ lọc
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTutors.map((tutor) => (
              <div
                key={tutor.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6">
                  <div className="flex gap-4">
                    <div className="w-16 h-16 bg-slate-200 rounded-full flex-shrink-0 overflow-hidden">
                      <img
                        src={tutor.avatar}
                        alt={tutor.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-slate-900">
                        {tutor.name}
                      </h3>
                      <div className="flex items-center gap-1 mt-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < Math.floor(tutor.rating)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-slate-300"
                            }`}
                          />
                        ))}
                        <span className="text-sm font-semibold text-slate-900 ml-1">
                          {tutor.rating}
                        </span>
                        <span className="text-xs text-slate-600">
                          ({tutor.totalRatings})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                  <p className="text-sm text-slate-600 line-clamp-2">
                    {tutor.bio}
                  </p>

                  {/* Subjects */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-semibold text-slate-900">
                        Môn học
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tutor.subjects.map((subject, idx) => (
                        <span
                          key={idx}
                          className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full"
                        >
                          {subject}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Grades */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-semibold text-slate-900">
                        Cấp lớp
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tutor.grades.map((grade, idx) => (
                        <span
                          key={idx}
                          className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full"
                        >
                          {grade}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Location */}
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    {tutor.location}
                  </div>

                  {/* Experience */}
                  <div className="text-sm text-slate-600">
                    {tutor.experience} năm kinh nghiệm
                  </div>

                  {/* Price */}
                  <div className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    {tutor.hourlyRate}/giờ
                  </div>
                </div>

                {/* Actions */}
                <div className="px-6 pb-6 flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate(`/tutor/${tutor.id}`)}
                  >
                    Xem chi tiết
                  </Button>
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-2"
                    onClick={() => navigate(`/tutor/${tutor.id}`)}
                  >
                    <MessageCircle className="w-4 h-4" />
                    Liên hệ
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
