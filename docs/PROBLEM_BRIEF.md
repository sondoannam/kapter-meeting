# Problem Brief: AI Meeting Assistant (Kapter 2.0)

## 1. Context (Bối cảnh)

Trong môi trường làm việc hiện đại, đặc biệt là tại các tổ đội kỹ thuật (tech teams), hoặc các nhóm indie developers, các team khởi nghiệp nhỏ, các buổi họp diễn ra liên tục để giải quyết vấn đề và đưa ra quyết định. Tuy nhiên, sau mỗi buổi họp, một lượng lớn thông tin quan trọng thường bị thất thoát.

## 2. Problem Statement (Vấn đề cốt lõi)

Hiện tại, các đội nhóm đang đối mặt với một vấn đề lớn sau mỗi cuộc họp:

* **Meeting Amnesia (Quên việc):** Các hành động cụ thể (Action Items) được thống nhất trong lúc họp nhưng không được ghi chép lại đầy đủ, dẫn đến việc trễ tiến độ.
* **High Cognitive Load (Quá tải nhận thức):** Người tham gia vừa phải tập trung thảo luận, vừa phải ghi chép thủ công, làm giảm chất lượng sự tương tác.
* **Context Loss (Mất ngữ cảnh):** Các biên bản họp truyền thống thường chỉ ghi kết quả, mất đi luồng tranh luận và lý do dẫn đến quyết định đó.
* **Inefficient Follow-up:** Việc chuyển từ ghi chú cuộc họp sang các công cụ quản lý tác vụ (như Notion, Jira) tiêu tốn nhiều thời gian và dễ sai sót khi phân bổ người phụ trách (Assignee).

## 3. Target Audience (Đối tượng mục tiêu)

* **Small Tech Teams:** Các nhóm phát triển phần mềm quy mô nhỏ (3-10 người) cần sự tinh gọn và tốc độ.

## 4. Proposed Solution (Giải pháp đề xuất)

Phát triển một hệ thống hỗ trợ cuộc họp thông minh dưới dạng **Chrome Extension** tập trung vào Google Meet:

* **Capture:** Thu thập luồng âm thanh thời gian thực mà không cần Bot tham gia, đảm bảo tính riêng tư.
* **Understand:** Sử dụng AI Pipeline (STT & Speaker Diarization) để biết chính xác "Ai đã nói gì".
* **Extract:** Dùng LLM (Large Language Models) để tóm tắt nội dung và bóc tách các Action Items kèm người phụ trách dự kiến.
* **Integrate:** Đồng bộ hóa "một chạm" (One-click Sync) các nhiệm vụ này vào hệ thống Notion của team.

## 5. Unique Value Proposition (Giá trị độc đáo)

Khác với các công cụ ghi chú thông thường, dự án tập trung giải quyết bài toán **Speaker Diarization (Định danh người nói)** từ luồng âm thanh hỗn hợp trên trình duyệt và áp dụng cơ chế **Human-in-the-loop** (cho phép người dùng kiểm duyệt trước khi đồng bộ) để đảm bảo độ chính xác tuyệt đối cho việc giao vận tác vụ.

## 6. Success Metrics (Chỉ số thành công)

* **Accuracy:** Tỷ lệ AI nhận diện đúng Assignee và nội dung Task đạt trên 80%.
* **Efficiency:** Giảm 70% thời gian từ lúc kết thúc họp đến khi task được tạo trên Notion so với cách làm thủ công.
* **Adoption:** 100% thành viên trong tổ đội sử dụng công cụ làm phương thức quản lý họp mặc định.
