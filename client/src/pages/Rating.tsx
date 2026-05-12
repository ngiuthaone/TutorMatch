import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import { Star, ArrowLeft, AlertCircle } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Rating() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [ratingType, setRatingType] = useState<"tutor" | "student" | null>(null);
  const [score, setScore] = useState(0);
  const [hoverScore, setHoverScore] = useState(0);
  const [review, setReview] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 shadow-lg max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Cần đăng nhập
          </h2>
          <p className="text-slate-600 mb-6">
            Vui lòng đăng nhập để đánh giá.
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ratingType) {
      setError("Vui lòng chọn loại đánh giá");
      return;
    }

    if (score === 0) {
      setError("Vui lòng chọn số sao");
      return;
    }

    if (!review.trim()) {
      setError("Vui lòng viết nhận xét");
      return;
    }

    // TODO: Submit rating to backend
    console.log({
      ratingType,
      score,
      review,
      userId: user?.id,
    });

    setSubmitted(true);
    setTimeout(() => {
      navigate("/");
    }, 2000);
  };

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
            Cảm ơn bạn!
          </h2>
          <p className="text-slate-600 mb-6">
            Đánh giá của bạn đã được ghi nhận và sẽ giúp cải thiện chất lượng dịch vụ.
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
      <div className="max-w-2xl mx-auto">
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
            Đánh giá buổi học
          </h1>
          <p className="text-lg text-slate-600">
            Chia sẻ trải nghiệm của bạn để giúp cộng đồng TutorMatch phát triển
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow-lg p-8 space-y-8"
        >
          {/* Alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Rating Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-4">
              Bạn là ai?
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  id: "student",
                  label: "Tôi là học sinh",
                  description: "Đánh giá gia sư của tôi",
                },
                {
                  id: "tutor",
                  label: "Tôi là gia sư",
                  description: "Đánh giá học sinh của tôi",
                },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setRatingType(option.id as "tutor" | "student");
                    setError("");
                  }}
                  className={`p-6 rounded-lg border-2 transition text-left ${
                    ratingType === option.id
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-blue-300"
                  }`}
                >
                  <h3 className="font-bold text-slate-900 mb-1">
                    {option.label}
                  </h3>
                  <p className="text-sm text-slate-600">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          {ratingType && (
            <>
              {/* Star Rating */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-4">
                  {ratingType === "student"
                    ? "Bạn đánh giá gia sư của mình bao nhiêu sao?"
                    : "Bạn đánh giá học sinh của mình bao nhiêu sao?"}
                </label>
                <div className="flex gap-4 justify-center py-8">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => {
                        setScore(star);
                        setError("");
                      }}
                      onMouseEnter={() => setHoverScore(star)}
                      onMouseLeave={() => setHoverScore(0)}
                      className="transition transform hover:scale-110"
                    >
                      <Star
                        className={`w-12 h-12 ${
                          star <= (hoverScore || score)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-slate-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {score > 0 && (
                  <p className="text-center text-slate-600 font-semibold">
                    {score} trên 5 sao
                  </p>
                )}
              </div>

              {/* Review Text */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Nhận xét chi tiết
                </label>
                <Textarea
                  value={review}
                  onChange={(e) => {
                    setReview(e.target.value);
                    setError("");
                  }}
                  placeholder={
                    ratingType === "student"
                      ? "Kể về phương pháp giảng dạy, khả năng giải thích, tính chuyên nghiệp của gia sư..."
                      : "Kể về sự tập trung, tiến độ học tập, thái độ học của học sinh..."
                  }
                  className="w-full h-32 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Rating Breakdown */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="font-semibold text-blue-900 mb-4">
                  {ratingType === "student"
                    ? "Gợi ý cho đánh giá gia sư:"
                    : "Gợi ý cho đánh giá học sinh:"}
                </h3>
                <ul className="space-y-2 text-sm text-blue-800">
                  {ratingType === "student" ? (
                    <>
                      <li>
                        • <strong>5 sao:</strong> Xuất sắc, rất hài lòng với
                        buổi học
                      </li>
                      <li>
                        • <strong>4 sao:</strong> Tốt, đạt được mục tiêu học tập
                      </li>
                      <li>
                        • <strong>3 sao:</strong> Bình thường, có thể cải thiện
                      </li>
                      <li>
                        • <strong>2 sao:</strong> Không tốt, cần cải thiện
                      </li>
                      <li>
                        • <strong>1 sao:</strong> Rất không hài lòng
                      </li>
                    </>
                  ) : (
                    <>
                      <li>
                        • <strong>5 sao:</strong> Học sinh rất tích cực và tập
                        trung
                      </li>
                      <li>
                        • <strong>4 sao:</strong> Học sinh tích cực, có tiến độ
                        tốt
                      </li>
                      <li>
                        • <strong>3 sao:</strong> Học sinh bình thường, có thể
                        tập trung hơn
                      </li>
                      <li>
                        • <strong>2 sao:</strong> Học sinh không tập trung, cần
                        cải thiện
                      </li>
                      <li>
                        • <strong>1 sao:</strong> Học sinh không hợp tác
                      </li>
                    </>
                  )}
                </ul>
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
                  Gửi đánh giá
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
