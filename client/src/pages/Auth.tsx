import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Mail,
  Lock,
  User,
  Phone,
  AlertCircle,
  CheckCircle,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";

export default function Auth() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register" | "role">("role");
  const [userType, setUserType] = useState<"tutor" | "student" | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  const [registerData, setRegisterData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
  });

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({
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

  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setRegisterData((prev) => ({
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

  const validateLogin = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!loginData.email.trim()) {
      newErrors.email = "Vui lòng nhập email";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginData.email)) {
      newErrors.email = "Email không hợp lệ";
    }

    if (!loginData.password) {
      newErrors.password = "Vui lòng nhập mật khẩu";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateRegister = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!registerData.name.trim()) {
      newErrors.name = "Vui lòng nhập tên";
    }

    if (!registerData.email.trim()) {
      newErrors.email = "Vui lòng nhập email";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerData.email)) {
      newErrors.email = "Email không hợp lệ";
    }

    if (!registerData.password) {
      newErrors.password = "Vui lòng nhập mật khẩu";
    } else if (registerData.password.length < 6) {
      newErrors.password = "Mật khẩu phải có ít nhất 6 ký tự";
    }

    if (!registerData.confirmPassword) {
      newErrors.confirmPassword = "Vui lòng xác nhận mật khẩu";
    } else if (registerData.password !== registerData.confirmPassword) {
      newErrors.confirmPassword = "Mật khẩu không khớp";
    }

    if (!registerData.phone.trim()) {
      newErrors.phone = "Vui lòng nhập số điện thoại";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateLogin()) {
      return;
    }

    setIsLoading(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Redirect based on user type
      if (userType === "tutor") {
        navigate("/tutor-dashboard");
      } else {
        navigate("/student-dashboard");
      }
    } catch (error) {
      setErrors({ general: "Đăng nhập thất bại. Vui lòng thử lại." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateRegister()) {
      return;
    }

    setIsLoading(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // After successful registration, redirect to appropriate page
      if (userType === "tutor") {
        navigate("/become-tutor");
      } else {
        navigate("/find-tutor");
      }
    } catch (error) {
      setErrors({ general: "Đăng ký thất bại. Vui lòng thử lại." });
    } finally {
      setIsLoading(false);
    }
  };

  // Role Selection Screen
  if (mode === "role") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-slate-900 mb-2">
              Chào mừng đến TutorMatch
            </h1>
            <p className="text-lg text-slate-600">
              Hãy chọn vai trò của bạn để bắt đầu
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tutor Card */}
            <div
              className={`bg-white rounded-xl shadow-lg p-8 cursor-pointer transition-all hover:shadow-xl hover:scale-105 ${
                userType === "tutor"
                  ? "ring-2 ring-blue-600 bg-blue-50"
                  : "hover:bg-slate-50"
              }`}
              onClick={() => setUserType("tutor")}
            >
              <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">
                Tôi là Gia sư
              </h2>
              <p className="text-slate-600 text-center mb-6">
                Chia sẻ kiến thức, kiếm tiền bằng cách giảng dạy học sinh
              </p>
              <ul className="space-y-2 text-sm text-slate-600 mb-6">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Tạo hồ sơ chuyên nghiệp
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Nhận yêu cầu từ học sinh
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Kiếm thu nhập linh hoạt
                </li>
              </ul>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => setMode("register")}
              >
                Trở thành Gia sư
              </Button>
            </div>

            {/* Student Card */}
            <div
              className={`bg-white rounded-xl shadow-lg p-8 cursor-pointer transition-all hover:shadow-xl hover:scale-105 ${
                userType === "student"
                  ? "ring-2 ring-purple-600 bg-purple-50"
                  : "hover:bg-slate-50"
              }`}
              onClick={() => setUserType("student")}
            >
              <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">
                Tôi là Học sinh
              </h2>
              <p className="text-slate-600 text-center mb-6">
                Tìm gia sư phù hợp để cải thiện kỹ năng học tập
              </p>
              <ul className="space-y-2 text-sm text-slate-600 mb-6">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Tìm gia sư phù hợp
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Lên lịch học linh hoạt
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Học từ những gia sư tốt nhất
                </li>
              </ul>
              <Button
                className="w-full bg-purple-600 hover:bg-purple-700"
                onClick={() => setMode("register")}
              >
                Tìm Gia sư
              </Button>
            </div>
          </div>

          <div className="text-center mt-8">
            <p className="text-slate-600">
              Bạn đã có tài khoản?{" "}
              <button
                onClick={() => setMode("login")}
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                Đăng nhập
              </button>
            </p>
          </div>

          <div className="text-center mt-6">
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="flex items-center gap-2 mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại trang chủ
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Login Screen
  if (mode === "login") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <button
              onClick={() => setMode("role")}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold mb-6"
            >
              <ArrowLeft className="w-5 h-5" />
              Quay lại
            </button>

            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Đăng nhập
            </h1>
            <p className="text-slate-600 mb-8">
              Chào mừng quay lại TutorMatch
            </p>

            {errors.general && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{errors.general}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <Input
                    type="email"
                    name="email"
                    value={loginData.email}
                    onChange={handleLoginChange}
                    placeholder="your@email.com"
                    className="pl-10"
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-600 mt-1">{errors.email}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={loginData.password}
                    onChange={handleLoginChange}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-600 mt-1">{errors.password}</p>
                )}
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded"
                    defaultChecked
                  />
                  <span className="text-sm text-slate-600">Ghi nhớ tôi</span>
                </label>
                <a
                  href="#"
                  className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
                >
                  Quên mật khẩu?
                </a>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-2 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang đăng nhập...
                  </>
                ) : (
                  "Đăng nhập"
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-4">
              <div className="flex-1 h-px bg-slate-200"></div>
              <span className="text-sm text-slate-500">hoặc</span>
              <div className="flex-1 h-px bg-slate-200"></div>
            </div>

            {/* Social Login */}
            <Button
              variant="outline"
              className="w-full mb-3"
              disabled={isLoading}
            >
              <svg
                className="w-5 h-5 mr-2"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Đăng nhập với Google
            </Button>

            {/* Sign Up Link */}
            <p className="text-center text-slate-600">
              Chưa có tài khoản?{" "}
              <button
                onClick={() => setMode("register")}
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                Đăng ký
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Register Screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <button
            onClick={() => setMode("role")}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Quay lại
          </button>

          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Tạo tài khoản
          </h1>
          <p className="text-slate-600 mb-8">
            {userType === "tutor"
              ? "Đăng ký để trở thành gia sư"
              : "Đăng ký để tìm gia sư"}
          </p>

          {errors.general && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{errors.general}</p>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Tên đầy đủ
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <Input
                  type="text"
                  name="name"
                  value={registerData.name}
                  onChange={handleRegisterChange}
                  placeholder="Nguyễn Văn A"
                  className="pl-10"
                />
              </div>
              {errors.name && (
                <p className="text-xs text-red-600 mt-1">{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <Input
                  type="email"
                  name="email"
                  value={registerData.email}
                  onChange={handleRegisterChange}
                  placeholder="your@email.com"
                  className="pl-10"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-600 mt-1">{errors.email}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Số điện thoại
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <Input
                  type="tel"
                  name="phone"
                  value={registerData.phone}
                  onChange={handleRegisterChange}
                  placeholder="0123456789"
                  className="pl-10"
                />
              </div>
              {errors.phone && (
                <p className="text-xs text-red-600 mt-1">{errors.phone}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <Input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={registerData.password}
                  onChange={handleRegisterChange}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-600 mt-1">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Xác nhận mật khẩu
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <Input
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={registerData.confirmPassword}
                  onChange={handleRegisterChange}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {/* Terms */}
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="w-4 h-4 rounded mt-1"
                defaultChecked
              />
              <span className="text-sm text-slate-600">
                Tôi đồng ý với{" "}
                <a href="#" className="text-blue-600 hover:text-blue-700">
                  Điều khoản dịch vụ
                </a>{" "}
                và{" "}
                <a href="#" className="text-blue-600 hover:text-blue-700">
                  Chính sách bảo mật
                </a>
              </span>
            </label>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-2 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang tạo tài khoản...
                </>
              ) : (
                "Tạo tài khoản"
              )}
            </Button>
          </form>

          {/* Login Link */}
          <p className="text-center text-slate-600 mt-6">
            Đã có tài khoản?{" "}
            <button
              onClick={() => setMode("login")}
              className="text-blue-600 hover:text-blue-700 font-semibold"
            >
              Đăng nhập
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
