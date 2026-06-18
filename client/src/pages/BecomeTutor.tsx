import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import { ArrowLeft, Upload, Plus, X, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function BecomeTutor() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const createTutorMutation = trpc.tutors.create.useMutation();

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({
          ...prev,
          avatar: "Ảnh phải nhỏ hơn 5MB",
        }));
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      if (errors.avatar) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors.avatar;
          return newErrors;
        });
      }
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.bio.trim()) {
      newErrors.bio = "Vui lòng nhập giới thiệu về bạn";
    }

    if (formData.education.filter((e) => e.trim()).length === 0) {
      newErrors.education = "Vui lòng thêm ít nhất một trình độ học vấn";
    }

    if (formData.subjects.filter((s) => s.trim()).length === 0) {
      newErrors.subjects = "Vui lòng thêm ít nhất một môn học";
    }

    if (formData.grades.filter((g) => g.trim()).length === 0) {
      newErrors.grades = "Vui lòng thêm ít nhất một cấp lớp";
    }

    if (!formData.hourlyRate || parseFloat(formData.hourlyRate) <= 0) {
      newErrors.hourlyRate = "Vui lòng nhập mức giá hợp lệ";
    }

    if (!formData.location.trim()) {
      newErrors.location = "Vui lòng nhập địa chỉ";
    }

    if (!formData.district.trim()) {
      newErrors.district = "Vui lòng chọn quận";
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
      // Filter out empty values
      const cleanedData = {
        bio: formData.bio.trim(),
        education: formData.education.filter((e) => e.trim()),
        subjects: formData.subjects.filter((s) => s.trim()),
        grades: formData.grades.filter((g) => g.trim()),
        hourlyRate: formData.hourlyRate,
        experience: formData.experience || "0",
        location: formData.location.trim(),
        district: formData.district.trim(),
      };

      await createTutorMutation.mutateAsync(cleanedData);

      setSubmitted(true);
      toast.success("Hồ sơ gia sư đã được tạo thành công!");

      setTimeout(() => {
        navigate("/tutor-dashboard");
      }, 2000);
    } catch (error: any) {
      toast.error(error.message || "Có lỗi xảy ra khi tạo hồ sơ");
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
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Chúc mừng!
          </h2>
          <p className="text-slate-600 mb-6">
            Hồ sơ gia sư của bạn đã được tạo thành công. Bạn sẽ được chuyển đến dashboard để quản lý hồ sơ.
          </p>
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={() => navigate("/tutor-dashboard")}
          >
            Đi tới Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const districts = [
    "Trung tâm",
    "Quận 1",
    "Quận 2",
    "Quận 3",
    "Quận 4",
    "Quận 5",
    "Quận 6",
    "Quận 7",
    "Quận 8",
    "Quận 9",
    "Quận 10",
    "Quận 11",
    "Quận 12",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
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
            Tạo hồ sơ gia sư của bạn và bắt đầu kiếm tiền bằng cách giảng dạy
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8 space-y-8">
          {/* Avatar Section */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-4">
              Ảnh đại diện
            </label>
            <div className="flex gap-6 items-start">
              <div className="w-32 h-32 bg-slate-100 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Chưa có ảnh</p>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mb-2 cursor-pointer"
                    onClick={(e) => {
                      e.currentTarget
                        .closest("label")
                        ?.querySelector("input")
                        ?.click();
                    }}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Chọn ảnh
                  </Button>
                </label>
                <p className="text-xs text-slate-500">
                  JPG, PNG hoặc GIF. Tối đa 5MB.
                </p>
                {errors.avatar && (
                  <p className="text-xs text-red-600 mt-2">{errors.avatar}</p>
                )}
              </div>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Giới thiệu về bạn *
            </label>
            <Textarea
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              placeholder="Kể về bản thân, kinh nghiệm giảng dạy, phương pháp dạy học của bạn..."
              className="w-full h-32 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.bio && (
              <p className="text-xs text-red-600 mt-1">{errors.bio}</p>
            )}
          </div>

          {/* Education */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-4">
              Trình độ học vấn *
            </label>
            <div className="space-y-3">
              {formData.education.map((edu, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={edu}
                    onChange={(e) =>
                      handleArrayChange("education", index, e.target.value)
                    }
                    placeholder="VD: Cử nhân Toán học, Đại học Quốc gia"
                    className="flex-1"
                  />
                  {formData.education.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveField("education", index)}
                      className="text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddField("education")}
              className="mt-3 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Thêm trình độ
            </Button>
            {errors.education && (
              <p className="text-xs text-red-600 mt-2">{errors.education}</p>
            )}
          </div>

          {/* Subjects */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-4">
              Môn học giảng dạy *
            </label>
            <div className="space-y-3">
              {formData.subjects.map((subject, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={subject}
                    onChange={(e) =>
                      handleArrayChange("subjects", index, e.target.value)
                    }
                    placeholder="VD: Toán học, Tiếng Anh, Vật lý"
                    className="flex-1"
                  />
                  {formData.subjects.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveField("subjects", index)}
                      className="text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddField("subjects")}
              className="mt-3 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Thêm môn học
            </Button>
            {errors.subjects && (
              <p className="text-xs text-red-600 mt-2">{errors.subjects}</p>
            )}
          </div>

          {/* Grades */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-4">
              Cấp lớp giảng dạy *
            </label>
            <div className="space-y-3">
              {formData.grades.map((grade, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={grade}
                    onChange={(e) =>
                      handleArrayChange("grades", index, e.target.value)
                    }
                    placeholder="VD: Tiểu học, Trung học cơ sở, Trung học phổ thông"
                    className="flex-1"
                  />
                  {formData.grades.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveField("grades", index)}
                      className="text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddField("grades")}
              className="mt-3 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Thêm cấp lớp
            </Button>
            {errors.grades && (
              <p className="text-xs text-red-600 mt-2">{errors.grades}</p>
            )}
          </div>

          {/* Hourly Rate */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Mức giá theo giờ (VND) *
            </label>
            <Input
              type="number"
              name="hourlyRate"
              value={formData.hourlyRate}
              onChange={handleInputChange}
              placeholder="VD: 150000"
              className="w-full"
            />
            {errors.hourlyRate && (
              <p className="text-xs text-red-600 mt-1">{errors.hourlyRate}</p>
            )}
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
              placeholder="VD: 5"
              className="w-full"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Địa chỉ *
            </label>
            <Input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="VD: 123 Đường Nguyễn Huệ, Quận 1"
              className="w-full"
            />
            {errors.location && (
              <p className="text-xs text-red-600 mt-1">{errors.location}</p>
            )}
          </div>

          {/* District */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Quận/Huyện *
            </label>
            <select
              name="district"
              value={formData.district}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  district: e.target.value,
                }))
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Chọn quận/huyện</option>
              {districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
            {errors.district && (
              <p className="text-xs text-red-600 mt-1">{errors.district}</p>
            )}
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
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-2 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang tạo hồ sơ...
                </>
              ) : (
                "Tạo hồ sơ gia sư"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
