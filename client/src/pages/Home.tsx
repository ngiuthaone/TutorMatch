import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Star, Users, Zap, CheckCircle, ArrowRight } from "lucide-react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const features = [
    {
      icon: Zap,
      title: "Ghép cặp nhanh chóng",
      description: "Tìm gia sư phù hợp trong vài phút, không cần chờ đợi lâu",
    },
    {
      icon: Users,
      title: "Gia sư chất lượng cao",
      description: "Đội ngũ gia sư được kiểm chứng và có kinh nghiệm giảng dạy",
    },
    {
      icon: Star,
      title: "Đánh giá minh bạch",
      description: "Hệ thống đánh giá hai chiều giúp bạn chọn gia sư tốt nhất",
    },
  ];

  const stats = [
    { number: "1000+", label: "Gia sư đã đăng ký" },
    { number: "500+", label: "Học sinh hài lòng" },
    { number: "98%", label: "Tỷ lệ thành công" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            TutorMatch
          </div>
          <div className="flex gap-4">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-slate-600 py-2">
                  Xin chào, {user?.name || "bạn"}
                </span>
                <Button
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
                >
                  Bảng điều khiển
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => navigate("/login")}>
                Đăng nhập
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 -z-10 opacity-40">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl"></div>
        </div>

        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight">
            Kết nối với gia sư tuyệt vời
            <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Nâng cao trình độ học tập
            </span>
          </h1>

          <p className="text-xl text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed">
            TutorMatch là nền tảng kết nối học sinh và gia sư hàng đầu tại Hồng Kông. 
            Tìm gia sư phù hợp, lên lịch học và bắt đầu cải thiện kết quả học tập ngay hôm nay.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-6 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all"
              onClick={() => navigate("/auth")}
            >
              <span>Trở thành gia sư</span>
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="border-2 border-purple-600 text-purple-600 hover:bg-purple-50 px-8 py-6 text-lg font-semibold rounded-lg transition-all"
              onClick={() => navigate("/tutors")}
            >
              <span>Xem danh sách gia sư</span>
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 md:gap-8 mb-16">
            {stats.map((stat, idx) => (
              <div key={idx} className="bg-white rounded-lg p-6 shadow-sm">
                <div className="text-3xl md:text-4xl font-bold text-blue-600 mb-2">
                  {stat.number}
                </div>
                <div className="text-sm text-slate-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-center text-slate-900 mb-16">
            Tại sao chọn TutorMatch?
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div
                  key={idx}
                  className="p-8 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 hover:shadow-lg transition-shadow"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-center text-slate-900 mb-16">
            Cách thức hoạt động
          </h2>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                step: "1",
                title: "Đăng ký",
                description: "Tạo tài khoản và hoàn thành hồ sơ của bạn",
              },
              {
                step: "2",
                title: "Tìm kiếm",
                description: "Duyệt danh sách gia sư hoặc gửi yêu cầu",
              },
              {
                step: "3",
                title: "Ghép cặp",
                description: "Được kết nối với gia sư phù hợp",
              },
              {
                step: "4",
                title: "Bắt đầu học",
                description: "Lên lịch và bắt đầu buổi học đầu tiên",
              },
            ].map((item, idx) => (
              <div key={idx} className="relative">
                <div className="bg-white rounded-lg p-6 shadow-sm h-full">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-slate-600 text-sm">{item.description}</p>
                </div>
                {idx < 3 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-0.5 bg-gradient-to-r from-blue-400 to-transparent"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-center text-slate-900 mb-16">
            Những lời đánh giá từ người dùng
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: "Lý Minh Anh",
                role: "Phụ huynh",
                content:
                  "Con tôi đã cải thiện điểm toán từ 6.5 lên 8.5 chỉ sau 3 tháng. Gia sư rất tận tâm!",
                rating: 5,
              },
              {
                name: "Trần Hoàng Phúc",
                role: "Học sinh",
                content:
                  "Tìm được gia sư tiếng Anh tuyệt vời qua TutorMatch. Rất hài lòng với dịch vụ!",
                rating: 5,
              },
              {
                name: "Nguyễn Thị Hương",
                role: "Gia sư",
                content:
                  "Nền tảng rất chuyên nghiệp. Tôi đã có thêm nhiều học sinh qua đây.",
                rating: 5,
              },
            ].map((testimonial, idx) => (
              <div
                key={idx}
                className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-8 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-5 h-5 fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>
                <p className="text-slate-700 mb-6 leading-relaxed">
                  "{testimonial.content}"
                </p>
                <div>
                  <p className="font-bold text-slate-900">{testimonial.name}</p>
                  <p className="text-sm text-slate-600">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Sẵn sàng bắt đầu?
          </h2>
          <p className="text-xl text-blue-100 mb-12">
            Hãy tham gia cộng đồng TutorMatch ngay hôm nay và trải nghiệm sự khác biệt.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-blue-600 hover:bg-slate-100 px-8 py-6 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all"
              onClick={() => navigate("/auth")}
            >
              Trở thành gia sư
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="border-2 border-white text-white hover:bg-white/10 px-8 py-6 text-lg font-semibold rounded-lg transition-all"
              onClick={() => navigate("/tutors")}
            >
              Duyệt danh sách gia sư
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-white font-bold mb-4">TutorMatch</h3>
              <p className="text-sm">
                Nền tảng kết nối gia sư và học sinh hàng đầu tại Hồng Kông.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Cho học sinh</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition">
                    Tìm gia sư
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Cách thức hoạt động
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Cho gia sư</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition">
                    Trở thành gia sư
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Điều khoản sử dụng
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Liên hệ</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="mailto:support@tutormatch.hk" className="hover:text-white transition">
                    support@tutormatch.hk
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-700 pt-8 text-center text-sm">
            <p>
              © 2026 TutorMatch. Tất cả quyền được bảo lưu.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
