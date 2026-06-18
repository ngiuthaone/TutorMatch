import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import { ArrowLeft, Calendar, MapPin, DollarSign, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function FindTutor() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const createRequestMutation = trpc.requests.create.useMutation();

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.subject.trim()) {
      newErrors.subject = "Vui lòng chọn môn học";
    }

    if (!formData.grade.trim()) {
      newErrors.grade = "Vui lòng chọn cấp lớp";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Vui lòng mô tả nhu cầu của bạn";
    }

    if (!formData.location.trim()) {
      newErrors.location = "Vui lòng nhập địa chỉ học";
    }

    if (!formData.district.trim()) {
      newErrors.district = "Vui lòng chọn quận/huyện";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    setIsLoading(true);

    try {
      await createRequestMutation.mutateAsync({
        subject: formData.subject.trim(),
        grade: formData.grade.trim(),
        description: formData.description.trim(),
        preferredTimes: formData.preferredTimes || undefined,
        location: formData.location.trim(),
        district: formData.district.trim(),
        budget: formData.budget || undefined,
      });

      setSubmitted(true);
      toast.success("Yêu cầu tìm gia sư đã được gửi thành công!");

      setTimeout(() => {
        navigate("/student-dashboard");
      }, 2000);
    } catch (error: any) {
      toast.error(error.message || "Có lỗi xảy ra khi gửi yêu cầu");
      setIsLoading(false);
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
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Yêu cầu đã được gửi!
          </h2>
          <p className="text-slate-600 mb-6">
            Yêu cầu tìm gia sư của bạn đã được gửi thành công. Chúng tôi sẽ tìm kiếm gia sư phù hợp và liên hệ với bạn sớm.
          </p>
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={() => navigate("/student-dashboard")}
          >
            Xem Dashboard
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
            Hãy cho chúng tôi biết nhu cầu của bạn, chúng tôi sẽ tìm gia sư tốt nhất
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow-lg p-8 space-y-8"
        >
          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Cách thức hoạt động:</p>
              <p>Sau khi bạn gửi yêu cầu, chúng tôi sẽ tìm kiếm gia sư phù hợp và liên hệ với bạn trong vòng 24 giờ.</p>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Môn học cần học *
            </label>
            <select
              name="subject"
              value={formData.subject}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Chọn môn học --</option>
              <option value="Toán học">Toán học</option>
              <option value="Tiếng Anh">Tiếng Anh</option>
              <option value="Tiếng Việt">Tiếng Việt</option>
              <option value="Tiếng Trung">Tiếng Trung</option>
              <option value="Vật lý">Vật lý</option>
              <option value="Hóa học">Hóa học</option>
              <option value="Sinh học">Sinh học</option>
              <option value="Lịch sử">Lịch sử</option>
              <option value="Địa lý">Địa lý</option>
              <option value="Tin học">Tin học</option>
              <option value="Khác">Khác</option>
            </select>
            {errors.subject && (
              <p className="text-xs text-red-600 mt-1">{errors.subject}</p>
            )}
          </div>

          {/* Grade */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Cấp lớp *
            </label>
            <select
              name="grade"
              value={formData.grade}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Chọn cấp lớp --</option>
              <option value="Tiểu học">Tiểu học</option>
              <option value="Trung học cơ sở">Trung học cơ sở</option>
              <option value="Trung học phổ thông">Trung học phổ thông</option>
              <option value="IB">IB</option>
              <option value="DSE">DSE</option>
              <option value="Đại học">Đại học</option>
            </select>
            {errors.grade && (
              <p className="text-xs text-red-600 mt-1">{errors.grade}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Mô tả nhu cầu *
            </label>
            <Textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Kể về mục tiêu học tập, điểm yếu, hoặc bất kỳ thông tin nào giúp gia sư hiểu rõ hơn..."
              className="w-full h-32 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.description && (
              <p className="text-xs text-red-600 mt-1">{errors.description}</p>
            )}
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

          {/* Location & District */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                Địa chỉ học *
              </label>
              <Input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="Ví dụ: 123 Đường Nguyễn Huệ"
                className="w-full"
              />
              {errors.location && (
                <p className="text-xs text-red-600 mt-1">{errors.location}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Quận/Huyện *
              </label>
              <select
                name="district"
                value={formData.district}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Chọn quận/huyện</option>
                <option value="Quận 1">Quận 1</option>
                <option value="Quận 2">Quận 2</option>
                <option value="Quận 3">Quận 3</option>
                <option value="Quận 4">Quận 4</option>
                <option value="Quận 5">Quận 5</option>
                <option value="Quận 6">Quận 6</option>
                <option value="Quận 7">Quận 7</option>
                <option value="Quận 8">Quận 8</option>
                <option value="Quận 9">Quận 9</option>
                <option value="Quận 10">Quận 10</option>
                <option value="Quận 11">Quận 11</option>
                <option value="Quận 12">Quận 12</option>
              </select>
              {errors.district && (
                <p className="text-xs text-red-600 mt-1">{errors.district}</p>
              )}
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
              Ngân sách mong muốn (VND/giờ)
            </label>
            <Input
              type="number"
              name="budget"
              value={formData.budget}
              onChange={handleInputChange}
              placeholder="Ví dụ: 150000"
              min="0"
              step="10000"
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
              disabled={isLoading}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-2 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang gửi yêu cầu...
                </>
              ) : (
                "Gửi yêu cầu"
              )}
            </Button>
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-8 bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h3 className="font-semibold text-purple-900 mb-3">
            Quy trình tìm gia sư
          </h3>
          <ul className="text-sm text-purple-800 space-y-2">
            <li className="flex items-start gap-2">
              <span className="font-bold text-purple-600">1.</span>
              <span>Gửi yêu cầu của bạn và chúng tôi sẽ tìm kiếm gia sư phù hợp</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-purple-600">2.</span>
              <span>Bạn sẽ nhận được danh sách các gia sư được đề xuất</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-purple-600">3.</span>
              <span>Duyệt hồ sơ, xem đánh giá, và chọn gia sư mà bạn thích</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-purple-600">4.</span>
              <span>Lên lịch buổi học đầu tiên và bắt đầu học</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
