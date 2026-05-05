/**
 * Kapter — Mock WebSocket Test Server
 *
 * Dùng để test nhận audio chunk từ extension mà không cần backend thật.
 *
 * Cách chạy:
 *   node ws-test-server.js
 *
 * Sau đó load extension và nhấn "Bắt đầu ghi" — server sẽ log từng chunk nhận được.
 *
 * Yêu cầu: Node.js 18+ (có ws module nếu không có thì: npm install ws)
 */

// Thử dùng ws package nếu có, fallback sang built-in nếu không
let WebSocketServer;
try {
  const wsModule = await import("ws");
  WebSocketServer = wsModule.WebSocketServer;
  console.log("📦 Dùng ws package");
} catch {
  console.error("❌ Thiếu package 'ws'. Chạy: npm install ws");
  process.exit(1);
}

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = 3001;
const AUDIO_PATH = "/audio";

const wss = new WebSocketServer({ port: PORT, path: AUDIO_PATH });

console.log(`\n🎙️  Kapter Mock WebSocket Server`);
console.log(`📡 Đang lắng nghe tại: ws://localhost:${PORT}${AUDIO_PATH}`);
console.log(`   Nhấn Ctrl+C để dừng\n`);

let totalBytesReceived = 0;
let totalChunks = 0;

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const sessionId = url.searchParams.get("sessionId") ?? "unknown";

  console.log(`\n✅ Extension đã kết nối!`);
  console.log(`   Session ID: ${sessionId}`);
  console.log(`   Time: ${new Date().toLocaleTimeString()}`);
  console.log(`${"─".repeat(50)}`);

  // Reset counters cho session này
  let sessionChunks = 0;
  let sessionBytes = 0;
  const sessionStart = Date.now();

  // Chuẩn bị file để lưu
  const recordingsDir = path.join(__dirname, "recordings");
  if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
  }
  
  const fileName = `recording-${sessionId.replace(/[^a-z0-9]/gi, '_')}.webm`;
  const filePath = path.join(recordingsDir, fileName);
  const fileStream = fs.createWriteStream(filePath);
  console.log(`📁 Tự động lưu audio vào: ./recordings/${fileName}`);

  ws.on("message", (data, isBinary) => {
    if (isBinary) {
      fileStream.write(data);
      const byteLength = Buffer.isBuffer(data) ? data.length : data.byteLength;
      sessionChunks++;
      sessionBytes += byteLength;
      totalChunks++;
      totalBytesReceived += byteLength;

      console.log(
        `📦 Chunk #${String(sessionChunks).padStart(3, "0")} | ` +
        `${formatBytes(byteLength).padStart(10)} | ` +
        `Session tổng: ${formatBytes(sessionBytes)} | ` +
        `⏱ ${formatTime(Date.now() - sessionStart)}`
      );
    } else {
      // Text message (metadata có thể đến ở đây)
      try {
        const text = data.toString();
        console.log(`📝 Text message:`, JSON.parse(text));
      } catch {
        console.log(`📝 Text message: ${data.toString().slice(0, 100)}`);
      }
    }
  });

  ws.on("close", (code, reason) => {
    const duration = Date.now() - sessionStart;
    fileStream.end();
    console.log(`\n🔴 Kết nối đóng`);
    console.log(`   Code: ${code} | Reason: ${reason.toString() || "(none)"}`);
    console.log(`   Tổng session: ${sessionChunks} chunks | ${formatBytes(sessionBytes)}`);
    console.log(`   Thời gian ghi: ${formatTime(duration)}`);
    console.log(`${"─".repeat(50)}\n`);
  });

  ws.on("error", (err) => {
    console.error(`❌ WebSocket lỗi:`, err.message);
  });

  // Gửi ACK về extension
  ws.send(JSON.stringify({ type: "SESSION_STARTED", sessionId }));
});

wss.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌ Port ${PORT} đang bận. Dừng process khác hoặc đổi PORT.`);
  } else {
    console.error("Server error:", err);
  }
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log(`\n\n📊 Tổng kết:`);
  console.log(`   Tổng chunks nhận: ${totalChunks}`);
  console.log(`   Tổng bytes nhận:  ${formatBytes(totalBytesReceived)}`);
  wss.close(() => {
    console.log("✅ Server đã dừng.");
    process.exit(0);
  });
});

// ── Utils ──────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
