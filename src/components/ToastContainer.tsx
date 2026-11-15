import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import type { ToastMessage } from '../types/pdf';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  const iconMap = {
    success: <CheckCircle2 className="w-4 h-4 text-[var(--success)] shrink-0 mt-0.5" />,
    error: <AlertCircle className="w-4 h-4 text-[var(--danger)] shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="w-4 h-4 text-[var(--warning)] shrink-0 mt-0.5" />,
    info: <Info className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />,
  };

  return (
    <div
      className="fixed bottom-10 right-4 z-[60] flex flex-col gap-2 max-w-sm pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg bg-[var(--bg-chrome)] border border-[var(--border-strong)] shadow-xl text-[var(--text-primary)] text-xs"
        >
          {iconMap[t.type]}
          <div className="flex-1 min-w-0">
            <div className="font-medium leading-snug">{t.title}</div>
            {t.description && (
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 break-words">
                {t.description}
              </div>
            )}
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded cursor-pointer"
            aria-label="关闭通知"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
