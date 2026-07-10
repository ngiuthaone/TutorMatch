# TutorMatch MVP

Working demo marketplace 2 chiều cho học sinh/phụ huynh và gia sư dạy 1-1. App hiện có Node backend tối giản để lưu dữ liệu demo vào file `data/state.json` qua REST API, thay vì chỉ giữ trong browser.

## Demo Accounts

| Role | Email | Password | Ghi chú |
| --- | --- | --- | --- |
| Phụ huynh/Học sinh | `student@example.com` | `Pass123!` | Có sẵn 1 nhu cầu học và 1 cuộc trao đổi |
| Gia sư đã xác minh | `tutor@example.com` | `Pass123!` | Hồ sơ đã được duyệt, xuất hiện trong danh sách phù hợp |
| Gia sư IELTS đã xác minh | `lan.tutor@example.com` | `Pass123!` | Hồ sơ dùng cho preview trang chủ và nhu cầu tiếng Anh/IELTS |
| Gia sư Tin học/Toán đã xác minh | `khoa.tutor@example.com` | `Pass123!` | Hồ sơ dùng cho preview trang chủ và nhu cầu Toán/Tin học |
| Quản trị viên | `admin@example.com` | `Pass123!` | Duyệt hoặc từ chối hồ sơ gia sư |
| Gia sư chờ duyệt | `pending.tutor@example.com` | `Pass123!` | Dùng để test trạng thái chờ duyệt/bị từ chối |

## Run Local

Yêu cầu Node.js. Trong workspace Codex hiện tại có thể chạy bằng runtime bundled:

```bash
/Users/soshi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node server.js
```

Hoặc nếu máy đã có Node trong `PATH`:

```bash
npm start
```

Mở `http://localhost:4173`.

Backend API đang có:

```text
GET    /api/health
GET    /api/state
POST   /api/state
DELETE /api/state
```

Frontend sẽ đọc state từ `/api/state` khi chạy cùng Node server. Nếu server chưa có dữ liệu, frontend seed dữ liệu mẫu lần đầu và ghi lại vào `data/state.json`. Khi mở app bằng `file://`, frontend mới fallback về `localStorage`.

## Public Demo

Demo hiện đang được expose qua Cloudflare Quick Tunnel:

```text
https://sure-peas-therapeutic-skilled.trycloudflare.com
```

Quick Tunnel là URL tạm thời, còn truy cập được khi tiến trình `cloudflared` trong phiên làm việc này còn chạy. Với deploy lâu dài, đưa các file static trong repo lên Vercel/Netlify/Cloudflare Pages theo cấu hình bên dưới.

Reset dữ liệu backend demo:

```bash
curl -X DELETE http://127.0.0.1:4173/api/state
```

Sau đó reload trang để seed lại dữ liệu mẫu.

## Test

```bash
/Users/soshi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tests/state-machine.test.js
```

Test hiện kiểm tra rule quan trọng: khi một cuộc ghép được thanh toán thành công, các cuộc trao đổi khác của cùng nhu cầu tự hủy bởi `system`, có lý do hủy, và nhu cầu học được đóng.

## Deploy

Target hiện tại:

- Vercel serve frontend tĩnh.
- Render chạy backend Node `server.js`.
- Supabase/Postgres là database production kế tiếp; bản demo hiện vẫn lưu state vào file `data/state.json`.

Vercel settings:

```text
Framework Preset: Other
Build Command: bỏ trống
Output Directory: bỏ trống
Install Command: bỏ trống hoặc mặc định
```

Repo có sẵn `vercel.json` để phục vụ app như SPA và cache asset trong `assets/`. Các route `/api/*` trên Vercel trả 404 có chủ ý; frontend sẽ gọi Render backend nếu `config.js` có `window.TUTORMATCH_API_BASE_URL`.

Ví dụ `config.js` trên Vercel:

```js
window.TUTORMATCH_API_BASE_URL = "https://your-render-service.onrender.com";
```

Render settings:

```text
Runtime: Node
Start command: node server.js
Environment:
  HOST=0.0.0.0
  CORS_ORIGIN=https://your-vercel-domain.vercel.app
```

Nếu cần dữ liệu dùng chung production, dùng Supabase làm nguồn dữ liệu chính thay vì `data/state.json`, vì file local sẽ mất khi platform restart container không giữ disk.

