import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Image as ImageIcon,
  FileCode,
  CheckCircle2,
  Loader2,
  Download,
  Layers,
  Copy,
} from 'lucide-react';
import { downloadFile, type DownloadOutcome } from '../utils/download';
import { exportSynthesizedPdf } from '../features/converter/pdfExporter';
import { convertPdfToDocx } from '../features/converter/pdfToDocx';
import { convertPdfToImages } from '../features/converter/pdfToImages';
import { extractPdfTextAndMarkdown } from '../features/converter/pdfToText';
import type { Annotation, PageMetadata, WatermarkSettings } from '../types/pdf';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBytes: Uint8Array | null;
  pages: PageMetadata[];
  currentPage: number;
  annotations: Annotation[];
  watermark: WatermarkSettings;
  originalFileName: string;
  defaultFormat?: 'pdf' | 'docx' | 'images' | 'md';
  assets?: Record<string, string>;
  backendOnline: boolean;
  onNotify: (type: 'success' | 'info' | 'warning' | 'error', title: string, desc?: string) => void;
}

/** Parse page range expression like "1-3, 5, 7-8" into sorted unique 1-based page numbers. */
function parsePageRange(expr: string, maxPages: number): number[] {
  const result = new Set<number>();
  const parts = expr.split(/[,，\s]+/).filter(Boolean);
  for (const part of parts) {
    if (part.includes('-')) {
      const [aStr, bStr] = part.split('-');
      const a = parseInt(aStr, 10);
      const b = parseInt(bStr, 10);
      if (!isNaN(a) && !isNaN(b)) {
        const start = Math.max(1, Math.min(a, b));
        const end = Math.min(maxPages, Math.max(a, b));
        for (let p = start; p <= end; p++) result.add(p);
      }
    } else {
      const p = parseInt(part, 10);
      if (!isNaN(p) && p >= 1 && p <= maxPages) result.add(p);
    }
  }
  return Array.from(result).sort((x, y) => x - y);
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  pdfBytes,
  pages,
  currentPage,
  annotations,
  watermark,
  originalFileName,
  defaultFormat = 'pdf',
  assets = {},
  backendOnline,
  onNotify,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'docx' | 'images' | 'md'>(
    defaultFormat
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [imageDpi, setImageDpi] = useState<number>(2.0);
  const [imageFormat, setImageFormat] = useState<'png' | 'jpeg'>('png');
  const [useBackendDocx, setUseBackendDocx] = useState<boolean>(backendOnline);
  const [liveBackendOnline, setLiveBackendOnline] = useState<boolean>(backendOnline);
  const [rangeMode, setRangeMode] = useState<'all' | 'current' | 'custom'>('all');
  const [customRangeExpr, setCustomRangeExpr] = useState<string>('');
  const [rangeError, setRangeError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          const online = data?.status === 'online';
          setLiveBackendOnline(online);
          setUseBackendDocx(online);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLiveBackendOnline(false);
          setUseBackendDocx(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen || !pdfBytes) return null;

  const baseName = originalFileName.replace(/\.[^/.]+$/, '') || 'document';

  const resolveSelectedPages = (): number[] | undefined => {
    if (rangeMode === 'all') return undefined;
    if (rangeMode === 'current') return [currentPage];
    const parsed = parsePageRange(customRangeExpr, pages.length);
    if (parsed.length === 0) {
      setRangeError(`请输入有效的页码范围（1 - ${pages.length}），例如 1-3, 5`);
      return [];
    }
    return parsed;
  };

  const handleCopyMarkdown = async () => {
    if (!pdfBytes) return;
    const targetPages = resolveSelectedPages();
    if (targetPages && targetPages.length === 0) return;

    setIsProcessing(true);
    setProgressText('正在提取文本并复制到剪贴板...');
    try {
      const { markdown } = await extractPdfTextAndMarkdown(
        pdfBytes,
        pages,
        annotations,
        targetPages
      );
      await navigator.clipboard.writeText(markdown);
      onNotify('success', '已复制 Markdown 到剪贴板');
    } catch (err) {
      onNotify('error', '复制失败', String(err));
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  const handleExport = async () => {
    setRangeError(null);
    const targetPages = resolveSelectedPages();
    if (targetPages && targetPages.length === 0) return;

    setIsProcessing(true);
    try {
      let outcome: DownloadOutcome = 'saved';

      if (selectedFormat === 'pdf') {
        setProgressText('正在合成矢量批注、签名与标准 PDF...');
        const outPdf = await exportSynthesizedPdf(
          pdfBytes,
          pages,
          annotations,
          watermark,
          assets,
          targetPages
        );
        const blob = new Blob([outPdf as unknown as BlobPart], { type: 'application/pdf' });
        outcome = await downloadFile(blob, `${baseName}_edited.pdf`);
      } else if (selectedFormat === 'docx') {
        let docxBlob: Blob | null = null;
        if (liveBackendOnline && useBackendDocx) {
          setProgressText('正在使用 Python pdf2docx 重构版式与表格...');
          try {
            const currentPdf = await exportSynthesizedPdf(
              pdfBytes,
              pages,
              annotations,
              watermark,
              assets,
              targetPages
            );
            const formData = new FormData();
            formData.append(
              'file',
              new Blob([currentPdf as unknown as BlobPart], { type: 'application/pdf' }),
              `${baseName}.pdf`
            );
            const resp = await fetch('/api/convert/pdf-to-docx', {
              method: 'POST',
              body: formData,
            });
            if (resp.ok) {
              docxBlob = await resp.blob();
            }
          } catch (backendErr) {
            console.warn('Backend DOCX fallback to client-side:', backendErr);
          }
        }

        if (!docxBlob) {
          setProgressText('正在本地解析文本结构并打包 Word (.docx)...');
          docxBlob = await convertPdfToDocx(pdfBytes, pages, annotations, targetPages);
        }
        outcome = await downloadFile(docxBlob, `${baseName}.docx`);
      } else if (selectedFormat === 'images') {
        setProgressText('正在渲染高清页面图像...');
        outcome = await convertPdfToImages(pdfBytes, pages, annotations, watermark, {
          format: imageFormat,
          scale: imageDpi,
          assets,
          exportPageNumbers: targetPages,
          baseName,
          onProgress: (cur, tot) => setProgressText(`正在渲染页面图像 (${cur}/${tot})...`),
        });
      } else if (selectedFormat === 'md') {
        setProgressText('正在提取结构化 Markdown 文档...');
        const { markdown } = await extractPdfTextAndMarkdown(
          pdfBytes,
          pages,
          annotations,
          targetPages
        );
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
        outcome = await downloadFile(blob, `${baseName}.md`);
      }

      if (outcome === 'saved') {
        onNotify('success', '导出完成', `已保存 ${selectedFormat.toUpperCase()} 文件`);
        onClose();
      } else {
        onNotify('info', '已取消保存');
      }
    } catch (err: unknown) {
      console.error('Export failed:', err);
      onNotify('error', '导出失败', (err as Error)?.message || String(err));
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  const formatCards = [
    {
      id: 'pdf' as const,
      icon: <Layers className="w-4 h-4 text-rose-400" />,
      title: '标准 PDF 文档',
      desc: '保留所有文字改写、图形、签名与水印',
    },
    {
      id: 'docx' as const,
      icon: <FileText className="w-4 h-4 text-[var(--accent)]" />,
      title: 'Word 文档 (.docx)',
      desc: '提取段落与表格，兼容 Word 与 WPS',
    },
    {
      id: 'images' as const,
      icon: <ImageIcon className="w-4 h-4 text-[var(--success)]" />,
      title: '高清图像 (PNG/JPG)',
      desc: '单页直出图片，多页自动打包 ZIP',
    },
    {
      id: 'md' as const,
      icon: <FileCode className="w-4 h-4 text-[var(--warning)]" />,
      title: 'Markdown 文本',
      desc: '提取纯文本与标题层级，适配笔记软件',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs"
      onClick={() => !isProcessing && onClose()}
    >
      <div
        className="w-[540px] bg-[var(--bg-chrome)] border border-[var(--border-strong)] rounded-xl shadow-2xl p-5 text-[var(--text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-hairline)]">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Download className="w-4 h-4 text-[var(--accent)]" />
            <span>导出与格式转换</span>
          </h3>
          <button
            onClick={() => !isProcessing && onClose()}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Format grid */}
        <div className="grid grid-cols-2 gap-2.5 my-4">
          {formatCards.map((fc) => (
            <button
              key={fc.id}
              onClick={() => setSelectedFormat(fc.id)}
              className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                selectedFormat === fc.id
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {fc.icon}
                <span className="font-medium text-xs text-[var(--text-primary)]">{fc.title}</span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-snug">{fc.desc}</p>
            </button>
          ))}
        </div>

        {/* Page Range Selector */}
        <div className="p-3 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-hairline)] text-xs space-y-2 mb-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-[var(--text-primary)]">导出页面范围</span>
            <div className="flex items-center gap-1">
              {[
                { id: 'all' as const, label: `全部 (${pages.length} 页)` },
                { id: 'current' as const, label: `当前页 (第 ${currentPage} 页)` },
                { id: 'custom' as const, label: '自定义范围' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setRangeMode(opt.id);
                    setRangeError(null);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] cursor-pointer transition ${
                    rangeMode === opt.id
                      ? 'bg-[var(--accent)] text-white font-medium'
                      : 'bg-[var(--bg-chrome)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {rangeMode === 'custom' && (
            <div>
              <input
                type="text"
                value={customRangeExpr}
                onChange={(e) => {
                  setCustomRangeExpr(e.target.value);
                  setRangeError(null);
                }}
                placeholder={`输入页码，例如 1-${Math.min(3, pages.length)}, ${pages.length}`}
                className="w-full h-7 px-2.5 rounded bg-[var(--bg-chrome)] border border-[var(--border-strong)] text-xs font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
              {rangeError && <p className="text-[11px] text-[var(--danger)] mt-1">{rangeError}</p>}
            </div>
          )}
        </div>

        {/* Format-specific options */}
        {selectedFormat === 'docx' && (
          <div className="p-3 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-hairline)] text-xs space-y-1.5 mb-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-primary)]">转换引擎</span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                  liveBackendOnline
                    ? 'bg-emerald-500/15 text-[var(--success)]'
                    : 'bg-[var(--bg-chrome)] text-[var(--text-secondary)]'
                }`}
              >
                {liveBackendOnline ? 'Python pdf2docx 在线' : '浏览器纯本地解析'}
              </span>
            </div>
            {liveBackendOnline && (
              <label className="flex items-center gap-2 text-[var(--text-secondary)] cursor-pointer pt-0.5">
                <input
                  type="checkbox"
                  checked={useBackendDocx}
                  onChange={(e) => setUseBackendDocx(e.target.checked)}
                  className="accent-[var(--accent)] cursor-pointer"
                />
                <span>优先使用后端深度表格与多栏版式重建</span>
              </label>
            )}
          </div>
        )}

        {selectedFormat === 'images' && (
          <div className="p-3 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-hairline)] text-xs space-y-2.5 mb-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-primary)]">图片格式</span>
              <div className="flex gap-1.5">
                {(['png', 'jpeg'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setImageFormat(fmt)}
                    className={`px-2.5 py-1 rounded uppercase font-mono text-[11px] cursor-pointer ${
                      imageFormat === fmt
                        ? 'bg-[var(--accent)] text-white font-medium'
                        : 'bg-[var(--bg-chrome)] text-[var(--text-secondary)] border border-[var(--border-hairline)]'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-primary)]">输出清晰度</span>
              <div className="flex gap-1.5">
                {[
                  { label: '标准 1x', val: 1.0 },
                  { label: '高清 2x', val: 2.0 },
                  { label: '超清 3x', val: 3.0 },
                ].map((dpi) => (
                  <button
                    key={dpi.val}
                    onClick={() => setImageDpi(dpi.val)}
                    className={`px-2.5 py-1 rounded text-[11px] cursor-pointer ${
                      imageDpi === dpi.val
                        ? 'bg-[var(--accent)] text-white font-medium'
                        : 'bg-[var(--bg-chrome)] text-[var(--text-secondary)] border border-[var(--border-hairline)]'
                    }`}
                  >
                    {dpi.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center gap-2 p-2.5 mb-3 bg-[var(--accent-soft)] border border-[var(--accent)]/30 rounded-lg text-[var(--text-primary)] text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)] shrink-0" />
            <span>{progressText || '正在处理中...'}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-[var(--border-hairline)]">
          <div>
            {selectedFormat === 'md' && (
              <button
                onClick={handleCopyMarkdown}
                disabled={isProcessing}
                className="px-3 py-1.5 text-xs bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-[var(--text-primary)] rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>复制到剪贴板</span>
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-3.5 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={handleExport}
              disabled={isProcessing}
              className="px-4 py-1.5 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-lg flex items-center gap-1.5 font-medium cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>处理中...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>立即导出</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
