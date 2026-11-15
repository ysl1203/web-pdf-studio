import React, { useEffect, useState, useRef } from 'react';
import { pdfjsLib } from '../../utils/pdfWorker';
import { loadPdfDocument } from '../../lib/pdf/loader';
import { generateId } from '../../utils/id';
import type { Annotation, PageMetadata, TextAnnotation, ToolType } from '../../types/pdf';

interface ExtractedTextItem {
  id: string;
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
}

interface DirectTextEditorLayerProps {
  pdfBytes: Uint8Array;
  pageMeta: PageMetadata;
  displayPageNumber: number;
  scale: number;
  activeTool: ToolType;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  annotations: Annotation[];
  onAddAnnotation: (ann: Annotation) => void;
  onUpdateAnnotation: (ann: Annotation) => void;
  onSelectAnnotation: (id: string | null) => void;
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Sample background color right outside the text box and contrasting foreground ink color
 * from the rendered PDF canvas so dark banners & colored table cells blend seamlessly.
 */
function sampleColorsFromCanvas(
  canvas: HTMLCanvasElement | null,
  xPt: number,
  yPt: number,
  wPt: number,
  hPt: number,
  scale: number
): { bgHex: string; fgHex: string } {
  const fallback = { bgHex: '#ffffff', fgHex: '#0f172a' };
  if (!canvas || canvas.width === 0 || canvas.height === 0) return fallback;
  const ctx = canvas.getContext('2d');
  if (!ctx) return fallback;

  try {
    const dpr = canvas.width / Math.max(1, canvas.clientWidth || canvas.width);
    const factor = scale * dpr;
    const px = Math.max(0, Math.min(canvas.width - 2, Math.round(xPt * factor)));
    const py = Math.max(0, Math.min(canvas.height - 2, Math.round(yPt * factor)));
    const pw = Math.max(4, Math.min(canvas.width - px, Math.round(wPt * factor)));
    const ph = Math.max(4, Math.min(canvas.height - py, Math.round(hPt * factor)));

    // Sample perimeter 1-2px outside top & bottom edges for background color
    const borderSamples: [number, number, number][] = [];
    const topY = Math.max(0, py - 2);
    const botY = Math.min(canvas.height - 1, py + ph + 1);
    const stepX = Math.max(1, Math.floor(pw / 8));
    for (let sx = px; sx < px + pw; sx += stepX) {
      const topData = ctx.getImageData(sx, topY, 1, 1).data;
      borderSamples.push([topData[0], topData[1], topData[2]]);
      const botData = ctx.getImageData(sx, botY, 1, 1).data;
      borderSamples.push([botData[0], botData[1], botData[2]]);
    }

    if (borderSamples.length === 0) return fallback;
    borderSamples.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
    const bg = borderSamples[Math.floor(borderSamples.length / 2)];
    const bgLum = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2];

    // Sample interior pixels and pick the pixel furthest in luminance from bg
    const interior = ctx.getImageData(px, py, pw, ph).data;
    let bestFg: [number, number, number] | null = null;
    let maxDist = 35;
    const stride = Math.max(4, Math.floor(interior.length / 400) * 4);
    for (let i = 0; i < interior.length; i += stride) {
      const r = interior[i];
      const g = interior[i + 1];
      const b = interior[i + 2];
      const dist = Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]);
      if (dist > maxDist) {
        maxDist = dist;
        bestFg = [r, g, b];
      }
    }

    const fgHex = bestFg
      ? rgbToHex(bestFg[0], bestFg[1], bestFg[2])
      : bgLum < 128
      ? '#f8fafc'
      : '#0f172a';

    return { bgHex: rgbToHex(bg[0], bg[1], bg[2]), fgHex };
  } catch {
    return fallback;
  }
}

