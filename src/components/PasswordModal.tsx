import React, { useState } from 'react';
import { Lock, X } from 'lucide-react';

interface PasswordModalProps {
  isOpen: boolean;
  fileName: string;
  errorMsg?: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  fileName,
  errorMsg,
  onSubmit,
  onCancel,
}) => {
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    onSubmit(password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
      <form
        onSubmit={handleSubmit}
        className="w-[400px] bg-[var(--bg-chrome)] border border-[var(--border-strong)] rounded-xl shadow-2xl p-5 text-[var(--text-primary)]"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Lock className="w-4 h-4 text-[var(--warning)]" />
            <span>解锁受密码保护的 PDF</span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="my-4 space-y-3 text-xs">
          <p className="text-[var(--text-secondary)] leading-relaxed">
            文档 <span className="font-mono text-[var(--text-primary)]">{fileName}</span> 已加密。请输入打开密码以解锁并加载页面：
          </p>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="输入文档密码..."
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          {errorMsg && (
            <p className="text-[var(--danger)] text-xs">{errorMsg}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-hairline)]">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 text-xs rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            取消
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white cursor-pointer"
          >
            解锁文档
          </button>
        </div>
      </form>
    </div>
  );
};
