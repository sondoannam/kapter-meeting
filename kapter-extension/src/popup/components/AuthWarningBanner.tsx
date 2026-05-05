export function AuthWarningBanner({ onConnect, isBusy }: { onConnect: () => void; isBusy: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
      <div className="flex items-center gap-2">
        <span className="text-amber-500">⚠️</span>
        <span className="text-sm font-semibold text-amber-500">Chưa xác thực</span>
      </div>
      <p className="text-xs text-amber-500/80">
        Bạn cần đăng nhập để đồng bộ dự án và lưu trữ bản ghi.
      </p>
      <button
        onClick={onConnect}
        disabled={isBusy}
        className="mt-1 w-fit text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50"
      >
        → Kết nối ngay
      </button>
    </div>
  );
}
