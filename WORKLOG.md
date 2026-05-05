### [ADR-1] Chuyển đổi sang Kiến trúc Đa nền tảng (Extension & Web Dashboard) — 11/04/2026

**Bối cảnh:** Việc tích hợp toàn bộ giao diện Review/Approve Task vào Chrome Extension gây ra giới hạn về không gian hiển thị (UX), khó quản lý lịch sử cuộc họp và tăng độ phức tạp khi tiêm (inject) CSS vào Google Meet.

**Các lựa chọn đã xem xét:**

- **Option A (Tất cả trong Extension):** Tiện lợi nhưng chật chội, dễ xung đột giao diện với Google Meet.
- **Option B (Extension + Web Dashboard):** Extension chỉ làm nhiệm vụ Capture (vô hình/mỏng nhẹ), Web App (Next.js) làm nhiệm vụ quản lý và review tập trung.

**Quyết định:** Chọn **Option B**.

- **Lý do:** Tận dụng thế mạnh Next.js của Đội trưởng để làm Dashboard chuyên nghiệp. Extension sẽ đóng vai trò "Pháp khí thu thập", sau khi kết thúc sẽ tự động dẫn người dùng về Web Dashboard (Hand-off) để xử lý tiếp.

**Hệ quả:** Cần xử lý vấn đề đồng bộ Session/Auth giữa Extension và Web App qua `chrome.storage.local`.

---

### [ADR-2] Cấu trúc Lean Monorepo thay vì Nx — 12/04/2026

**Bối cảnh:** Dự án sử dụng đa ngôn ngữ (TypeScript và Python). Cần một cấu trúc Monorepo để quản lý chung nhưng không được quá phức tạp để đảm bảo tiến độ 2 tuần đầu.

**Các lựa chọn đã xem xét:**

- **Nx Monorepo:** Mạnh mẽ, hỗ trợ đa ngôn ngữ tốt nhưng cấu hình phức tạp, cần thời gian học tập cao.
- **Lean Monorepo (NPM Workspaces):** Đơn giản, dễ setup, các thành viên có thể bắt tay vào code ngay lập tức.

**Quyết định:** Chọn **Lean Monorepo**.

- **Lý do:** Ưu tiên "Hoàn thành trước - Tối ưu sau". Dùng PNPM Workspaces quản lý Web/Backend/Extension và giữ folder AI-Worker độc lập để các thành viên tập trung xử lý các phần việc ban đầu một cách độc lập mà không bị phân tâm đi cấu hình tool.

---

### Brainstorm: Chiến thuật xử lý Diarization cho MVP — 15/04/2026

**Câu hỏi:** Làm sao để định danh người nói chính xác nhất khi chỉ có 1 luồng âm thanh hỗn hợp (Mixed Audio)?

**Các ý tưởng:**

- **Ý tưởng 1:** Dùng hoàn toàn AI (Pyannote) để phân tách giọng nói từ Audio. (Ưu: Chuyên nghiệp. Nhược: Chậm, cần GPU mạnh).
- **Ý tưởng 2:** Kết hợp AI với "DOM Hints" (bắt tín hiệu mic sáng từ UI Google Meet). (Ưu: Chính xác Assignee. Nhược: Dễ hỏng nếu Google đổi UI).

**Kết luận:** Ưu tiên **Ý tưởng 1** (Core AI xử lý) để đảm bảo tính thực chiến của dự án AI. Ý tưởng 2 sẽ được xem xét như một phương pháp bổ trợ (Metadata Enrichment) nếu AI gặp khó khăn.

---

### Sprint 1, 2, 3: Khởi tạo & Thông luồng End-to-End — 02/04 → 19/04/2026

