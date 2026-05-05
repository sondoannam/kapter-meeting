import type { CaptureStatus } from "@/shared/types/messages";

export function StatusBar({ status }: { status: CaptureStatus["state"] }) {
  const isReady = status === "idle" || status === "stopped";
  const isRecording = status === "recording";
  const isError = status === "error";
  const isFinishing = status === "finishing";

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border bg-kapter-surface ${isReady ? 'border-kapter-success/30 bg-kapter-success/5' : isError ? 'border-kapter-warning/30 bg-kapter-warning/5' : isRecording ? 'border-kapter-danger/30 bg-kapter-danger/5' : isFinishing ? 'border-kapter-accent/30 bg-kapter-accent/5' : 'border-kapter-border'}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#252436]">
        {isReady && (
          <div className="relative flex h-3 w-3 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-[pulse-dot_2s_ease-in-out_infinite] rounded-full bg-kapter-success opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-kapter-success"></span>
          </div>
        )}
        {isRecording && (
          <div className="relative flex h-3 w-3 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-[pulse-dot_1.5s_ease-in-out_infinite] rounded-full bg-kapter-danger opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-kapter-danger"></span>
          </div>
        )}
        {isError && (
          <span className="inline-flex h-2 w-2 rounded-full bg-kapter-warning"></span>
        )}
        {isFinishing && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-kapter-accent/30 border-t-kapter-accent"></div>
        )}
      </div>
      <div className="flex flex-col">
        <span className={`text-sm font-semibold ${isReady ? 'text-kapter-text-primary' : isError ? 'text-kapter-warning' : isRecording ? 'text-kapter-danger' : 'text-kapter-text-primary'}`}>
          {isReady ? "Sẵn sàng ghi âm" : isRecording ? "Đang ghi âm..." : isFinishing ? "Đang hoàn tất..." : isError ? "Đã xảy ra lỗi" : "Chưa sẵn sàng"}
        </span>
        <span className="text-[11px] text-kapter-text-secondary">
          {isReady ? "Trạng thái hệ thống" : isRecording ? "Đang thu thập âm thanh" : isFinishing ? "Đang xử lý dữ liệu cuối" : "Kiểm tra lại kết nối"}
        </span>
      </div>
    </div>
  );
}
