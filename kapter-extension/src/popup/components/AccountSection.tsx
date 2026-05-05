import { useState } from "react";

interface Props {
  isAuthenticated: boolean;
  isBusy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function AccountSection({ isAuthenticated, isBusy, onConnect, onDisconnect }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[9px] font-semibold tracking-wider text-kapter-text-tertiary uppercase">
        Tài khoản
      </span>
      
      {showConfirm ? (
        <div className="flex flex-col gap-2 rounded-lg border border-kapter-border bg-kapter-surface p-3">
          <p className="text-xs text-kapter-text-primary">Bạn có chắc muốn xóa phiên đăng nhập?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 rounded-md border border-kapter-border bg-transparent py-1.5 text-xs font-semibold text-kapter-text-secondary hover:text-kapter-text-primary hover:bg-white/5 transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={() => {
                setShowConfirm(false);
                onDisconnect();
              }}
              className="flex-1 rounded-md border border-red-500/30 bg-red-500/10 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors"
            >
              Xác nhận
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={onConnect}
            disabled={isBusy}
            className="flex-1 rounded-md border border-kapter-accent/30 bg-kapter-accent/10 py-2 text-xs font-semibold text-kapter-accent transition-colors hover:bg-kapter-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAuthenticated ? "Làm mới phiên" : "Kết nối tài khoản"}
          </button>
          {isAuthenticated && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={isBusy}
              className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Xóa
            </button>
          )}
        </div>
      )}
    </div>
  );
}
