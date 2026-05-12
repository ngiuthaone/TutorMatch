import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import { ArrowLeft, Upload, Plus, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function BecomeTutor() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    bio: "",
    education: [""],
    subjects: [""],
    grades: [""],
    hourlyRate: "",
    experience: "",
    location: "",
    district: "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleArrayChange = (
    field: "education" | "subjects" | "grades",
    index: number,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].map((item, i) => (i === index ? value : item)),
    }));
  };

  const handleAddField = (field: "education" | "subjects" | "grades") => {
    setFormData((prev) => ({
      ...prev,
      [field]: [...prev[field], ""],
    }));
  };

  const handleRemoveField = (
    field: "education" | "subjects" | "grades",
    index: number
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Submit form data to backend
    console.log("Form data:", formData, "Avatar:", avatarFile);
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
            Vui lòng đăng nhập để trở thành gia sư trên TutorMatch.
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
            Đăng ký thành công!
          </h2>
          <p className="text-slate-600 mb-6">
            Hồ sơ của bạn đã được gửi. Chúng tôi sẽ xem xét và phê duyệt trong
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
            Trở thành gia sư TutorMatch
          </h1>
          <p className="text-lg text-slate-600">
            Hãy chia sẻ kiến thức của bạn và giúp học sinh đạt mục tiêu học tập
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow-lg p-8 space-y-8"
        >
          {/* Avatar Upload */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-4">
              Ảnh đại diện
            </label>
            <div className="flex gap-6 items-start">
              <div className="w-24 h-24 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Upload className="w-8 h-8 text-slate-400" />
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                  id="avatar-input"
                />
                <label
                  htmlFor="avatar-input"
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer font-semibold transition"
                >
                  Chọn ảnh
                </label>
                <p className="text-sm text-slate-600 mt-2">
                  JPG, PNG, hoặc GIF (tối đa 5MB)
                </p>
              </div>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Giới thiệu về bạn
            </label>
            <Textarea
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              placeholder="Kể về kinh nghiệm giảng dạy, phương pháp dạy học, và những thành tích của bạn..."
              className="w-full h-32 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Education */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-4">
              Trình độ học vấn
            </label>
            <div className="space-y-3">
              {formData.education.map((edu, idx) => (
                <div key={idx} className="flex gap-3">
                  <Input
                    type="text"
                    value={edu}
                    onChange={(e) =>
                      handleArrayChange("education", idx, e.target.value)
                    }
                    placeholder="Ví dụ: Cử nhân Toán học - Đại học HKU"
                    className="flex-1"
                  />
                  {formData.education.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveField("education", idx)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => handleAddField("education")}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold mt-2"
              >
                <Plus className="w-5 h-5" />
                Thêm trình độ
              </button>
            </div>
          </div>

          {/* Subjects */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-4">
              Môn học giảng dạy
            </label>
            <div className="space-y-3">
              {formData.subjects.map((subject, idx) => (
                <div key={idx} className="flex gap-3">
                  <Input
                    type="text"
                    value={subject}
                    onChange={(e) =>
                      handleArrayChange("subjects", idx, e.target.value)
                    }
                    placeholder="Ví dụ: Toán học, Tiếng Anh, Vật lý"
                    className="flex-1"
                    required
                  />
                  {formData.subjects.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveField("subjects", idx)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => handleAddField("subjects")}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold mt-2"
              >
                <Plus className="w-5 h-5" />
                Thêm môn học
              </button>
            </div>
          </div>

          {/* Grades */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-4">
              Cấp lớp giảng dạy
            </label>
            <div className="space-y-3">
              {formData.grades.map((grade, idx) => (
                <div key={idx} className="flex gap-3">
                  <Input
                    type="text"
                    value={grade}
                    onChange={(e) =>
                      handleArrayChange("grades", idx, e.target.value)
                    }
                    placeholder="Ví dụ: Tiểu học, Trung học cơ sở, Trung học phổ thông"
                    className="flex-1"
                    required
                  />
                  {formData.grades.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveField("grades", idx)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => handleAddField("grades")}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold mt-2"
              >
                <Plus className="w-5 h-5" />
                Thêm cấp lớp
              </button>
            </div>
          </div>

          {/* Hourly Rate */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Mức giá theo giờ (HKD)
            </label>
            <Input
              type="number"
              name="hourlyRate"
              value={formData.hourlyRate}
              onChange={handleInputChange}
              placeholder="Ví dụ: 300"
              min="0"
              step="10"
              className="w-full"
              required
            />
          </div>

          {/* Experience */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Kinh nghiệm giảng dạy (năm)
            </label>
            <Input
              type="number"
              name="experience"
              value={formData.experience}
              onChange={handleInputChange}
              placeholder="Ví dụ: 5"
              min="0"
              className="w-full"
            />
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Địa chỉ
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
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-2"
            >
              Gửi hồ sơ
            </Button>
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">
            Thông tin quan trọng
          </h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>
              • Hồ sơ của bạn sẽ được xem xét trong vòng 24 giờ
            </li>
            <li>
              • Chúng tôi có thể yêu cầu bạn cung cấp bằng cấp hoặc chứng chỉ
            </li>
            <li>
              • Bạn có thể cập nhật hồ sơ bất kỳ lúc nào
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
