import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  MoveHorizontal,
  ShieldCheck,
  Sun,
  Moon,
} from 'lucide-react';

interface StatusBarProps {
  currentPage: number;
  totalPages: number;
  onJumpToPage: (page: number) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  backendOnline: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  annotationCount: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  currentPage,
  totalPages,
  onJumpToPage,
  zoom,
  onZoomChange,
  onFitWidth,
  onFitPage,
  backendOnline,
  theme,
  onToggleTheme,
  annotationCount,
}) => {
  const [editingPage, setEditingPage] = useState<string | null>(null);
  const displayPageInput = editingPage !== null ? editingPage : String(currentPage);

  const commitPageJump = () => {
    const raw = editingPage ?? String(currentPage);
    setEditingPage(null);
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num >= 1 && num <= totalPages) {
      onJumpToPage(num);
    }
  };

  return (
    <footer className="h-7 px-3 bg-[var(--bg-chrome)] border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px] text-[var(--text-secondary)] select-none z-30 shrink-0">
      {/* Left: Local runtime & document stats */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-1.5 text-[var(--success)] shrink-0">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>本地安全处理</span>
        </div>

        <span className="h-3 w-px bg-[var(--border-hairline)] hidden sm:inline" />

        <div className="hidden sm:flex items-center gap-1.5 text-[var(--text-muted)] truncate">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              backendOnline ? 'bg-[var(--success)]' : 'bg-[var(--text-muted)]'
            }`}
          />
          <span>{backendOnline ? 'Python 深度版式引擎已连接' : '纯浏览器离线引擎'}</span>
        </div>

        {annotationCount > 0 && (
          <>
            <span className="h-3 w-px bg-[var(--border-hairline)] hidden md:inline" />
            <span className="hidden md:inline text-[var(--text-muted)] tabular-nums">
              {annotationCount} 处批注
            </span>
          </>
        )}
      </div>

      {/* Right: Page jumper + Zoom + Theme */}
      <div className="flex items-center gap-2 shrink-0">
        {totalPages > 0 && (
          <div className="flex items-center gap-1 pr-2 border-r border-[var(--border-hairline)]">
            <button
              onClick={() => onJumpToPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="p-0.5 rounded hover:bg-[var(--bg-hover)] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              title="上一页"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <input
              type="text"
              inputMode="numeric"
              value={displayPageInput}
              onFocus={(e) => {
                setEditingPage(String(currentPage));
                e.currentTarget.select();
              }}
              onChange={(e) => setEditingPage(e.target.value)}
              onBlur={commitPageJump}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitPageJump();
                  (e.target as HTMLInputElement).blur();
                } else if (e.key === 'Escape') {
                  setEditingPage(null);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-8 text-center bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded px-1 py-0 text-[11px] font-mono tabular-nums text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              aria-label="当前页码"
            />
            <span className="font-mono tabular-nums text-[var(--text-muted)]">/ {totalPages}</span>
            <button
              onClick={() => onJumpToPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="p-0.5 rounded hover:bg-[var(--bg-hover)] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              title="下一页"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-1 pr-2 border-r border-[var(--border-hairline)]">
          <button
            onClick={onFitWidth}
            className="px-1.5 py-0.5 rounded hover:bg-[var(--bg-hover)] text-[11px] flex items-center gap-1 cursor-pointer"
            title="适应视口宽度"
          >
            <MoveHorizontal className="w-3 h-3" />
            <span className="hidden sm:inline">适宽</span>
          </button>
          <button
            onClick={onFitPage}
            className="px-1.5 py-0.5 rounded hover:bg-[var(--bg-hover)] text-[11px] flex items-center gap-1 cursor-pointer"
            title="适应单页高度"
          >
            <Maximize2 className="w-3 h-3" />
            <span className="hidden sm:inline">整页</span>
          </button>
          <button
            onClick={() => onZoomChange(Math.max(0.4, Number((zoom - 0.15).toFixed(2))))}
            className="p-0.5 rounded hover:bg-[var(--bg-hover)] cursor-pointer"
            title="缩小 (Ctrl+-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onZoomChange(1.0)}
            className="w-11 text-center font-mono tabular-nums text-[11px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded py-0.5 cursor-pointer"
            title="重置为 100% (Ctrl+0)"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => onZoomChange(Math.min(3.0, Number((zoom + 0.15).toFixed(2))))}
            className="p-0.5 rounded hover:bg-[var(--bg-hover)] cursor-pointer"
            title="放大 (Ctrl++)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={onToggleTheme}
          className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          title={theme === 'dark' ? '切换到浅色纸张主题' : '切换到深色工作室主题'}
          aria-label="切换主题"
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>
      </div>
    </footer>
  );
};
