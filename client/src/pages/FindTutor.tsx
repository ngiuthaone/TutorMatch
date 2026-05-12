import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import { ArrowLeft, Calendar, MapPin, DollarSign } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function FindTutor() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    subject: "",
    grade: "",
    description: "",
    preferredTimes: "",
    location: "",
    district: "",
    budget: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Submit form data to backend
    console.log("Form data:", formData);
    setSubmitted(true);
    setTimeout(() => {
      navigate("/");
    }, 2000);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 shadow-lg max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Cần đăng nhập
          </h2>
          <p className="text-slate-600 mb-6">
            Vui lòng đăng nhập để tìm gia sư trên TutorMatch.
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

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 shadow-lg max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Yêu cầu đã gửi!
          </h2>
          <p className="text-slate-600 mb-6">
            Chúng tôi sẽ tìm kiếm gia sư phù hợp và liên hệ với bạn trong vòng
            24 giờ.
          </p>
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={() => navigate("/")}
          >
            Quay lại trang chủ
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
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
            Tìm gia sư phù hợp
          </h1>
          <p className="text-lg text-slate-600">
            Hãy cho chúng tôi biết nhu cầu của bạn, chúng tôi sẽ tìm gia sư tốt
            nhất
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow-lg p-8 space-y-8"
        >
          {/* Subject */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Môn học cần học
            </label>
            <select
              name="subject"
              value={formData.subject}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">-- Chọn môn học --</option>
              <option value="Toán học">Toán học</option>
              <option value="Tiếng Anh">Tiếng Anh</option>
              <option value="Tiếng Trung">Tiếng Trung</option>
              <option value="Vật lý">Vật lý</option>
              <option value="Hóa học">Hóa học</option>
              <option value="Sinh học">Sinh học</option>
              <option value="Lịch sử">Lịch sử</option>
              <option value="Địa lý">Địa lý</option>
              <option value="Khác">Khác</option>
            </select>
          </div>

          {/* Grade */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Cấp lớp
            </label>
            <select
              name="grade"
              value={formData.grade}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">-- Chọn cấp lớp --</option>
              <option value="Tiểu học">Tiểu học</option>
              <option value="Trung học cơ sở">Trung học cơ sở</option>
              <option value="Trung học phổ thông">Trung học phổ thông</option>
              <option value="IB">IB</option>
              <option value="DSE">DSE</option>
              <option value="Đại học">Đại học</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Mô tả nhu cầu
            </label>
            <Textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Kể về mục tiêu học tập, điểm yếu, hoặc bất kỳ thông tin nào giúp gia sư hiểu rõ hơn..."
              className="w-full h-32 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Preferred Times */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Khung thời gian ưu tiên
            </label>
            <Input
              type="text"
              name="preferredTimes"
              value={formData.preferredTimes}
              onChange={handleInputChange}
              placeholder="Ví dụ: Thứ 2, 4, 6 từ 18:00-20:00"
              className="w-full"
            />
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                Địa chỉ học
              </label>
              <Input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="Ví dụ: Mong Kok, Kowloon"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Quận (District)
              </label>
              <Input
                type="text"
                name="district"
                value={formData.district}
                onChange={handleInputChange}
                placeholder="Ví dụ: Mong Kok"
                className="w-full"
              />
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
              Ngân sách mong muốn (HKD/giờ)
            </label>
            <Input
              type="number"
              name="budget"
              value={formData.budget}
              onChange={handleInputChange}
              placeholder="Ví dụ: 300"
              min="0"
              step="10"
              className="w-full"
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-4 pt-6 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/")}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-2"
            >
              Gửi yêu cầu
            </Button>
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-8 bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h3 className="font-semibold text-purple-900 mb-2">
            Cách thức hoạt động
          </h3>
          <ul className="text-sm text-purple-800 space-y-2">
            <li>
              • Gửi yêu cầu của bạn và chúng tôi sẽ tìm kiếm gia sư phù hợp
            </li>
            <li>
              • Bạn sẽ nhận được danh sách các gia sư được đề xuất
            </li>
            <li>
              • Duyệt hồ sơ, xem đánh giá, và chọn gia sư mà bạn thích
            </li>
            <li>
              • Lên lịch buổi học đầu tiên và bắt đầu học
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
