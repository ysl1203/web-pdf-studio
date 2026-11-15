import React, { useEffect, useRef, useState } from 'react';
import { loadPdfDocument } from '../../lib/pdf/loader';
import { AnnotationLayer } from '../../features/editor/AnnotationLayer';
import { DirectTextEditorLayer } from './DirectTextEditorLayer';
import type { Annotation, PageMetadata, SearchMatch, ToolType, WatermarkSettings } from '../../types/pdf';

interface PDFPageViewProps {
  pdfBytes: Uint8Array;
  pageMeta: PageMetadata;
  displayPageNumber: number;
  scale: number;
  activeTool: ToolType;
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  onSelectAnnotation: (id: string | null) => void;
  onAddAnnotation: (annotation: Annotation) => void;
  onUpdateAnnotation: (annotation: Annotation) => void;
  onDeleteAnnotation: (id: string) => void;
  currentColor: string;
  strokeWidth: number;
  fontSize: number;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  textBackgroundColor?: string;
  onFinishTextCreation?: () => void;
  currentFillColor: string;
  hasFill: boolean;
  watermark: WatermarkSettings;
  assets?: Record<string, string>;
  isSelected?: boolean;
  searchMatches?: SearchMatch[];
  activeMatchId?: string | null;
}

export const PDFPageView: React.FC<PDFPageViewProps> = ({
  pdfBytes,
  pageMeta,
  displayPageNumber,
  scale,
  activeTool,
  annotations,
  selectedAnnotationId,
  onSelectAnnotation,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  currentColor,
  strokeWidth,
  fontSize,
  fontFamily,
  bold,
  italic,
  textAlign,
  textBackgroundColor,
  onFinishTextCreation,
  currentFillColor,
  hasFill,
  watermark,
  assets = {},
  isSelected = false,
  searchMatches = [],
  activeMatchId = null,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({
    width: pageMeta.width || 595.28,
    height: pageMeta.height || 841.89,
  });
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let activeRenderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;

    const renderPage = async () => {
      try {
        setRenderError(null);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (pageMeta.isBlank || pageMeta.originalPageIndex < 0) {
          const w = pageMeta.width || 595.28;
          const h = pageMeta.height || 841.89;
          setPageSize({ width: w, height: h });
          const outputScale = window.devicePixelRatio || 1;
          canvas.width = Math.floor(w * scale * outputScale);
          canvas.height = Math.floor(h * scale * outputScale);
          canvas.style.width = `${Math.floor(w * scale)}px`;
          canvas.style.height = `${Math.floor(h * scale)}px`;
          ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w * scale, h * scale);
          return;
        }

        const { pdf: pdfDoc } = await loadPdfDocument(pdfBytes);
        if (isCancelled) return;

        const page = await pdfDoc.getPage(pageMeta.originalPageIndex + 1);
        if (isCancelled) return;

        const intrinsicRotation = pageMeta.originalRotation || page.rotate || 0;
        const effectiveRotation = ((intrinsicRotation + (pageMeta.extraRotation || 0)) % 360 + 360) % 360;

        const viewport = page.getViewport({ scale, rotation: effectiveRotation });
        const unscaledViewport = page.getViewport({ scale: 1.0, rotation: effectiveRotation });
        if (!isCancelled) {
          setPageSize({
            width: unscaledViewport.width,
            height: unscaledViewport.height,
          });
        }

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0);

        activeRenderTask = page.render({
          canvasContext: ctx,
          viewport,
          canvas,
        });

        await activeRenderTask.promise;
      } catch (err: unknown) {
        const name = (err as { name?: string })?.name;
        if (name === 'RenderingCancelledException' || isCancelled) return;
        console.error('Page render error:', err);
        setRenderError((err as Error)?.message || '渲染失败');
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      try {
        activeRenderTask?.cancel();
      } catch {
        // ignore cancel errors
      }
    };
  }, [
    pdfBytes,
    pageMeta.originalPageIndex,
    pageMeta.originalRotation,
    pageMeta.extraRotation,
    pageMeta.rotation,
    pageMeta.isBlank,
    pageMeta.width,
    pageMeta.height,
    scale,
  ]);

  const viewWidth = pageSize.width * scale;
  const viewHeight = pageSize.height * scale;

  const wmText = watermark.text.trim();
  const estWmTextWidth =
    Array.from(wmText).reduce((acc, ch) => acc + (/[\u3000-\u9fff]/.test(ch) ? 1.05 : 0.65), 0) *
    watermark.fontSize *
    scale;
  const wmAngleRad = (watermark.angle * Math.PI) / 180;
  const wmStepBase = Math.max(120, watermark.spacing) * scale;
  const wmStepX = Math.max(wmStepBase, Math.abs(estWmTextWidth * Math.cos(wmAngleRad)) + 84 * scale);
  const wmStepY = Math.max(wmStepBase, watermark.fontSize * 3.2 * scale);
  const wmCols = watermark.enabled ? Math.ceil((viewWidth * 1.4) / wmStepX) + 1 : 0;
  const wmRows = watermark.enabled ? Math.ceil((viewHeight * 1.4) / wmStepY) + 1 : 0;

  return (
    <div
      id={`pdf-page-${displayPageNumber}`}
      data-page-number={displayPageNumber}
      className="flex flex-col items-center mb-7 last:mb-12"
    >
      <div
        className={`relative bg-white rounded-[3px] overflow-hidden transition-shadow ${
          isSelected ? 'ring-2 ring-[var(--accent)]/60' : 'ring-1 ring-black/8'
        }`}
        style={{
          width: `${viewWidth}px`,
          height: `${viewHeight}px`,
          boxShadow: 'var(--shadow-page)',
        }}
      >
        <canvas ref={canvasRef} className="block w-full h-full" />

        {/* Search match overlays */}
        {searchMatches.length > 0 && (
          <div className="absolute inset-0 pointer-events-none z-10">
            {searchMatches.map((m) => {
              const isCurrent = m.id === activeMatchId;
              return (
                <div
                  key={m.id}
                  className={`absolute rounded-xs ${
                    isCurrent
                      ? 'bg-amber-400/55 ring-2 ring-amber-500'
                      : 'bg-yellow-300/40 ring-1 ring-amber-400/50'
                  }`}
                  style={{
                    left: `${m.x * scale}px`,
                    top: `${m.y * scale}px`,
                    width: `${Math.max(12, m.width * scale)}px`,
                    height: `${Math.max(12, m.height * scale)}px`,
                  }}
                />
              );
            })}
          </div>
        )}

        <DirectTextEditorLayer
          pdfBytes={pdfBytes}
          pageMeta={pageMeta}
          displayPageNumber={displayPageNumber}
          scale={scale}
          activeTool={activeTool}
          canvasRef={canvasRef}
          annotations={annotations}
          onAddAnnotation={onAddAnnotation}
          onUpdateAnnotation={onUpdateAnnotation}
          onSelectAnnotation={onSelectAnnotation}
        />

        {watermark && watermark.enabled && watermark.text.trim() && (
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden select-none z-10"
            style={{ opacity: watermark.opacity }}
          >
            {Array.from({ length: wmRows }).map((_, r) =>
              Array.from({ length: wmCols }).map((__, c) => (
                <div
                  key={`${r}_${c}`}
                  className="absolute font-bold whitespace-nowrap"
                  style={{
                    left: `${c * wmStepX + 60 * scale}px`,
                    top: `${r * wmStepY + 60 * scale}px`,
                    color: watermark.color,
                    fontSize: `${watermark.fontSize * scale}px`,
                    transform: `translate(-50%, -50%) rotate(${watermark.angle}deg)`,
                  }}
                >
                  {watermark.text}
                </div>
              ))
            )}
          </div>
        )}

        <AnnotationLayer
          pageNumber={displayPageNumber}
          scale={scale}
          width={pageSize.width}
          height={pageSize.height}
          activeTool={activeTool}
          annotations={annotations}
          selectedId={selectedAnnotationId}
          onSelect={onSelectAnnotation}
          onAddAnnotation={onAddAnnotation}
          onUpdateAnnotation={onUpdateAnnotation}
          onDeleteAnnotation={onDeleteAnnotation}
          currentColor={currentColor}
          strokeWidth={strokeWidth}
          fontSize={fontSize}
          fontFamily={fontFamily}
          bold={bold}
          italic={italic}
          textAlign={textAlign}
          textBackgroundColor={textBackgroundColor}
          onFinishTextCreation={onFinishTextCreation}
          currentFillColor={currentFillColor}
          hasFill={hasFill}
          assets={assets}
        />

        {renderError && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-950/30 text-red-600 text-xs font-medium">
            渲染出错: {renderError}
          </div>
        )}
      </div>

      <div
        className={`mt-2 text-[11px] font-mono tabular-nums px-2.5 py-0.5 rounded-full transition-colors ${
          isSelected
            ? 'bg-[var(--accent)] text-white font-medium'
            : 'text-[var(--text-muted)] bg-[var(--bg-chrome)] border border-[var(--border-hairline)]'
        }`}
      >
        第 {displayPageNumber} 页{pageMeta.isBlank ? '（空白）' : ''}
      </div>
    </div>
  );
};