export const DirectTextEditorLayer: React.FC<DirectTextEditorLayerProps> = ({
  pdfBytes,
  pageMeta,
  displayPageNumber,
  scale,
  activeTool,
  canvasRef,
  annotations,
  onAddAnnotation,
  onUpdateAnnotation,
  onSelectAnnotation,
}) => {
  const [textItems, setTextItems] = useState<ExtractedTextItem[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingTargetAnn, setEditingTargetAnn] = useState<TextAnnotation | null>(null);
  const [editTextValue, setEditTextValue] = useState<string>('');
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (pageMeta.isBlank || pageMeta.originalPageIndex < 0) {
      return;
    }

    let isCancelled = false;
    const extractText = async () => {
      try {
        const { pdf: pdfDoc } = await loadPdfDocument(pdfBytes);
        const page = await pdfDoc.getPage(pageMeta.originalPageIndex + 1);
        const textContent = await page.getTextContent();
        const intrinsicRotation = pageMeta.originalRotation || page.rotate || 0;
        const effectiveRotation = ((intrinsicRotation + (pageMeta.extraRotation || 0)) % 360 + 360) % 360;
        const viewport = page.getViewport({ scale: 1.0, rotation: effectiveRotation });

        const items: ExtractedTextItem[] = [];
        let idCounter = 0;

        for (const rawItem of textContent.items) {
          if ('str' in rawItem && rawItem.str.trim().length > 0) {
            const tx = pdfjsLib.Util.transform(viewport.transform, rawItem.transform);
            const fontSize = Math.max(8, Math.round(Math.hypot(tx[0], tx[1])));
            const x = tx[4];
            const baselineY = tx[5];
            const y = baselineY - fontSize * 0.9;
            const w = Math.max(12, rawItem.width || rawItem.str.length * fontSize * 0.55);
            const h = Math.max(fontSize * 1.28, rawItem.height ? rawItem.height * 1.25 : fontSize * 1.28);

            items.push({
              id: `raw_${pageMeta.id}_${idCounter++}`,
              str: rawItem.str,
              x: Math.max(0, x),
              y: Math.max(0, y),
              width: w,
              height: h,
              fontSize,
              fontName: rawItem.fontName || 'Helvetica',
            });
          }
        }

        if (!isCancelled) {
          setTextItems(items);
        }
      } catch (err) {
        console.warn('Direct text extract failed:', err);
      }
    };

    extractText();
    return () => {
      isCancelled = true;
    };
  }, [
    pdfBytes,
    pageMeta.id,
    pageMeta.originalPageIndex,
    pageMeta.originalRotation,
    pageMeta.extraRotation,
    pageMeta.isBlank,
  ]);

  useEffect(() => {
    if (editingItemId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingItemId]);

  const pageReplacements = new Map<string, TextAnnotation>();
  for (const ann of annotations) {
    if (ann.pageNumber === displayPageNumber && ann.type === 'text' && ann.replacesTextKey) {
      pageReplacements.set(ann.replacesTextKey, ann);
    }
  }

  const handleStartEdit = (item: ExtractedTextItem) => {
    const existingAnn = pageReplacements.get(item.id) || null;
    setEditingItemId(item.id);
    setEditingTargetAnn(existingAnn);
    setEditTextValue(existingAnn ? existingAnn.text : item.str);
  };

  const handleFinishEdit = (item: ExtractedTextItem) => {
    const nextVal = editTextValue;
    if (editingTargetAnn) {
      if (nextVal !== editingTargetAnn.text) {
        const estimatedWidth = Math.max(
          item.width + 6,
          nextVal.length * item.fontSize * 0.62 + 12
        );
        onUpdateAnnotation({
          ...editingTargetAnn,
          text: nextVal,
          width: Math.max(editingTargetAnn.width, estimatedWidth),
        });
      }
      onSelectAnnotation(editingTargetAnn.id);
    } else if (nextVal.trim() && nextVal !== item.str) {
      const { bgHex, fgHex } = sampleColorsFromCanvas(
        canvasRef.current,
        item.x,
        item.y,
        item.width,
        item.height,
        scale
      );
      const hasCjk = /[^\x20-\x7e]/.test(nextVal);
      const lowerFont = item.fontName.toLowerCase();
      const guessedFont = hasCjk
        ? 'Noto Sans SC, "PingFang SC", "Microsoft YaHei", sans-serif'
        : lowerFont.includes('times') || lowerFont.includes('serif')
        ? '"Times New Roman", Times, serif'
        : lowerFont.includes('courier') || lowerFont.includes('mono')
        ? '"Courier New", Courier, monospace'
        : 'Helvetica, Arial, sans-serif';

      const newAnn: TextAnnotation = {
        id: generateId('edit'),
        pageNumber: displayPageNumber,
        type: 'text',
        x: Math.max(0, item.x - 2),
        y: Math.max(0, item.y - 1),
        width: Math.max(item.width + 6, nextVal.length * item.fontSize * 0.62 + 14),
        height: item.height + 3,
        color: fgHex,
        opacity: 1,
        text: nextVal,
        fontSize: item.fontSize,
        fontFamily: guessedFont,
        bold: lowerFont.includes('bold'),
        italic: lowerFont.includes('italic') || lowerFont.includes('oblique'),
        textAlign: 'left',
        backgroundColor: bgHex,
        replacesTextKey: item.id,
      };
      onAddAnnotation(newAnn);
      onSelectAnnotation(newAnn.id);
    }

    setEditingItemId(null);
    setEditingTargetAnn(null);
  };

  const isInteractive = activeTool === 'editContent';
  if (!isInteractive && !editingItemId) return null;

  const visibleTextItems = pageMeta.isBlank || pageMeta.originalPageIndex < 0 ? [] : textItems;

  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
      {visibleTextItems.map((item) => {
        const isEditing = editingItemId === item.id;
        const isHovered = hoveredItemId === item.id;
        const alreadyEdited = pageReplacements.has(item.id);

        const left = item.x * scale;
        const top = item.y * scale;
        const w = item.width * scale;
        const h = item.height * scale;

        return (
          <div
            key={item.id}
            className={`absolute pointer-events-auto transition-colors ${
              isInteractive ? 'cursor-text' : ''
            } ${
              isHovered && !isEditing
                ? 'ring-2 ring-blue-500 bg-blue-500/15 rounded-xs z-20'
                : alreadyEdited
                ? 'border border-emerald-500/60 bg-emerald-500/10 rounded-xs'
                : 'border border-dashed border-blue-400/45 hover:bg-blue-500/10'
            }`}
            style={{
              left: `${left}px`,
              top: `${top}px`,
              width: `${Math.max(18, w)}px`,
              height: `${Math.max(14, h)}px`,
            }}
            onMouseEnter={() => setHoveredItemId(item.id)}
            onMouseLeave={() => setHoveredItemId(null)}
            onClick={(e) => {
              e.stopPropagation();
              handleStartEdit(item);
            }}
            title={alreadyEdited ? '再次编辑已修改文字' : `修改原文: "${item.str}"`}
          >
            {isEditing && (
              <textarea
                ref={inputRef}
                value={editTextValue}
                onChange={(e) => setEditTextValue(e.target.value)}
                onBlur={() => handleFinishEdit(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleFinishEdit(item);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setEditingItemId(null);
                    setEditingTargetAnn(null);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="absolute -left-0.5 -top-0.5 px-1 py-0 bg-white text-slate-900 border-2 border-blue-600 rounded-xs shadow-xl outline-none font-sans resize-none leading-[1.2] z-30"
                style={{
                  fontSize: `${item.fontSize * scale}px`,
                  minWidth: `${Math.max(96, w + 36)}px`,
                  minHeight: `${Math.max(24, h + 4)}px`,
                }}
              />
            )}

            {isHovered && !isEditing && (
              <div className="absolute -top-6 left-0 px-1.5 py-0.5 bg-slate-900 text-slate-100 border border-slate-700 text-[10px] font-medium rounded shadow-lg whitespace-nowrap pointer-events-none z-30">
                {alreadyEdited ? '已修改 · 点击再编辑' : item.str.slice(0, 22)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
