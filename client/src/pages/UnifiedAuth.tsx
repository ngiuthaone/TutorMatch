import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import {
  Mail,
  Phone,
  ArrowRight,
  CheckCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";

type AuthStep = "contact" | "otp" | "role" | "details";

export default function UnifiedAuth() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<AuthStep>("contact");
  const [contactMethod, setContactMethod] = useState<"email" | "phone">("email");
  const [contact, setContact] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [userRole, setUserRole] = useState<"tutor" | "student" | null>(null);

  const [userDetails, setUserDetails] = useState({
    name: "",
    password: "",
    confirmPassword: "",
  });

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Validate contact
    if (!contact.trim()) {
      setError(
        contactMethod === "email"
          ? "Vui lòng nhập email"
          : "Vui lòng nhập số điện thoại"
      );
      setIsLoading(false);
      return;
    }

    if (
      contactMethod === "email" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)
    ) {
      setError("Email không hợp lệ");
      setIsLoading(false);
      return;
    }

    // Simulate API call to check if user exists
    setTimeout(() => {
      // Mock: 50% chance of new user
      const isNew = Math.random() > 0.5;
      setIsNewUser(isNew);

      if (isNew) {
        // New user: go to role selection
        setStep("role");
      } else {
        // Existing user: go to OTP
        setStep("otp");
      }
      setIsLoading(false);
    }, 1000);
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!otp.trim() || otp.length !== 6) {
      setError("Vui lòng nhập mã OTP 6 chữ số");
      setIsLoading(false);
      return;
    }

    // Simulate OTP verification
    setTimeout(() => {
      // Mock: always success
      const userData = {
        isAuthenticated: true,
        userType: "student", // Mock: default to student for existing users
        contact: contact,
        name: "User",
      };
      localStorage.setItem("tutormatch_user", JSON.stringify(userData));
      navigate("/hub");
      setIsLoading(false);
    }, 1000);
  };

  const handleRoleSelect = (role: "tutor" | "student") => {
    setUserRole(role);
    setStep("details");
  };

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Validate details
    if (!userDetails.name.trim()) {
      setError("Vui lòng nhập tên");
      setIsLoading(false);
      return;
    }

    if (!userDetails.password) {
      setError("Vui lòng nhập mật khẩu");
      setIsLoading(false);
      return;
    }

    if (userDetails.password !== userDetails.confirmPassword) {
      setError("Mật khẩu không khớp");
      setIsLoading(false);
      return;
    }

    if (userDetails.password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự");
      setIsLoading(false);
      return;
    }

    // Simulate registration
    setTimeout(() => {
      const userData = {
        isAuthenticated: true,
        userType: userRole,
        contact: contact,
        name: userDetails.name,
      };
      localStorage.setItem("tutormatch_user", JSON.stringify(userData));

      // Redirect to appropriate onboarding
      if (userRole === "tutor") {
        navigate("/onboarding/tutor");
      } else {
        navigate("/onboarding/student");
      }
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            TutorMatch
          </h1>
          <p className="text-slate-600">
            {step === "contact" && "Nhập thông tin liên hệ"}
            {step === "otp" && "Xác minh OTP"}
            {step === "role" && "Chọn vai trò của bạn"}
            {step === "details" && "Hoàn thành hồ sơ"}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Step 1: Contact Information */}
        {step === "contact" && (
          <form onSubmit={handleContactSubmit} className="space-y-4">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
              {/* Contact Method Tabs */}
              <div className="flex gap-2 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setContactMethod("email");
                    setContact("");
                    setError("");
                  }}
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold transition ${
                    contactMethod === "email"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContactMethod("phone");
                    setContact("");
                    setError("");
                  }}
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold transition ${
                    contactMethod === "phone"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <Phone className="w-4 h-4 inline mr-2" />
                  Số điện thoại
                </button>
              </div>

              {/* Input Field */}
              <Input
                type={contactMethod === "email" ? "email" : "tel"}
                placeholder={
                  contactMethod === "email"
                    ? "your@email.com"
                    : "+852 1234 5678"
                }
                value={contact}
                onChange={(e) => {
                  setContact(e.target.value);
                  setError("");
                }}
                className="mb-6 py-3"
              />

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    Tiếp tục
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>

              <p className="text-xs text-slate-600 text-center mt-4">
                Chúng tôi sẽ gửi mã xác minh đến {contactMethod === "email" ? "email" : "số điện thoại"} của bạn
              </p>
            </div>
          </form>
        )}

        {/* Step 2: OTP Verification */}
        {step === "otp" && (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
              <p className="text-slate-600 mb-6 text-sm">
                Nhập mã OTP 6 chữ số được gửi đến{" "}
                <strong>{contact}</strong>
              </p>

              <Input
                type="text"
                placeholder="000000"
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setError("");
                }}
                maxLength={6}
                className="mb-6 py-3 text-center text-2xl tracking-widest font-mono"
              />

              <Button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang xác minh...
                  </>
                ) : (
                  <>
                    Xác minh
                    <CheckCircle className="w-5 h-5" />
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={() => setStep("contact")}
                className="w-full mt-4 py-2 text-blue-600 hover:text-blue-700 font-semibold"
              >
                ← Quay lại
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Role Selection */}
        {step === "role" && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
              <p className="text-slate-700 font-semibold mb-6">
                Bạn là ai?
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => handleRoleSelect("student")}
                  className="w-full p-4 border-2 border-slate-200 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition text-left"
                >
                  <h3 className="font-bold text-slate-900 mb-1">
                    👨‍🎓 Học sinh / Phụ huynh
                  </h3>
                  <p className="text-sm text-slate-600">
                    Tìm gia sư phù hợp cho con em
                  </p>
                </button>

                <button
                  onClick={() => handleRoleSelect("tutor")}
                  className="w-full p-4 border-2 border-slate-200 rounded-lg hover:border-purple-600 hover:bg-purple-50 transition text-left"
                >
                  <h3 className="font-bold text-slate-900 mb-1">
                    👨‍🏫 Gia sư
                  </h3>
                  <p className="text-sm text-slate-600">
                    Đăng ký làm gia sư và kiếm thêm thu nhập
                  </p>
                </button>
              </div>

              <button
                onClick={() => setStep("contact")}
                className="w-full mt-6 py-2 text-blue-600 hover:text-blue-700 font-semibold"
              >
                ← Quay lại
              </button>
            </div>
          </div>
        )}

        {/* Step 4: User Details */}
        {step === "details" && (
          <form onSubmit={handleDetailsSubmit} className="space-y-4">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
              <p className="text-slate-700 font-semibold mb-6">
                {userRole === "tutor"
                  ? "Đăng ký làm gia sư"
                  : "Tạo tài khoản học sinh"}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Tên của bạn
                  </label>
                  <Input
                    type="text"
                    placeholder="Nhập tên"
                    value={userDetails.name}
                    onChange={(e) => {
                      setUserDetails({ ...userDetails, name: e.target.value });
                      setError("");
                    }}
                    className="py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Mật khẩu
                  </label>
                  <Input
                    type="password"
                    placeholder="Ít nhất 6 ký tự"
                    value={userDetails.password}
                    onChange={(e) => {
                      setUserDetails({
                        ...userDetails,
                        password: e.target.value,
                      });
                      setError("");
                    }}
                    className="py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Xác nhận mật khẩu
                  </label>
                  <Input
                    type="password"
                    placeholder="Nhập lại mật khẩu"
                    value={userDetails.confirmPassword}
                    onChange={(e) => {
                      setUserDetails({
                        ...userDetails,
                        confirmPassword: e.target.value,
                      });
                      setError("");
                    }}
                    className="py-2"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang tạo tài khoản...
                  </>
                ) : (
                  <>
                    Tạo tài khoản
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={() => setStep("role")}
                className="w-full mt-4 py-2 text-blue-600 hover:text-blue-700 font-semibold"
              >
                ← Quay lại
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-8">
          Bằng cách tiếp tục, bạn đồng ý với{" "}
          <a href="#" className="text-blue-600 hover:underline">
            Điều khoản sử dụng
          </a>{" "}
          và{" "}
          <a href="#" className="text-blue-600 hover:underline">
            Chính sách bảo mật
          </a>
        </p>
      </div>
    </div>
  );
}
