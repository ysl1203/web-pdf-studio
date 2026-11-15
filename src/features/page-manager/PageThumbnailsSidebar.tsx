import React, { useEffect, useRef, useState } from 'react';
import {
  RotateCw,
  Trash2,
  Copy,
  Plus,
  ChevronLeft,
  FilePlus2,
  GripVertical,
} from 'lucide-react';
import { loadPdfDocument } from '../../lib/pdf/loader';
import type { PageMetadata } from '../../types/pdf';

interface PageThumbnailsSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  pdfBytes: Uint8Array | null;
  pages: PageMetadata[];
  currentPage: number;
  onSelectPage: (pageNum: number) => void;
  onRotatePage: (pageNum: number) => void;
  onDeletePage: (pageNum: number) => void;
  onDuplicatePage: (pageNum: number) => void;
  onInsertBlankPage: (afterPageNum: number) => void;
  onMergePdfFile: (file: File) => void;
  onReorderPages: (fromIdx: number, toIdx: number) => void;
}

export const PageThumbnailsSidebar: React.FC<PageThumbnailsSidebarProps> = ({
  isOpen,
  onToggle,
  pdfBytes,
  pages,
  currentPage,
  onSelectPage,
  onRotatePage,
  onDeletePage,
  onDuplicatePage,
  onInsertBlankPage,
  onMergePdfFile,
  onReorderPages,
}) => {
  // Cache thumbnails by `${originalPageIndex}_${rotation}` for the current pdfBytes reference
  const cacheRef = useRef<{ bytes: Uint8Array | null; urls: Record<string, string> }>({
    bytes: null,
    urls: {},
  });
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const mergeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pdfBytes || pages.length === 0) {
      cacheRef.current = { bytes: pdfBytes, urls: {} };
      return;
    }

    if (cacheRef.current.bytes !== pdfBytes) {
      cacheRef.current = { bytes: pdfBytes, urls: {} };
    }

    let isCancelled = false;

    const renderMissingThumbnails = async () => {
      try {
        const { pdf: pdfDoc } = await loadPdfDocument(pdfBytes);
        const urls = { ...cacheRef.current.urls };
        let changed = false;

        for (const pageMeta of pages) {
          if (isCancelled) break;
          if (pageMeta.isBlank || pageMeta.originalPageIndex < 0) continue;

          const key = `${pageMeta.originalPageIndex}_${pageMeta.rotation}`;
          if (urls[key]) continue;

          try {
            const page = await pdfDoc.getPage(pageMeta.originalPageIndex + 1);
            const intrinsicRotation = pageMeta.originalRotation || page.rotate || 0;
            const effectiveRotation = ((intrinsicRotation + (pageMeta.extraRotation || 0)) % 360 + 360) % 360;
            const viewport = page.getViewport({ scale: 0.28, rotation: effectiveRotation });

            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.floor(viewport.width));
            canvas.height = Math.max(1, Math.floor(viewport.height));
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              await page.render({ canvasContext: ctx, viewport, canvas }).promise;
              urls[key] = canvas.toDataURL('image/jpeg', 0.85);
              changed = true;
            }
          } catch (e) {
            console.warn('Thumbnail render error:', e);
          }
        }

        if (!isCancelled && changed) {
          cacheRef.current.urls = urls;
          setThumbnailUrls(urls);
        } else if (!isCancelled) {
          setThumbnailUrls(urls);
        }
      } catch (err) {
        console.error('Failed to render thumbnails:', err);
      }
    };

    renderMissingThumbnails();

    return () => {
      isCancelled = true;
    };
  }, [pdfBytes, pages]);

  if (!isOpen) return null;

  return (
    <aside className="w-[220px] shrink-0 bg-[var(--bg-chrome)] border-r border-[var(--border-hairline)] flex flex-col h-full select-none z-20">
      {/* Header */}
      <div className="h-9 px-3 border-b border-[var(--border-hairline)] flex items-center justify-between text-xs shrink-0">
        <span className="font-semibold tracking-tight text-[var(--text-primary)] tabular-nums">
          页面目录 ({pages.length})
        </span>
        <button
          onClick={onToggle}
          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition cursor-pointer"
          title="收起页面目录"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Thumbnails Scroll Area */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
        {pages.map((p, idx) => {
          const pageNum = idx + 1;
          const isSelected = currentPage === pageNum;
          const cacheKey = `${p.originalPageIndex}_${p.rotation}`;
          const thumbSrc = pdfBytes && pages.length > 0 ? thumbnailUrls[cacheKey] : undefined;
          const isDropTarget = dragOverIdx === idx && draggedIdx !== null && draggedIdx !== idx;

          return (
            <div
              key={p.id}
              draggable
              onDragStart={() => setDraggedIdx(idx)}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverIdx !== idx) setDragOverIdx(idx);
              }}
              onDragLeave={() => {
                if (dragOverIdx === idx) setDragOverIdx(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedIdx !== null && draggedIdx !== idx) {
                  onReorderPages(draggedIdx, idx);
                }
                setDraggedIdx(null);
                setDragOverIdx(null);
              }}
              onDragEnd={() => {
                setDraggedIdx(null);
                setDragOverIdx(null);
              }}
              onClick={() => onSelectPage(pageNum)}
              className={`group relative p-2 rounded-xl border transition cursor-pointer ${
                isDropTarget
                  ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/40 bg-[var(--accent-soft)]'
                  : isSelected
                  ? 'border-[var(--accent)] bg-[var(--bg-surface)] ring-1 ring-[var(--accent)]/25 shadow-xs'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-surface)]/80 hover:bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5 text-[11px]">
                <span className="flex items-center gap-1 font-medium text-[var(--text-primary)] tabular-nums">
                  <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] cursor-grab" />
                  第 {pageNum} 页
                </span>
                <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-md bg-[var(--bg-hover)] text-[var(--text-muted)]">
                  {p.isBlank ? '空白' : `${p.rotation}°`}
                </span>
              </div>

              <div className="w-full h-32 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-black/8 shadow-2xs">
                {p.isBlank ? (
                  <div className="text-[11px] text-zinc-400">空白 A4 页</div>
                ) : thumbSrc ? (
                  <img
                    src={thumbSrc}
                    alt={`第 ${pageNum} 页`}
                    className="max-w-full max-h-full object-contain pointer-events-none"
                  />
                ) : (
                  <div className="text-zinc-400 text-[11px] animate-pulse">渲染中...</div>
                )}
              </div>

              <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-[var(--border-hairline)] text-[11px] text-[var(--text-secondary)]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRotatePage(pageNum);
                  }}
                  className="px-1.5 py-0.5 hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md flex items-center gap-1 cursor-pointer"
                  title="顺时针旋转 90°"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>旋转</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicatePage(pageNum);
                  }}
                  className="px-1.5 py-0.5 hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md flex items-center gap-1 cursor-pointer"
                  title="复制此页"
                >
                  <Copy className="w-3 h-3" />
                  <span>复制</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePage(pageNum);
                  }}
                  disabled={pages.length <= 1}
                  className="px-1.5 py-0.5 hover:text-[var(--danger)] hover:bg-[var(--bg-hover)] rounded-md flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title={pages.length <= 1 ? '至少保留一页' : '删除此页'}
                >
                  <Trash2 className="w-3 h-3" />
                  <span>删除</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div className="p-2.5 border-t border-[var(--border-hairline)] grid grid-cols-2 gap-1.5 shrink-0">
        <button
          onClick={() => onInsertBlankPage(currentPage)}
          className="h-8 px-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-[11px] font-medium rounded-xl flex items-center justify-center gap-1 border border-[var(--border-hairline)] cursor-pointer transition"
          title="在当前页后插入空白页"
        >
          <Plus className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>空白页</span>
        </button>

        <input
          type="file"
          ref={mergeInputRef}
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onMergePdfFile(f);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => mergeInputRef.current?.click()}
          className="h-8 px-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-[11px] font-medium rounded-xl flex items-center justify-center gap-1 border border-[var(--border-hairline)] cursor-pointer transition"
          title="追加另一个 PDF 文件的所有页面"
        >
          <FilePlus2 className="w-3.5 h-3.5 text-[var(--success)]" />
          <span>合并 PDF</span>
        </button>
      </div>
    </aside>
  );
};
