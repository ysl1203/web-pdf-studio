import React, { useRef } from 'react';
import {
  FileUp,
  Download,
  FolderOpen,
  FileText,
  RotateCw,
  Search,
  FilePlus2,
  BookOpen,
  FileType2,
  PanelLeft,
  Sun,
  Moon,
} from 'lucide-react';
import { BrandMark } from './BrandMark';

interface RibbonHeaderProps {
  fileName: string;
  pageCount: number;
  hasUnsavedEdits: boolean;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenFile: (file: File) => void;
  onMergePdfFile: (file: File) => void;
  onOpenImagesToPdf: (files: FileList) => void;
  onOpenExportModal: () => void;
  onOpenConvertDocx: () => void;
  onToggleSearch: () => void;
  onRotateAllPages: () => void;
  onLoadSample: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const RibbonHeader: React.FC<RibbonHeaderProps> = ({
  fileName,
  pageCount,
  hasUnsavedEdits,
  isSidebarOpen,
  onToggleSidebar,
  onOpenFile,
  onMergePdfFile,
  onOpenImagesToPdf,
  onOpenExportModal,
  onOpenConvertDocx,
  onToggleSearch,
  onRotateAllPages,
  onLoadSample,
  theme,
  onToggleTheme,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mergeInputRef = useRef<HTMLInputElement>(null);
  const imgToPdfInputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="h-[52px] px-3.5 bg-[var(--bg-chrome)] border-b border-[var(--border-hairline)] flex items-center justify-between gap-3 select-none z-30 shrink-0">
      {/* Left: Brand, Drawer Toggle, Document Breadcrumb, Search */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-2 pr-1">
          <BrandMark className="w-7 h-7 shrink-0" />
          <span className="font-semibold text-[13.5px] tracking-tight text-[var(--text-primary)] whitespace-nowrap">
            Web PDF Studio
          </span>
        </div>

        <button
          onClick={onToggleSidebar}
          className={`h-8 w-8 rounded-lg flex items-center justify-center border transition cursor-pointer shrink-0 ${
            isSidebarOpen
              ? 'bg-[var(--bg-surface)] border-[var(--border-strong)] text-[var(--text-primary)]'
              : 'bg-transparent border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
          }`}
          title={isSidebarOpen ? '收起页面目录' : '展开页面目录'}
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        {/* Active File Pill */}
        <div className="flex items-center gap-2 h-8 text-xs text-[var(--text-primary)] bg-[var(--bg-surface)] px-3 rounded-xl border border-[var(--border-hairline)] max-w-[260px] min-w-0">
          <FileText className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
          <span className="truncate font-medium">{fileName || '未命名文档.pdf'}</span>
          {hasUnsavedEdits && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] shrink-0"
              title="文档有未导出的修改"
            />
          )}
          {pageCount > 0 && (
            <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-md bg-[var(--bg-hover)] text-[var(--text-secondary)] shrink-0">
              {pageCount}P
            </span>
          )}
        </div>

        <button
          onClick={onToggleSearch}
          className="h-8 px-2.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-xl flex items-center gap-1.5 transition cursor-pointer shrink-0"
          title="搜索文档内容 (Ctrl+F)"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">查找</span>
        </button>

        <button
          onClick={onLoadSample}
          className="h-8 px-2.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-xl flex items-center gap-1 transition cursor-pointer shrink-0"
          title="重新载入示例 PDF"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">示例文档</span>
        </button>
      </div>

      {/* Right: File Actions, Conversion, Theme Switch & Export CTA */}
      <div className="flex items-center gap-1.5 shrink-0">
        <input
          type="file"
          ref={fileInputRef}
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onOpenFile(file);
            e.target.value = '';
          }}
        />
        <input
          type="file"
          ref={mergeInputRef}
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onMergePdfFile(file);
            e.target.value = '';
          }}
        />
        <input
          type="file"
          ref={imgToPdfInputRef}
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onOpenImagesToPdf(e.target.files);
            }
            e.target.value = '';
          }}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="h-8 px-2.5 text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] rounded-xl flex items-center gap-1.5 transition cursor-pointer"
          title="打开本地 PDF 文档 (Ctrl+O)"
        >
          <FolderOpen className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>打开 PDF</span>
        </button>

        <button
          onClick={() => mergeInputRef.current?.click()}
          className="h-8 px-2.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] rounded-xl flex items-center gap-1.5 transition cursor-pointer"
          title="导入另一个 PDF 并追加合并到当前文档末尾"
        >
          <FilePlus2 className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">合并 PDF</span>
        </button>

        <button
          onClick={() => imgToPdfInputRef.current?.click()}
          className="h-8 px-2.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] rounded-xl flex items-center gap-1.5 transition cursor-pointer"
          title="选择多张图片转换为 PDF 文档"
        >
          <FileUp className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">图片转 PDF</span>
        </button>

        <button
          onClick={onRotateAllPages}
          className="h-8 px-2.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5 transition cursor-pointer"
          title="将文档所有页面顺时针旋转 90°"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">全页旋转</span>
        </button>

        <button
          onClick={onOpenConvertDocx}
          className="h-8 px-2.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5 transition cursor-pointer"
          title="将 PDF 转换为可编辑 Word 文档"
        >
          <FileType2 className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="hidden xl:inline">转 Word</span>
        </button>

        <span className="h-4 w-px bg-[var(--border-hairline)] mx-0.5" />

        <button
          onClick={onToggleTheme}
          className="h-8 px-2.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5 transition cursor-pointer"
          title={theme === 'dark' ? '切换为浅色纸艺主题' : '切换为深色暗房主题'}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xl:inline">浅色</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <span className="hidden xl:inline">深色</span>
            </>
          )}
        </button>

        <button
          onClick={onOpenExportModal}
          className="h-8 px-3.5 text-xs font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-sm"
          title="导出为 PDF、Word、高清图片或 Markdown (Ctrl+S)"
        >
          <Download className="w-3.5 h-3.5" />
          <span>导出文件</span>
        </button>
      </div>
    </header>
  );
};
