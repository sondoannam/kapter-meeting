# MVP Scope: Kapter 2.0 (AI Meeting Assistant)

Tài liệu này xác định các tính năng "Must-have" để đạt được cột mốc G1, G2 và Q1 trong 2 tuần đầu tiên. Mọi tính năng nằm ngoài danh sách này sẽ bị đẩy xuống Phase 2.

## 1. Nền tảng & Tích hợp (Platforms)

* **Input:** Chỉ hỗ trợ Google Meet qua trình duyệt Chrome.
* **Output:** Chỉ hỗ trợ đồng bộ dữ liệu sang Notion (Database chuẩn).
* **Authentication:** Đăng nhập qua Google (Firebase Auth/NextAuth/Clerk) và OAuth2 cho Notion.

## 2. Tính năng Cốt lõi (Core Features)

### 2.1 Thu thập Dữ liệu (Ingestion)

* **Manual Start/Stop:** Người dùng chủ động bấm nút trên Extension để bắt đầu/kết thúc ghi âm.
* **Mixed Audio Capture:** Thu luồng âm thanh hỗn hợp (System sound + Microphone) từ tab Google Meet.
* **Streaming:** Gửi dữ liệu âm thanh dưới dạng chunks qua WebSocket về server để đảm bảo tính ổn định.

### 2.2 Xử lý AI (AI Processing)

* **Speech-to-Text:** Chuyển đổi âm thanh thành văn bản có timestamp.
* **Speaker Diarization:** Phân biệt ít nhất 2-3 người nói trong một môi trường âm thanh ít nhiễu.
* **Action Item Extraction:** Trích xuất Summary (dưới 200 chữ) và danh sách Task (Task name, Assignee, Deadline gợi ý).

### 2.3 Giao diện Người dùng (UI/UX)

* **Meeting Widget:** Hiển thị nổi trên Google Meet để điều khiển.
* **Post-meeting Dashboard:** Màn hình Review cho phép:
  * Sửa nội dung Task.
  * Mapping Assignee (AI gợi ý -> Chọn member thực tế trong Notion).
  * Bấm "Sync" để đẩy data.

## 3. Các giới hạn (Out of Scope - Phase 2)

* Hỗ trợ Zoom/Microsoft Teams.
* Phân tích cảm xúc (Sentiment Analysis).
* Dịch thuật thời gian thực (Real-time Translation).
* Xử lý Audio bị chồng chéo quá nặng (Overlapped speech handling).
