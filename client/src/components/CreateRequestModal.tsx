import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface CreateRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: RequestFormData) => void;
  isLoading?: boolean;
}

export interface RequestFormData {
  subject: string;
  gradeLevel: string;
  description: string;
  preferredTimeframe: string[];
  location: string;
  budget: number;
  studentName: string;
  studentPhone: string;
  lessonFrequency: string;
  lessonDuration: number;
  startDate: string;
  specialRequirements: string;
}

const subjects = [
  "Toán học",
  "Tiếng Anh",
  "Tiếng Trung",
  "Tiếng Pháp",
  "Hóa học",
  "Vật lý",
  "Sinh học",
  "Lịch sử",
  "Địa lý",
  "Lập trình",
  "Piano",
  "Violin",
  "Khác",
];

const gradeLevels = [
  "Lớp 1-3",
  "Lớp 4-6",
  "Lớp 7-9",
  "Lớp 10-12",
  "Đại học",
  "Khác",
];

const timeframes = [
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
  "Chủ nhật",
];

const lessonFrequencies = [
  "1 lần/tuần",
  "2 lần/tuần",
  "3 lần/tuần",
  "4 lần/tuần",
  "5 lần/tuần",
  "Linh hoạt",
];

export default function CreateRequestModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: CreateRequestModalProps) {
  const [formData, setFormData] = useState<RequestFormData>({
    subject: "",
    gradeLevel: "",
    description: "",
    preferredTimeframe: [],
    location: "",
    budget: 150000,
    studentName: "",
    studentPhone: "",
    lessonFrequency: "2 lần/tuần",
    lessonDuration: 60,
    startDate: "",
    specialRequirements: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "budget" || name === "lessonDuration" ? parseInt(value) : value,
    }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const toggleTimeframe = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      preferredTimeframe: prev.preferredTimeframe.includes(day)
        ? prev.preferredTimeframe.filter((d) => d !== day)
        : [...prev.preferredTimeframe, day],
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.subject.trim()) {
      newErrors.subject = "Vui lòng chọn môn học";
    }

    if (!formData.gradeLevel.trim()) {
      newErrors.gradeLevel = "Vui lòng chọn cấp lớp";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Vui lòng mô tả nhu cầu của bạn";
    }

    if (formData.preferredTimeframe.length === 0) {
      newErrors.preferredTimeframe = "Vui lòng chọn ít nhất một ngày";
    }

    if (!formData.location.trim()) {
      newErrors.location = "Vui lòng nhập địa chỉ học";
    }

    if (formData.budget < 50000) {
      newErrors.budget = "Ngân sách tối thiểu là 50.000 đ";
    }

    if (!formData.studentName.trim()) {
      newErrors.studentName = "Vui lòng nhập tên học sinh";
    }

    if (!formData.studentPhone.trim()) {
      newErrors.studentPhone = "Vui lòng nhập số điện thoại";
    } else if (!/^[0-9]{10}$/.test(formData.studentPhone.replace(/\D/g, ""))) {
      newErrors.studentPhone = "Số điện thoại không hợp lệ";
    }

    if (!formData.startDate) {
      newErrors.startDate = "Vui lòng chọn ngày bắt đầu";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Vui lòng kiểm tra lại thông tin");
      return;
    }

    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900">
            Tạo yêu cầu tìm gia sư
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-96">
          {/* Row 1: Subject & Grade Level */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Môn học *
              </label>
              <select
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Chọn môn học</option>
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
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
                name="gradeLevel"
                value={formData.gradeLevel}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Chọn cấp lớp</option>
                {gradeLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
              {errors.gradeLevel && (
                <p className="text-red-500 text-sm mt-1">{errors.gradeLevel}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Mô tả nhu cầu *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Ví dụ: Cần ôn tập chuẩn bị cho kỳ thi cuối kỳ, tập trung vào phần đại số..."
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.description && (
              <p className="text-red-500 text-sm mt-1">{errors.description}</p>
            )}
          </div>

          {/* Preferred Timeframe */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Ngày ưu tiên *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {timeframes.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleTimeframe(day)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    formData.preferredTimeframe.includes(day)
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-900 hover:bg-slate-200"
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
            {errors.preferredTimeframe && (
              <p className="text-red-500 text-sm mt-1">
                {errors.preferredTimeframe}
              </p>
            )}
          </div>

          {/* Row 2: Location & Budget */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Địa chỉ học *
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="Ví dụ: Quận 1, TP.HCM"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.location && (
                <p className="text-red-500 text-sm mt-1">{errors.location}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Ngân sách/giờ (đ) *
              </label>
              <input
                type="number"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                min="50000"
                step="10000"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.budget && (
                <p className="text-red-500 text-sm mt-1">{errors.budget}</p>
              )}
            </div>
          </div>

          {/* Row 3: Student Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Tên học sinh *
              </label>
              <input
                type="text"
                name="studentName"
                value={formData.studentName}
                onChange={handleChange}
                placeholder="Tên học sinh"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.studentName && (
                <p className="text-red-500 text-sm mt-1">{errors.studentName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Số điện thoại *
              </label>
              <input
                type="tel"
                name="studentPhone"
                value={formData.studentPhone}
                onChange={handleChange}
                placeholder="0123456789"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.studentPhone && (
                <p className="text-red-500 text-sm mt-1">{errors.studentPhone}</p>
              )}
            </div>
          </div>

          {/* Row 4: Lesson Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Tần suất học
              </label>
              <select
                name="lessonFrequency"
                value={formData.lessonFrequency}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {lessonFrequencies.map((freq) => (
                  <option key={freq} value={freq}>
                    {freq}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Thời lượng buổi (phút)
              </label>
              <select
                name="lessonDuration"
                value={formData.lessonDuration}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={30}>30 phút</option>
                <option value={45}>45 phút</option>
                <option value={60}>60 phút</option>
                <option value={90}>90 phút</option>
                <option value={120}>120 phút</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Ngày bắt đầu *
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.startDate && (
                <p className="text-red-500 text-sm mt-1">{errors.startDate}</p>
              )}
            </div>
          </div>

          {/* Special Requirements */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Yêu cầu đặc biệt
            </label>
            <textarea
              name="specialRequirements"
              value={formData.specialRequirements}
              onChange={handleChange}
              placeholder="Ví dụ: Gia sư phải có kinh nghiệm dạy thi DSE, nói tiếng Anh lưu loát..."
              rows={2}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-slate-200 bg-slate-50">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isLoading}
          >
            Hủy
          </Button>
          <Button
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? "Đang tạo..." : "Tạo yêu cầu"}
          </Button>
        </div>
      </div>
    </div>
  );
}
