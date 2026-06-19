import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLocation, useRoute } from "wouter";
import {
  Star,
  MapPin,
  BookOpen,
  DollarSign,
  ArrowLeft,
  MessageCircle,
  Calendar,
  Award,
  Users,
} from "lucide-react";

interface Review {
  id: number;
  studentName: string;
  rating: number;
  review: string;
  date: string;
}

// Mock data - replace with real data from backend
const mockTutorDetail = {
  id: 1,
  name: "Trần Minh Anh",
  avatar: "https://via.placeholder.com/200",
  subjects: ["Toán học", "Vật lý"],
  grades: ["Trung học phổ thông", "DSE"],
  hourlyRate: 350,
  rating: 4.9,
  totalRatings: 48,
  location: "Mong Kok, Kowloon",
  district: "Mong Kok",
  experience: 8,
  bio: "Gia sư toán học có 8 năm kinh nghiệm. Chuyên dạy DSE và IB. Đã giúp hơn 100 học sinh đạt điểm cao.",
  education: [
    "Cử nhân Toán học - Đại học HKU",
    "Chứng chỉ PGDE - Đại học Chinese University",
  ],
  availability: "Thứ 2-6: 18:00-21:00, Thứ 7-8: 10:00-18:00",
  reviews: [
    {
      id: 1,
      studentName: "Lý Minh Anh",
      rating: 5,
      review:
        "Gia sư rất tận tâm và giải thích rõ ràng. Con tôi đã cải thiện điểm từ 6.5 lên 8.5.",
      date: "2 tuần trước",
    },
    {
      id: 2,
      studentName: "Nguyễn Hoàng Phúc",
      rating: 5,
      review:
        "Phương pháp dạy rất hiệu quả. Tôi hiểu bài hơn sau mỗi buổi học.",
      date: "1 tháng trước",
    },
    {
      id: 3,
      studentName: "Đặng Thị Hương",
      rating: 4,
      review: "Gia sư rất chuyên nghiệp. Thời gian học linh hoạt.",
      date: "2 tháng trước",
    },
  ],
};

export default function TutorDetail() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/tutor/:id");
  const [showContactForm, setShowContactForm] = useState(false);
  const [tutorId] = useState(() => params?.id || "1");

  // Redirect to tutors list if no valid route match
  useEffect(() => {
    if (!match) {
      navigate("/tutors");
    }
  }, [match, navigate]);

  if (!match) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <button
            onClick={() => navigate("/tutors")}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Quay lại danh sách
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Profile Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="w-40 h-40 bg-slate-200 rounded-lg overflow-hidden">
                <img
                  src={mockTutorDetail.avatar}
                  alt={mockTutorDetail.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-slate-900 mb-2">
                {mockTutorDetail.name}
              </h1>

              {/* Rating */}
              <div className="flex items-center gap-2 mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-5 h-5 ${
                      i < Math.floor(mockTutorDetail.rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-slate-300"
                    }`}
                  />
                ))}
                <span className="text-xl font-bold text-slate-900 ml-2">
                  {mockTutorDetail.rating}
                </span>
                <span className="text-slate-600">
                  ({mockTutorDetail.totalRatings} đánh giá)
                </span>
              </div>

              {/* Bio */}
              <p className="text-slate-700 mb-6 leading-relaxed">
                {mockTutorDetail.bio}
              </p>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="w-5 h-5 text-blue-600" />
                    <span className="text-sm text-slate-600">Kinh nghiệm</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {mockTutorDetail.experience} năm
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-slate-600">Giá</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {mockTutorDetail.hourlyRate}/h
                  </div>
                </div>

                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-5 h-5 text-purple-600" />
                    <span className="text-sm text-slate-600">Học sinh</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    100+
                  </div>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex gap-4">
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 flex items-center justify-center gap-2"
                  onClick={() => setShowContactForm(true)}
                >
                  <MessageCircle className="w-5 h-5" />
                  Liên hệ gia sư
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold py-3 flex items-center justify-center gap-2"
                >
                  <Calendar className="w-5 h-5" />
                  Lên lịch học
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Education */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Award className="w-6 h-6 text-blue-600" />
              Trình độ học vấn
            </h2>
            <ul className="space-y-3">
              {mockTutorDetail.education.map((edu, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-slate-700">{edu}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Subjects & Grades */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-purple-600" />
              Chuyên môn
            </h2>

            <div className="mb-6">
              <h3 className="font-semibold text-slate-900 mb-2">Môn học</h3>
              <div className="flex flex-wrap gap-2">
                {mockTutorDetail.subjects.map((subject, idx) => (
                  <span
                    key={idx}
                    className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold"
                  >
                    {subject}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Cấp lớp</h3>
              <div className="flex flex-wrap gap-2">
                {mockTutorDetail.grades.map((grade, idx) => (
                  <span
                    key={idx}
                    className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-semibold"
                  >
                    {grade}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Location & Availability */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <MapPin className="w-6 h-6 text-red-600" />
              Địa điểm
            </h2>
            <p className="text-lg text-slate-700">{mockTutorDetail.location}</p>
            <p className="text-sm text-slate-600 mt-2">
              Quận: {mockTutorDetail.district}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-green-600" />
              Thời gian có sẵn
            </h2>
            <p className="text-slate-700">{mockTutorDetail.availability}</p>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Star className="w-6 h-6 text-yellow-500" />
            Đánh giá từ học sinh ({mockTutorDetail.reviews.length})
          </h2>

          <div className="space-y-6">
            {mockTutorDetail.reviews.map((review) => (
              <div
                key={review.id}
                className="border-b border-slate-200 pb-6 last:border-b-0"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-slate-900">
                    {review.studentName}
                  </h3>
                  <span className="text-xs text-slate-500">{review.date}</span>
                </div>

                <div className="flex gap-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < review.rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-slate-300"
                      }`}
                    />
                  ))}
                </div>

                <p className="text-slate-700">{review.review}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contact Modal */}
      {showContactForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              Liên hệ gia sư
            </h2>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setShowContactForm(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Tên của bạn
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Tin nhắn
                </label>
                <textarea
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Kể về nhu cầu học tập của bạn..."
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowContactForm(false)}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  Gửi
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
