import React, { useEffect, useRef } from 'react';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';

interface SearchBarProps {
  isOpen: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  matchCount: number;
  activeMatchIndex: number;
  onPrevMatch: () => void;
  onNextMatch: () => void;
  onClose: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  isOpen,
  query,
  onQueryChange,
  matchCount,
  activeMatchIndex,
  onPrevMatch,
  onNextMatch,
  onClose,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed top-[92px] right-6 z-40 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-chrome)] border border-[var(--border-strong)] shadow-2xl text-xs">
      <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) onPrevMatch();
            else onNextMatch();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
        placeholder="搜索文档内容..."
        className="w-44 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none text-xs"
      />
      <span className="font-mono tabular-nums text-[11px] text-[var(--text-muted)] px-1.5 min-w-[46px] text-center">
        {query.trim() ? (matchCount > 0 ? `${activeMatchIndex + 1}/${matchCount}` : '0/0') : ''}
      </span>
      <button
        onClick={onPrevMatch}
        disabled={matchCount === 0}
        className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
        title="上一个匹配 (Shift+Enter)"
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onNextMatch}
        disabled={matchCount === 0}
        className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
        title="下一个匹配 (Enter)"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onClose}
        className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
        title="关闭搜索 (Esc)"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
