# TutorMatch - Project TODO

## Phase 1: Database Architecture & Schema
- [x] Design Drizzle ORM schema with all required tables
- [x] Create migration SQL and apply via webdev_execute_sql
- [x] Verify database schema and types

## Phase 2: Landing Page
- [x] Create landing page with platform overview
- [x] Add two clear CTA buttons: "Become a Tutor" and "Find a Tutor"
- [x] Design elegant, professional layout with proper typography and colors

## Phase 3: Tutor Registration & Profile
- [x] Build tutor registration form (personal info, subjects, education, avatar, hourly rate)
- [x] Create tutor profile management page
- [x] Implement profile picture upload to storage
- [x] Add form validation and error handling
- [x] Enhanced form with real submission and validation
- [x] Tutor dashboard with profile, requests, lessons, ratings

## Phase 4: Student/Parent Request Form
- [x] Build tutoring request form (subject, grade level, time frame, location, budget)
- [x] Implement form validation
- [x] Create request submission and confirmation flow
- [x] Enhanced form with real submission and validation
- [x] Student dashboard with requests, tutors, lessons, ratings

## Phase 5: Tutor Listing Page
- [x] Build tutor list page with filtering (subject, grade level, price, rating)
- [x] Implement search and filter functionality
- [x] Create responsive grid layout for tutor cards

## Phase 6: Tutor Profile Detail Page
- [x] Build detailed tutor profile page
- [x] Display personal info, teaching experience, student reviews
- [x] Add contact/request button

## Phase 7: Matching System
- [x] Implement matching logic (automatic suggestions based on student request)
- [x] Build admin manual matching interface
- [x] Create request management pages for both tutors and students

## Phase 8: Two-way Rating System
- [x] Build student rating form for tutors (after lesson completion)
- [x] Build tutor rating form for students (after lesson completion)
- [x] Implement rating display on tutor profiles
- [x] Add logic to only enable ratings after lesson completion

## Phase 9: Admin CMS (/admin)
- [x] Create password-protected /admin route
- [x] Build admin dashboard with tutor management
- [x] Build student request management interface
- [x] Implement manual matching interface
- [x] Add tutor profile review and approval system
- [x] Create admin analytics/overview

## Phase 10: UI/UX Polish & Testing
- [x] Ensure elegant, professional design throughout
- [x] Test all forms and workflows
- [x] Verify responsive design on mobile/tablet
- [x] Test admin authentication and access control
- [x] Create final checkpoint

## Completed Features
- Landing page with CTA buttons
- Enhanced tutor registration form with validation and real submission
- Enhanced student request form with validation and real submission
- Tutor listing with filters
- Tutor detail page
- Password-protected admin CMS
- Database schema with 8 tables
- tRPC procedures for tutors, requests, ratings
- Two-way rating system page
- Backend database helpers
- Matching system with suggestions and active matches
- Complete UI/UX with elegant design throughout
- Tutor Dashboard (profile, requests, lessons, ratings, settings)
- Student Dashboard (requests, tutors, lessons, ratings, settings)
- Form validation with error messages
- Loading states and success feedback
- Comprehensive Auth page (role selection, login, register)
- Protected routes with authentication checks
- CTA buttons redirect to Auth page

## Phase 11: Hub & Connection System
- [x] Create main Hub page after login for discovery and connection
- [x] Build tutor listing page with search, filters, and contact button
- [x] Build student requests listing page for tutors
- [x] Implement messaging/chat system between tutors and students
- [x] Update routing to redirect to Hub after login
- [x] Add connection/contact functionality

## Phase 12: Student Request Creation (Stapps-inspired)
- [x] Create request creation modal/form with all required fields
- [x] Connect form to backend tRPC to save requests to database
- [x] Display student's requests list on Hub
- [x] Implement automatic matching system to suggest tutors
- [x] Add request status tracking (pending, matched, in-progress, completed)


## Phase 13: Stapps-Inspired Redesign

### Phase 1: Guest Experience (Xem trước khi đăng nhập)
- [ ] Cho phép khách vãng lai xem danh sách gia sư mà không cần đăng nhập
- [ ] Hiển thị đánh giá, giá, môn học, khu vực trên trang chủ
- [ ] Thêm nút "Xem hồ sơ" cho từng gia sư (không yêu cầu đăng nhập)
- [ ] Hiển thị USP và số liệu thống kê

### Phase 2: Unified Auth (Gộp đăng ký/đăng nhập)
- [ ] Tạo trang auth duy nhất: nhập email/phone
- [ ] Phân biệt người cũ (vào thẳng Hub) vs người mới (chọn role)
- [ ] Tách luồng theo role từ lúc chọn CTA

### Phase 3: Role-Specific Registration
- [ ] Form đăng ký gia sư: xác minh tuổi (≥16), học vấn (≥Trung 4), bằng cấp
- [ ] Form đăng ký học sinh: nhu cầu học, khu vực, ngân sách
- [ ] Thêm điều khoản pháp lý cho gia sư

### Phase 4: Tutor Verification
- [ ] Thêm hệ thống xét duyệt hồ sơ gia sư
- [ ] Admin dashboard để duyệt/từ chối hồ sơ
- [ ] Gia sư chỉ thấy case sau khi được duyệt

### Phase 5: Payment & Contact Lock
- [ ] Khoá thông tin liên hệ gia sư đến khi thanh toán
- [ ] Hệ thống thanh toán: phí dịch vụ từ phụ huynh (tối đa 2 buổi)
- [ ] Tiết lộ số điện thoại/WhatsApp sau thanh toán

### Phase 6: Confirmation Letter
- [ ] Tạo thư xác nhận khi 2 bên thống nhất lịch/giá
- [ ] Ghi rõ: số buổi, giờ học, học phí, hình thức dạy

### Phase 7: Retention Features
- [ ] Tab quản lý case đang ghép
- [ ] Tab khoá học live-stream
- [ ] Danh sách "gia sư nổi bật" xếp theo đánh giá
