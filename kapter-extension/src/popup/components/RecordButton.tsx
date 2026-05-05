interface Props {
  isRecording: boolean;
  isOnMeetTab: boolean;
  isBusy: boolean;
  isFinishing: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function RecordButton({ isRecording, isFinishing, isOnMeetTab, isBusy, onStart, onStop }: Props) {
  const disabled = (!isOnMeetTab && !isRecording) || isBusy || isFinishing;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <button
        onClick={isRecording ? onStop : onStart}
        disabled={disabled}
        className={`group relative flex w-full items-center justify-center gap-2 rounded-[10px] py-3 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:scale-100 disabled:opacity-50 disabled:cursor-not-allowed ${
          isRecording
            ? "bg-gradient-to-r from-red-500 to-red-600 shadow-[0_4px_14px_rgba(239,68,68,0.3)] hover:shadow-[0_4px_18px_rgba(239,68,68,0.4)]"
            : "bg-gradient-to-r from-kapter-accent to-[#9b67f5] shadow-[0_4px_14px_rgba(124,111,245,0.3)] hover:shadow-[0_4px_18px_rgba(124,111,245,0.4)]"
        }`}
      >
        {isBusy || isFinishing ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
        ) : isRecording ? (
          <>
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            Dừng ghi
          </>
        ) : (
          <>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Bắt đầu ghi
          </>
        )}
      </button>
      {!isOnMeetTab && !isRecording && (
        <span className="text-center text-[11px] text-kapter-text-secondary">
          Mở Google Meet trước khi ghi
        </span>
      )}
    </div>
  );
}