| Task                                                                                                                                                           | Người làm        | Deadline | Trạng thái               |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- | :------- | :----------------------- |
| **Setup Monorepo & NestJS API:** Cấu trúc folder, Winston Logger, Swagger, Database Schema (PostgreSQL), Notion Auth luồng thô.                                | **Đoàn Nam Sơn** | 18/04    | Done                     |
| **Audio Capture Extension:** Setup Vite/React, sử dụng `tabCapture API` để lấy stream âm thanh từ Meet, gửi chunk qua WebSocket.                               | **Xuân Bằng**    | 18/04    | Done                     |
| **Core AI Python Simulator:** Setup folder `kapter-ai-worker`, xây dựng `local_runner.py` để băm file audio local và chạy thử pipeline ASR/Diarization (Mock). | **Việt Anh**     | 18/04    | Done                     |
| **Web Dashboard Scaffolding:** Khởi tạo Next.js App, UI cơ bản cho màn hình Meeting Detail và Preview Task.                                                    | **Đoàn Nam Sơn** | 18/04    | Done                     |
| **Integration G2:** Kết nối Extension -> Backend -> AI Worker (Mock). Chốt API Contracts cuối cùng.                                                            | **Cả nhóm**      | 18/04    | 🔄 Đang làm - (blocking) |

---

### Sprint 4: Version 1 Release (Extraction, Review & Sync) — 20/04 → 26/04/2026

| Task                                                                                                                           | Người làm        | Deadline | Trạng thái  |
| :----------------------------------------------------------------------------------------------------------------------------- | :--------------- | :------- | :---------- |
| **LLM Prompt Engineering:** Viết System Prompt & tích hợp OpenAI/Gemini SDK để trích xuất JSON (Summary, Tasks) từ Transcript. | **Xuân Bằng**    | 22/04    | 🔄 Đang làm |
| **Human-in-the-loop UI:** Build màn hình Dashboard cho phép Review Transcript, map Speaker identity và sửa đổi Action Items.   | **Đoàn Nam Sơn** | 24/04    | 🔄 Đang làm |
| **Notion Integration V1:** Hoàn thiện API đẩy Tasks (đã duyệt) lên Notion Database đích.                                       | **Đoàn Nam Sơn** | 25/04    | ⏳ Chờ      |
| **AI Worker Tuning:** Tối ưu hóa đầu ra JSON của Diarization cho khớp chuẩn với NestJS DTO.                                    | **Việt Anh**     | 23/04    | ⏳ Chờ      |

---

### Sprint 5: Testing, Improvements & Subscription Tiers — 27/04 → 03/05/2026

| Task                                                                                                                        | Người làm        | Deadline | Trạng thái |
| :-------------------------------------------------------------------------------------------------------------------------- | :--------------- | :------- | :--------- |
| **Subscription Plan Schema & API:** Setup Stripe/LemonSqueezy webhook, thiết kế DB lưu limit quota (số phút/tháng).         | **Đoàn Nam Sơn** | 29/04    | ⏳ Chờ     |
| **Subscription UI & Guard:** Trang Pricing trên Webapp và logic block thu âm trên Extension nếu hết Quota.                  | **Xuân Bằng**    | 01/05    | ⏳ Chờ     |
| **E2E Pipeline Testing:** Bắt các lỗi Timeout, đứt kết nối mạng giữa chừng, và fix memory leak (nếu có) trên Python Worker. | **Việt Anh**     | 02/05    | ⏳ Chờ     |
| **Dogfooding:** Cả nhóm họp nội bộ, cùng test và note lại bugs.                                                             | **Cả nhóm**      | 03/05    | ⏳ Chờ     |

---

### Sprint 6: Final Polish & Bug Bash (Chuẩn bị Demo) — 04/05 → 10/05/2026

| Task                                                                                                    | Người làm        | Deadline | Trạng thái |
| :------------------------------------------------------------------------------------------------------ | :--------------- | :------- | :--------- |
| **Bug Bash:** Resolve toàn bộ Critical & High priority issues tìm thấy ở Sprint 5.                      | **Cả nhóm**      | 07/05    | ⏳ Chờ     |
| **UI/UX Polish:** Thêm Loading skeletons, Toast notifications, mượt mà hóa animations.                  | **Xuân Bằng**    | 08/05    | ⏳ Chờ     |
| **Infra/Deployment Verify:** Đảm bảo hệ thống Docker/Cloud chạy ổn định, không bị sập khi demo thực tế. | **Đoàn Nam Sơn** | 08/05    | ⏳ Chờ     |
| **Demo Recording & Rehearsal:** Quay video luồng chạy E2E hoàn chỉnh, chuẩn bị kịch bản thuyết trình.   | **Cả nhóm**      | 10/05    | ⏳ Chờ     |
