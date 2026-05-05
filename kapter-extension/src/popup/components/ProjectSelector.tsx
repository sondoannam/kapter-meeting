import type { ExtensionProjectSummary } from "@/shared/types/messages";
import type { ChangeEvent } from "react";

interface Props {
  projects: ExtensionProjectSummary[];
  selectedProjectId: string | null;
  onSelect: (e: ChangeEvent<HTMLSelectElement>) => void;
  disabled: boolean;
  isAuthenticated: boolean;
}

export function ProjectSelector({ projects, selectedProjectId, onSelect, disabled, isAuthenticated }: Props) {
  const activeProject = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId)
    : null;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] font-semibold tracking-wider text-kapter-text-tertiary uppercase">
        Dự án lưu trữ
      </span>
      <div className="relative w-full">
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <svg className="h-4 w-4 text-kapter-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <select
          value={selectedProjectId ?? ""}
          onChange={onSelect}
          disabled={disabled || !isAuthenticated}
          className="w-full appearance-none rounded-lg border border-kapter-border bg-kapter-surface py-2.5 pl-9 pr-8 text-sm text-kapter-text-primary outline-none transition-colors hover:border-kapter-border-hover focus:border-kapter-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Tự động (Nháp)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <svg className="h-4 w-4 text-kapter-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      <span className="pl-1 text-[11px] text-kapter-text-secondary">
        {isAuthenticated
          ? activeProject
            ? "Đã chọn dự án"
            : "Chưa chọn dự án"
          : "Đăng nhập để đồng bộ dự án"}
      </span>
    </div>
  );
}
