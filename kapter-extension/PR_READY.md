# Hướng Dẫn Mở Pull Request — Audio Capture Kapter

## 1. Đặt tên nhánh (Branch name)
Theo quy tắc chuẩn thì nhánh nên có prefix thể hiện loại chức năng, kèm mã task (nếu có dùng Jira/Trello), và tóm tắt ngắn.

**Gợi ý nhánh:**
```bash
git checkout -b feat/audio-capture
# Hoặc chi tiết hơn:
git checkout -b feat/extension-tab-capture-websocket
```

## 2. Commit nội dung
Lưu mã nguồn vừa làm vào máy:
```bash
git add .
git commit -m "feat(extension): implement audio capture using offscreen document and websocket"
```

## 3. Nội dung Pull Request (PR)
*Copy toàn bộ nội dung dưới đây dán vào description của Pull Request trên Github nhé:*

***

### Title PR:
`feat(extension): Triển khai Audio Capture thông qua Offscreen API và WebSockets`

### Nội dung PR:

## Summary
Triển khai thành công tính năng thu âm cho tiến trình mở rộng (Extension) trên nền Google Meet. 
Do Manifest V3 không hỗ trợ module MediaRecorder trực tiếp trong Background Service Worker, nhánh này sử dụng API `chrome.offscreen` tạo tài liệu ẩn để truy cập mic, bắt luồng âm thanh thông qua API `chrome.tabCapture` và truyền đi định kỳ 2 giây/lần bằng WebSockets.

## Changes
- **`public/manifest.json`**: Bổ sung quyền `tabCapture` (lấy luồng tab), `offscreen` (sinh background document xử lý âm thanh).
- **`shared/types/messages.ts`** & **`src/shared/lib/storage.ts`**: Bổ sung `START_CAPTURE`, `STOP_CAPTURE`, `GET_CAPTURE_STATUS` config và Storage model cho `captureStatus`.
- **`src/background/index.ts`**: Lắng nghe và điều hợp lệnh ghi âm, quản lý kết nối offscreen.
- **`src/offscreen/index.ts` & `.html`**: Chạy ngầm `MediaRecorder`, mã hóa luồng thành WebM/Opus sau đó gửi qua cổng Socket.
- **`src/popup/*`**: Cập nhật CSS hiển thị trạng thái `idle -> recording -> stopped` kèm timer và số byte.
- Thêm **`ws-test-server.js`**: File mock socket server để test nội bộ không phụ thuộc Backend.
