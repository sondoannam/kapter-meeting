# KỊCH BẢN KIỂM THỬ (TEST CASES) - KAPTER AI
**Dự án:** Kapter - AI Meeting Assistant
**Mục tiêu:** Xác nhận các luồng tính năng cốt lõi (MVP) hoạt động ổn định từ Client (Extension/Web) đến Backend, AI Worker và tích hợp (Notion).

---

## 1. Xác thực & Phân quyền (Authentication)
| ID | Tên Test Case | Các bước thực hiện | Kết quả mong đợi | Trạng thái |
|---|---|---|---|---|
| TC-AUTH-01 | Đăng nhập Web Dashboard | 1. Truy cập Web Dashboard.<br>2. Chọn đăng nhập bằng Google (Clerk). | Đăng nhập thành công, chuyển hướng vào màn hình Dashboard. | [ ] |
| TC-AUTH-02 | Đăng nhập Extension | 1. Mở Extension Kapter.<br>2. Nhấn nút Đăng nhập. | Popup Clerk hiện ra, đăng nhập thành công và Extension hiển thị trạng thái sẵn sàng. | [ ] |

## 2. Ghi âm & Capture (Chrome Extension)
| ID | Tên Test Case | Các bước thực hiện | Kết quả mong đợi | Trạng thái |
|---|---|---|---|---|
| TC-EXT-01 | Ghi âm Google Meet | 1. Tham gia một phòng Google Meet.<br>2. Mở Extension Kapter.<br>3. Bật "Start Recording".<br>4. Cấp quyền thu âm (Mic & Tab audio). | Extension chuyển sang trạng thái "Recording" (có UI báo hiệu). Bắt đầu bắt luồng âm thanh. | [ ] |
| TC-EXT-02 | Dừng ghi âm | 1. Đang ở trạng thái ghi âm.<br>2. Bấm "Stop Recording" hoặc rời khỏi Meet. | Extension thông báo kết thúc, hiển thị trạng thái đang xử lý (Finishing) rồi trở lại trạng thái ban đầu. | [ ] |

## 3. Xử lý AI Worker & Backend (Speech-to-Text & Diarization)
| ID | Tên Test Case | Các bước thực hiện | Kết quả mong đợi | Trạng thái |
|---|---|---|---|---|
| TC-AI-01 | WebSocket Streaming | 1. Bắt đầu ghi âm qua Extension.<br>2. Nói thử 1 đoạn dài 30 giây. | Extension gửi chunks âm thanh qua WebSocket. Backend không báo lỗi timeout. | [ ] |
| TC-AI-02 | Bóc băng (STT) & Diarization | 1. Cho 2 người nói luân phiên trong Meet.<br>2. Kết thúc cuộc họp.<br>3. Kiểm tra logs AI Worker. | AI nhận diện được 2 giọng (Speaker A, Speaker B) bằng mô hình Speaker Embedding. Sinh ra transcript tách biệt người nói. | [ ] |

## 4. Web Dashboard & LLM Extraction (Human-in-the-loop)
| ID | Tên Test Case | Các bước thực hiện | Kết quả mong đợi | Trạng thái |
|---|---|---|---|---|
| TC-WEB-01 | Xem danh sách cuộc họp | 1. Vào Web Dashboard.<br>2. Mở tab "Meeting History". | Hiển thị cuộc họp vừa ghi âm với trạng thái "Completed" hoặc "Processing". | [ ] |
| TC-WEB-02 | Xem chi tiết & Transcript | 1. Click vào cuộc họp mới nhất.<br>2. Kiểm tra phần Transcript. | Đoạn text hiển thị rõ từng người nói (Speaker A, Speaker B) theo đúng thời gian (Timestamps). Không bị lặp từ. | [ ] |
| TC-WEB-03 | Trích xuất Summary & Action Items | 1. Kiểm tra phần Summary / Action Items. | Hiển thị tóm tắt cuộc họp và danh sách các công việc dưới dạng to-do list được sinh ra từ LLM. | [ ] |
| TC-WEB-04 | Chỉnh sửa Action Items (Human-in-the-loop) | 1. Click "Edit" ở một Action Item.<br>2. Thay đổi nội dung và Lưu.<br>3. Thử tạo mới 1 Action Item bằng tay. | Giao diện cập nhật lập tức nội dung mới. Dữ liệu lưu thành công xuống Database. | [ ] |

## 5. Tích hợp Notion (Workflow Automation)
| ID | Tên Test Case | Các bước thực hiện | Kết quả mong đợi | Trạng thái |
|---|---|---|---|---|
| TC-INT-01 | Kết nối tài khoản Notion | 1. Vào phần Settings > Integrations.<br>2. Click "Connect Notion".<br>3. Cấp quyền qua OAuth. | Kết nối thành công, Web hiển thị tài khoản Notion đang được liên kết. | [ ] |
| TC-INT-02 | Chọn Database đích | 1. Tại trang chi tiết Meeting, nhấn cấu hình Notion.<br>2. Chọn một Project/Database từ dropdown. | Danh sách Database xổ xuống đúng với workspace của người dùng đã cấp quyền. | [ ] |
| TC-INT-03 | Đồng bộ Action Items | 1. Ở giao diện Action Items, duyệt (Approve) một vài task.<br>2. Click nút "Sync to Notion". | Hiển thị thông báo Sync thành công. Hệ thống gọi Notion API. | [ ] |
| TC-INT-04 | Kiểm tra trên Notion | 1. Mở Notion Workspace.<br>2. Mở Database/Project vừa cấu hình. | Các task đã Sync xuất hiện ở dạng page/card mới, có đầy đủ nội dung. | [ ] |
