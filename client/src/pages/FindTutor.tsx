import { useState } from "react";
import { useEffect } from "react";
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
    budget: 0,
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
      [name]: name === "budget" ? parseInt(value) || 0 : value,
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
      newErrors.description = "Vui lòng mô tả nhu cầu";
    }

    if (!formData.location.trim()) {
      newErrors.location = "Vui lòng nhập địa chỉ";
    }

    if (formData.budget <= 0) {
      newErrors.budget = "Vui lòng nhập ngân sách";
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
        gradeLevel: formData.grade.trim(),
        description: formData.description.trim(),
        preferredTimeframe: formData.preferredTimes
          ? formData.preferredTimes.split(",").map((t) => t.trim())
          : [],
        location: formData.location.trim(),
        studentName: user?.name || "",
        studentPhone: "",
        lessonFrequency: "2 lần/tuần",
        lessonDuration: 60,
        startDate: new Date().toISOString().split("T")[0],
        budget: formData.budget > 0 ? formData.budget : undefined,
      });

      setSubmitted(true);
      toast.success("Yêu cầu tìm gia sư đã được gửi thành công!");

      setTimeout(() => {
        navigate("/student-dashboard");
      }, 2000);
    } catch (error: any) {
      toast.error(error?.message || "Có lỗi xảy ra");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Cần đăng nhập
          </h2>
          <p className="text-slate-600 mb-6">
            Vui lòng đăng nhập để tạo yêu cầu tìm gia sư
          </p>
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={() => navigate("/auth")}
          >
            Đi đến đăng nhập
          </Button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Thành công!
          </h2>
          <p className="text-slate-600 mb-6">
            Yêu cầu của bạn đã được gửi. Chúng tôi sẽ tìm gia sư phù hợp cho
            bạn trong thời gian sớm nhất.
          </p>
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={() => navigate("/student-dashboard")}
          >
            Về Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Quay lại
          </button>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Tìm gia sư phù hợp
          </h1>
          <p className="text-lg text-slate-600">
            Hãy cho chúng tôi biết nhu cầu của bạn, chúng tôi sẽ tìm gia sư
            tốt nhất
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow-lg p-8 space-y-6"
        >
          {/* Subject & Grade */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Môn học *
              </label>
              <select
                name="subject"
                value={formData.subject}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Chọn môn học</option>
                <option value="Toán học">Toán học</option>
                <option value="Tiếng Anh">Tiếng Anh</option>
                <option value="Tiếng Trung">Tiếng Trung</option>
                <option value="Hóa học">Hóa học</option>
                <option value="Vật lý">Vật lý</option>
                <option value="Sinh học">Sinh học</option>
              </select>
              {errors.subject && (
                <p className="text-red-500 text-sm mt-1">{errors.subject}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Cấp lớp *
              </label>
              <select
                name="grade"
                value={formData.grade}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Chọn cấp lớp</option>
                <option value="Lớp 1-3">Lớp 1-3</option>
                <option value="Lớp 4-6">Lớp 4-6</option>
                <option value="Lớp 7-9">Lớp 7-9</option>
                <option value="Lớp 10-12">Lớp 10-12</option>
                <option value="Đại học">Đại học</option>
              </select>
              {errors.grade && (
                <p className="text-red-500 text-sm mt-1">{errors.grade}</p>
              )}
            </div>
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
              placeholder="Ví dụ: Cần ôn tập chuẩn bị cho kỳ thi cuối kỳ..."
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.description && (
              <p className="text-red-500 text-sm mt-1">{errors.description}</p>
            )}
          </div>

          {/* Location & Budget */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Địa chỉ học *
              </label>
              <Input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="Ví dụ: Quận 1, TP.HCM"
                className="w-full"
              />
              {errors.location && (
                <p className="text-red-500 text-sm mt-1">{errors.location}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Ngân sách/giờ (đ) *
              </label>
              <Input
                type="number"
                name="budget"
                value={formData.budget}
                onChange={handleInputChange}
                placeholder="150000"
                min="0"
                className="w-full"
              />
              {errors.budget && (
                <p className="text-red-500 text-sm mt-1">{errors.budget}</p>
              )}
            </div>
          </div>

          {/* Preferred Times */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Ngày ưu tiên
            </label>
            <Input
              type="text"
              name="preferredTimes"
              value={formData.preferredTimes}
              onChange={handleInputChange}
              placeholder="Ví dụ: Thứ 2, Thứ 4, Thứ 6"
              className="w-full"
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-4 pt-4">
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
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Đang gửi...
                </>
              ) : (
                "Gửi yêu cầu"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