## Environment Variables

Backend file demo:

```text
PORT=4173
HOST=0.0.0.0
CORS_ORIGIN=https://your-vercel-domain.vercel.app
```

Frontend runtime config nằm trong `config.js`:

```js
window.TUTORMATCH_API_BASE_URL = "https://your-render-service.onrender.com";
```

Trong bản production thật nên thay file backend bằng:

- Auth: Supabase Auth hoặc Clerk
- DB: Postgres/Supabase
- Storage: Supabase Storage cho bằng cấp
- Payment: Stripe Checkout test/live mode
- Realtime chat: Supabase Realtime hoặc WebSocket service

## MVP Flow

1. Phụ huynh/học sinh đăng ký, khai rõ vai trò, rồi tạo nhu cầu học.
2. Danh sách gợi ý chỉ hiện gia sư đã được xác minh.
3. Phụ huynh xem hồ sơ rút gọn, thông tin liên hệ vẫn được giữ kín.
4. Phụ huynh hoặc gia sư mở cuộc trao đổi 1-1 trong app.
5. Khi hai bên thống nhất, app tạo thư xác nhận lưu số buổi, lịch, học phí và hình thức học.
6. Phụ huynh thanh toán khoản xác nhận lịch học: app chuyển cuộc ghép sang đã thanh toán, đóng nhu cầu học, hủy các cuộc trao đổi khác của cùng nhu cầu.
7. Sau thanh toán, app mở khóa liên hệ trực tiếp. Các buổi sau buổi đầu hai bên tự thu chi trực tiếp ngoài nền tảng theo BRD giai đoạn 1.
8. Hai bên xác nhận đã bắt đầu học, đánh dấu buổi học đã xong, rồi đánh giá 2 chiều.
9. Gia sư phải đủ 16 tuổi, học vấn tối thiểu lớp 10 và có file minh chứng trước khi nộp hồ sơ.
10. Quản trị viên duyệt/từ chối hồ sơ; gia sư bị từ chối thấy lý do và có thể nộp lại.

## Data Schema

```text
User(
  id, name, email, password, role[student|tutor|admin],
  studentKind[parent|self_student], phone, address, createdAt
)

TutorProfile(
  userId, subjects[], regions[], format[online|home|both],
  hourlyRate, age, educationLevel, availability[], bio, credentialFiles[],
  verificationStatus[pending_review|approved|rejected],
  rejectionReason, ratingAvg
)

StudentRequest(
  id, studentId, subjects[], grade, region,
  format[online|home], schedule[], budgetMin, budgetMax,
  studentsCount, note, status[open|closed], createdAt
)

Case(
  id, requestId, tutorId,
  status[pending|negotiating|confirmed|awaiting_payment|paid|active|completed|cancelled],
  cancelledReason, cancelledBy, createdAt
)

ConfirmationLetter(
  id, caseId, lessonsCount, schedule, fee, format, note, createdAt
)

Payment(
  id, caseId, payerId, amount, type[connection_fee], status[paid], createdAt
)

Message(
  id, caseId, senderId, content, createdAt
)

Review(
  id, caseId, reviewerId, revieweeId, rating, comment, createdAt
)
```

## Business Rules Implemented

- Liên hệ trực tiếp chỉ hiển thị khi case ở `paid`, `active` hoặc `completed`.
- Tutor chưa `approved` không xuất hiện trong match hoặc browse flow phù hợp.
- Gia sư không đủ 16 tuổi, dưới lớp 10, hoặc thiếu file minh chứng không nộp được hồ sơ duyệt.
- Request không match tutor nào vẫn mở và hiện empty state gợi ý mở rộng tiêu chí.
- Tutor có thể hủy/từ chối case trước thanh toán; mọi hủy case lưu `cancelledReason` và `cancelledBy`.
- Khi một case đạt thanh toán, các case khác cùng request tự `cancelled` với lý do hệ thống.
- Thư xác nhận và chat hiển thị policy hủy/đổi lịch 48-72 giờ trước buổi học.
- Khoản thanh toán xác nhận lịch học tính theo công thức `min(học phí x tối đa 2 buổi, 500.000đ)`.
- Giai đoạn 1 không thu các buổi học sau trong app; hai bên tự thu chi trực tiếp theo BRD.
