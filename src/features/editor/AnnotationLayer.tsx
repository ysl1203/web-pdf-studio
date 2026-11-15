import React, { useState, useRef, useEffect } from 'react';
import { generateId } from '../../utils/id';
import type {
  Annotation,
  DrawAnnotation,
  Point,
  ShapeAnnotation,
  TextAnnotation,
  ToolType,
} from '../../types/pdf';

interface AnnotationLayerProps {
  pageNumber: number;
  scale: number;
  width: number;       // PDF point width
  height: number;      // PDF point height
  activeTool: ToolType;
  annotations: Annotation[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
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
  assets?: Record<string, string>;
}

const TEXT_PAD_X = 4;
const TEXT_PAD_TOP = 3;
const TEXT_PAD_BOTTOM = 4;
const TEXT_LINE_HEIGHT = 1.25;

// Prevents a blur/commit click on one page or annotation from spawning a brand-new box in the same click event.
let suppressTextSpawn = false;
let suppressTextSpawnTimer = 0;

function markSuppressTextSpawn() {
  suppressTextSpawn = true;
  if (typeof window !== 'undefined') {
    window.clearTimeout(suppressTextSpawnTimer);
    suppressTextSpawnTimer = window.setTimeout(() => {
      suppressTextSpawn = false;
    }, 140);
  }
}

let sharedMeasureCtx: CanvasRenderingContext2D | null = null;

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (sharedMeasureCtx) return sharedMeasureCtx;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  sharedMeasureCtx = canvas.getContext('2d');
  return sharedMeasureCtx;
}

function countWrappedLines(
  rawText: string,
  ctx: CanvasRenderingContext2D | null,
  innerWidth: number,
  fallbackCharW: number
): number {
  const safeInnerW = Math.max(12, innerWidth);
  const paragraphs = rawText.split('\n');
  let lines = 0;

  for (const para of paragraphs) {
    if (!para) {
      lines += 1;
      continue;
    }
    const fullW = ctx ? ctx.measureText(para).width : para.length * fallbackCharW;
    if (fullW <= safeInnerW) {
      lines += 1;
      continue;
    }
    let currentLine = '';
    for (const ch of para) {
      const candidate = currentLine + ch;
      const candW = ctx ? ctx.measureText(candidate).width : candidate.length * fallbackCharW;
      if (currentLine && candW > safeInnerW) {
        lines += 1;
        currentLine = ch;
      } else {
        currentLine = candidate;
      }
    }
    if (currentLine) lines += 1;
  }

  return Math.max(1, lines);
}

function measureTextBoxSize(params: {
  text: string;
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  boxX: number;
  boxY: number;
  minWidth: number;
  minHeight: number;
  maxPageWidth: number;
  maxPageHeight: number;
  autoExpandWidth: boolean;
}): { width: number; height: number } {
  const {
    text,
    fontSize,
    fontFamily,
    bold,
    italic,
    boxX,
    boxY,
    minWidth,
    minHeight,
    maxPageWidth,
    maxPageHeight,
    autoExpandWidth,
  } = params;

  const ctx = getMeasureCtx();
  if (ctx) {
    ctx.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
  }

  const maxAvailW = Math.max(minWidth, maxPageWidth - boxX - 8);
  const maxAvailH = Math.max(minHeight, maxPageHeight - boxY - 4);
  const fallbackCharW = fontSize * 0.65;

  let nextW = Math.min(maxAvailW, minWidth);
  if (autoExpandWidth && text) {
    let widest = minWidth;
    for (const line of text.split('\n')) {
      const lineW = (ctx ? ctx.measureText(line).width : line.length * fallbackCharW) + TEXT_PAD_X * 2 + 8;
      if (lineW > widest) widest = lineW;
    }
    nextW = Math.min(maxAvailW, widest);
  }

  const lineCount = text ? countWrappedLines(text, ctx, nextW - TEXT_PAD_X * 2, fallbackCharW) : 1;
  const contentH = Math.ceil(lineCount * fontSize * TEXT_LINE_HEIGHT + TEXT_PAD_TOP + TEXT_PAD_BOTTOM);
  const nextH = Math.min(maxAvailH, Math.max(minHeight, contentH));
  return { width: nextW, height: nextH };
}

interface InlineTextEditorBoxProps {
  editorId: string;
  value: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  textAlign: 'left' | 'center' | 'right';
  backgroundColor?: string;
  scale: number;
  placePillAbove: boolean;
  alignPillRight: boolean;
  attachRef: (el: HTMLTextAreaElement | null) => void;
  onChangeText: (nextVal: string, el: HTMLTextAreaElement) => void;
  onCommit: () => void;
  onCancel: () => void;
}

const InlineTextEditorBox: React.FC<InlineTextEditorBoxProps> = ({
  editorId,
  value,
  color,
  fontSize,
  fontFamily,
  bold,
  italic,
  textAlign,
  backgroundColor,
  scale,
  placePillAbove,
  alignPillRight,
  attachRef,
  onChangeText,
  onCommit,
  onCancel,
}) => {
  const hasExplicitBg = Boolean(backgroundColor) && backgroundColor !== 'transparent';
  const editorBg = hasExplicitBg
    ? backgroundColor
    : color.toLowerCase() === '#ffffff'
    ? 'rgba(15, 23, 42, 0.58)'
    : 'rgba(255, 255, 255, 0.8)';

  return (
    <div
      data-active-text-editor="true"
      data-editor-id={editorId}
      className="relative w-full h-full pointer-events-auto"
      onMouseDown={(ev) => ev.stopPropagation()}
      onClick={(ev) => ev.stopPropagation()}
    >
      <textarea
        ref={attachRef}
        autoFocus
        placeholder="在此输入文字..."
        className="w-full h-full box-border resize-none outline-none overflow-hidden rounded-[2px] placeholder:text-slate-400/85"
        style={{
          padding: `${TEXT_PAD_TOP * scale}px ${TEXT_PAD_X * scale}px`,
          fontSize: `${fontSize * scale}px`,
          fontFamily,
          fontWeight: bold ? 'bold' : 'normal',
          fontStyle: italic ? 'italic' : 'normal',
          textAlign,
          lineHeight: TEXT_LINE_HEIGHT,
          color,
          backgroundColor: editorBg,
          border: '1.5px dashed #2563eb',
          boxShadow: '0 0 0 2px rgba(37, 99, 235, 0.14)',
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
        }}
        value={value}
        onMouseDown={(ev) => ev.stopPropagation()}
        onChange={(ev) => onChangeText(ev.target.value, ev.currentTarget)}
        onKeyDown={(ev) => {
          if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
            ev.preventDefault();
            ev.stopPropagation();
            onCommit();
          } else if (ev.key === 'Escape') {
            ev.preventDefault();
            ev.stopPropagation();
            onCancel();
          }
        }}
      />
      <div
        className={`absolute ${placePillAbove ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} ${
          alignPillRight ? 'right-0' : 'left-0'
        } z-50 flex items-center gap-2 px-2 py-1 rounded-md bg-slate-900/92 text-white border border-white/15 shadow-lg text-[11px] whitespace-nowrap select-none backdrop-blur-sm`}
      >
        <button
          type="button"
          onMouseDown={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
          }}
          onClick={(ev) => {
            ev.stopPropagation();
            onCommit();
          }}
          className="px-1.5 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium cursor-pointer transition-colors"
        >
          ✓ 完成
        </button>
        <span className="text-[10px] text-slate-300">Enter 换行 · Ctrl+Enter 完成 · Esc 取消</span>
      </div>
    </div>
  );
};

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'line-start' | 'line-end';

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function isPointNearPolyline(p: Point, points: Point[], threshold: number): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    if (distanceToSegment(p, points[i], points[i + 1]) <= threshold) {
      return true;
    }
  }
  return false;
}

function computeArrowHeadPolygon(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeW: number
): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = Math.max(10, strokeW * 3.2);
  const headAngle = Math.PI / 6;
  const p1x = x2 - headLen * Math.cos(angle - headAngle);
  const p1y = y2 - headLen * Math.sin(angle - headAngle);
  const p2x = x2 - headLen * Math.cos(angle + headAngle);
  const p2y = y2 - headLen * Math.sin(angle + headAngle);
  return `${x2},${y2} ${p1x},${p1y} ${p2x},${p2y}`;
}

export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({
  pageNumber,
  scale,
  width,
  height,
  activeTool,
  annotations,
  selectedId,
  onSelect,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  currentColor,
  strokeWidth,
  fontSize,
  fontFamily = 'Noto Sans SC, "PingFang SC", "Microsoft YaHei", sans-serif',
  bold = false,
  italic = false,
  textAlign = 'left',
  textBackgroundColor = 'transparent',
  onFinishTextCreation,
  currentFillColor,
  hasFill,
  assets = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const focusedEditorKeyRef = useRef<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [eraserPos, setEraserPos] = useState<Point | null>(null);

  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentShapePreview, setCurrentShapePreview] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  // Local draft for smooth drag/resize without spamming undo history on mousemove
  const [dragState, setDragState] = useState<{
    id: string;
    startPt: Point;
    originAnn: Annotation;
    draftAnn: Annotation;
  } | null>(null);

  const [resizeState, setResizeState] = useState<{
    id: string;
    handle: ResizeHandle;
    startPt: Point;
    originAnn: Annotation;
    draftAnn: Annotation;
  } | null>(null);

  const [draftTextAnn, setDraftTextAnn] = useState<{
    id: string;
    x: number;
    y: number;
    baseWidth: number;
    baseHeight: number;
    text: string;
    isCustomBox: boolean;
    scrollExtraHeight: number;
  } | null>(null);

  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextVal, setEditingTextVal] = useState('');
  const [editingBaseHeight, setEditingBaseHeight] = useState<number>(34);
  const [editingScrollExtraH, setEditingScrollExtraH] = useState<number>(0);

  const minSingleLineTextH = Math.max(
    26,
    Math.ceil(fontSize * TEXT_LINE_HEIGHT + TEXT_PAD_TOP + TEXT_PAD_BOTTOM)
  );

  const draftMeasured = draftTextAnn
    ? measureTextBoxSize({
        text: draftTextAnn.text,
        fontSize,
        fontFamily,
        bold,
        italic,
        boxX: draftTextAnn.x,
        boxY: draftTextAnn.y,
        minWidth: draftTextAnn.baseWidth,
        minHeight: Math.max(draftTextAnn.baseHeight, minSingleLineTextH),
        maxPageWidth: width,
        maxPageHeight: height,
        autoExpandWidth: !draftTextAnn.isCustomBox,
      })
    : null;

  const effectiveDraftAnn: TextAnnotation | null =
    draftTextAnn && draftMeasured
      ? {
          id: draftTextAnn.id,
          pageNumber,
          type: 'text',
          x: draftTextAnn.x,
          y: draftTextAnn.y,
          width: draftMeasured.width,
          height: Math.min(
            Math.max(minSingleLineTextH, height - draftTextAnn.y - 4),
            Math.max(draftMeasured.height, draftTextAnn.scrollExtraHeight)
          ),
          color: currentColor,
          opacity: 1,
          text: draftTextAnn.text,
          fontSize,
          fontFamily,
          bold,
          italic,
          textAlign,
          backgroundColor: textBackgroundColor,
        }
      : null;

  const editingTargetAnn = editingTextId
    ? annotations.find((a): a is TextAnnotation => a.id === editingTextId && a.type === 'text') || null
    : null;

  const editingMeasuredH = editingTargetAnn
    ? Math.min(
        Math.max(editingTargetAnn.height, height - editingTargetAnn.y - 4),
        Math.max(
          measureTextBoxSize({
            text: editingTextVal,
            fontSize: editingTargetAnn.fontSize,
            fontFamily: editingTargetAnn.fontFamily || fontFamily,
            bold: editingTargetAnn.bold,
            italic: editingTargetAnn.italic,
            boxX: editingTargetAnn.x,
            boxY: editingTargetAnn.y,
            minWidth: editingTargetAnn.width,
            minHeight: editingBaseHeight,
            maxPageWidth: width,
            maxPageHeight: height,
            autoExpandWidth: false,
          }).height,
          editingScrollExtraH
        )
      )
    : null;

  const commitActiveText = () => {
    if (effectiveDraftAnn) {
      if (effectiveDraftAnn.text.trim()) {
        onAddAnnotation(effectiveDraftAnn);
        onSelect(effectiveDraftAnn.id);
        onFinishTextCreation?.();
      }
      focusedEditorKeyRef.current = null;
      setDraftTextAnn(null);
      return;
    }
    if (editingTargetAnn) {
      const nextH = editingMeasuredH ?? editingTargetAnn.height;
      if (!editingTextVal.trim()) {
        onDeleteAnnotation(editingTargetAnn.id);
      } else if (editingTextVal !== editingTargetAnn.text || Math.abs(nextH - editingTargetAnn.height) > 0.5) {
        onUpdateAnnotation({
          ...editingTargetAnn,
          text: editingTextVal,
          height: nextH,
        });
      }
      focusedEditorKeyRef.current = null;
      setEditingTextId(null);
      if (activeTool === 'text') {
        onFinishTextCreation?.();
      }
    }
  };

  const cancelActiveText = () => {
    focusedEditorKeyRef.current = null;
    if (draftTextAnn) {
      setDraftTextAnn(null);
      onFinishTextCreation?.();
      return;
    }
    if (editingTextId) {
      setEditingTextId(null);
      if (activeTool === 'text') {
        onFinishTextCreation?.();
      }
    }
  };

  const editorActionsRef = useRef<{
    commit: () => void;
    discardEmptyDraft: () => void;
    hasNonEmptyEdit: () => boolean;
  }>({
    commit: () => {},
    discardEmptyDraft: () => {},
    hasNonEmptyEdit: () => false,
  });

  useEffect(() => {
    editorActionsRef.current = {
      commit: commitActiveText,
      discardEmptyDraft: () => {
        if (draftTextAnn && !draftTextAnn.text.trim()) {
          focusedEditorKeyRef.current = null;
          setDraftTextAnn(null);
        }
      },
      hasNonEmptyEdit: () => {
        if (editingTextId) return true;
        return Boolean(draftTextAnn && draftTextAnn.text.trim());
      },
    };
  });

  const isTextEditorOpen = Boolean(draftTextAnn || editingTextId);

  useEffect(() => {
    if (!isTextEditorOpen) return;
    const onWindowMouseDown = (ev: MouseEvent) => {
      const target = ev.target instanceof Element ? ev.target : null;
      if (
        target?.closest('[data-active-text-editor="true"]') ||
        target?.closest('[data-text-toolbar="true"]')
      ) {
        return;
      }
      if (editorActionsRef.current.hasNonEmptyEdit()) {
        markSuppressTextSpawn();
        editorActionsRef.current.commit();
      } else {
        editorActionsRef.current.discardEmptyDraft();
      }
    };
    window.addEventListener('mousedown', onWindowMouseDown, true);
    return () => {
      window.removeEventListener('mousedown', onWindowMouseDown, true);
    };
  }, [isTextEditorOpen]);

  const openExistingTextEditor = (ann: TextAnnotation) => {
    focusedEditorKeyRef.current = null;
    setDraftTextAnn(null);
    onSelect(ann.id);
    setEditingTextId(ann.id);
    setEditingTextVal(ann.text);
    setEditingBaseHeight(ann.height);
    setEditingScrollExtraH(0);
  };

  const attachTextareaRef = (el: HTMLTextAreaElement | null, editorId: string) => {
    if (!el) return;
    if (focusedEditorKeyRef.current !== editorId) {
      focusedEditorKeyRef.current = editorId;
      el.focus({ preventScroll: true });
      const end = el.value.length;
      el.setSelectionRange(end, end);
    }
  };

  const syncTextareaScrollHeight = (el: HTMLTextAreaElement, boxY: number, isDraft: boolean) => {
    requestAnimationFrame(() => {
      if (!el.isConnected) return;
      if (el.scrollHeight <= el.clientHeight + 2) return;
      const neededPt = Math.min(Math.max(26, height - boxY - 4), Math.ceil(el.scrollHeight / scale) + 2);
      if (isDraft) {
        setDraftTextAnn((prev) =>
          prev && neededPt > prev.scrollExtraHeight ? { ...prev, scrollExtraHeight: neededPt } : prev
        );
      } else {
        setEditingScrollExtraH((prev) => (neededPt > prev ? neededPt : prev));
      }
    });
  };

  const pageAnnotations = annotations
    .filter((a) => a.pageNumber === pageNumber)
    .map((ann) => {
      if (dragState && dragState.id === ann.id) return dragState.draftAnn;
      if (resizeState && resizeState.id === ann.id) return resizeState.draftAnn;
      return ann;
    });

  const getPdfCoordinates = (e: React.MouseEvent): Point => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  };

  const checkAndEraseAtPoint = (pt: Point) => {
    const eraserHitRadius = Math.max(12, strokeWidth * 1.6);

    // Iterate top-to-bottom (reverse creation order)
    for (let i = pageAnnotations.length - 1; i >= 0; i--) {
      const ann = pageAnnotations[i];
      if (ann.type === 'draw' || ann.type === 'highlight') {
        if (ann.points && ann.points.length > 1) {
          const threshold = ann.strokeWidth / 2 + eraserHitRadius;
          if (isPointNearPolyline(pt, ann.points, threshold)) {
            onDeleteAnnotation(ann.id);
            if (selectedId === ann.id) onSelect(null);
            return;
          }
        }
      } else if (ann.type === 'line' || ann.type === 'arrow') {
        const start = { x: ann.x, y: ann.y };
        const end = { x: ann.x + ann.width, y: ann.y + ann.height };
        const threshold = ann.strokeWidth / 2 + eraserHitRadius;
        if (distanceToSegment(pt, start, end) <= threshold) {
          onDeleteAnnotation(ann.id);
          if (selectedId === ann.id) onSelect(null);
          return;
        }
      } else {
        const minX = Math.min(ann.x, ann.x + ann.width) - eraserHitRadius * 0.5;
        const maxX = Math.max(ann.x, ann.x + ann.width) + eraserHitRadius * 0.5;
        const minY = Math.min(ann.y, ann.y + ann.height) - eraserHitRadius * 0.5;
        const maxY = Math.max(ann.y, ann.y + ann.height) + eraserHitRadius * 0.5;
        if (pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY) {
          onDeleteAnnotation(ann.id);
          if (selectedId === ann.id) onSelect(null);
          return;
        }
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || activeTool === 'hand' || activeTool === 'editContent') return;
    const pt = getPdfCoordinates(e);

    if (activeTool === 'erase') {
      setIsErasing(true);
      checkAndEraseAtPoint(pt);
      return;
    }

    if (activeTool === 'select') {
      if (e.target === containerRef.current) {
        onSelect(null);
      }
      return;
    }

    if (activeTool === 'text') {
      if (suppressTextSpawn || draftTextAnn || editingTextId) {
        return;
      }
      setIsDrawing(true);
      setStartPoint(pt);
      setCurrentShapePreview({ x: pt.x, y: pt.y, w: 0, h: 0 });
      return;
    }

    if (activeTool === 'draw' || activeTool === 'highlight') {
      setIsDrawing(true);
      setCurrentPoints([pt]);
      return;
    }

    if (activeTool === 'rect' || activeTool === 'circle' || activeTool === 'line' || activeTool === 'arrow') {
      setIsDrawing(true);
      setStartPoint(pt);
      setCurrentShapePreview({ x: pt.x, y: pt.y, w: 0, h: 0 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pt = getPdfCoordinates(e);

    if (activeTool === 'erase') {
      setEraserPos(pt);
      if (isErasing) {
        checkAndEraseAtPoint(pt);
      }
      return;
    }
    if (eraserPos) setEraserPos(null);

    if (resizeState) {
      const { handle, startPt, originAnn } = resizeState;
      const dx = pt.x - startPt.x;
      const dy = pt.y - startPt.y;

      if ((originAnn.type === 'line' || originAnn.type === 'arrow') && (handle === 'line-start' || handle === 'line-end')) {
        if (handle === 'line-start') {
          const endX = originAnn.x + originAnn.width;
          const endY = originAnn.y + originAnn.height;
          const nx = Math.max(0, Math.min(width, originAnn.x + dx));
          const ny = Math.max(0, Math.min(height, originAnn.y + dy));
          setResizeState({
            ...resizeState,
            draftAnn: { ...originAnn, x: nx, y: ny, width: endX - nx, height: endY - ny },
          });
        } else {
          const newEndX = Math.max(0, Math.min(width, originAnn.x + originAnn.width + dx));
          const newEndY = Math.max(0, Math.min(height, originAnn.y + originAnn.height + dy));
          setResizeState({
            ...resizeState,
            draftAnn: { ...originAnn, width: newEndX - originAnn.x, height: newEndY - originAnn.y },
          });
        }
        return;
      }

      const minSize = originAnn.type === 'text' ? 32 : 16;
      const lockAspect =
        originAnn.type === 'signature' || originAnn.type === 'stamp' || e.shiftKey;
      const aspect = originAnn.width / Math.max(1, originAnn.height);

      let newX = originAnn.x;
      let newY = originAnn.y;
      let newW = originAnn.width;
      let newH = originAnn.height;

      if (handle === 'se') {
        newW = Math.max(minSize, originAnn.width + dx);
        newH = lockAspect ? newW / aspect : Math.max(minSize, originAnn.height + dy);
      } else if (handle === 'sw') {
        newW = Math.max(minSize, originAnn.width - dx);
        newH = lockAspect ? newW / aspect : Math.max(minSize, originAnn.height + dy);
        newX = originAnn.x + (originAnn.width - newW);
      } else if (handle === 'ne') {
        newW = Math.max(minSize, originAnn.width + dx);
        newH = lockAspect ? newW / aspect : Math.max(minSize, originAnn.height - dy);
        newY = originAnn.y + (originAnn.height - newH);
      } else if (handle === 'nw') {
        newW = Math.max(minSize, originAnn.width - dx);
        newH = lockAspect ? newW / aspect : Math.max(minSize, originAnn.height - dy);
        newX = originAnn.x + (originAnn.width - newW);
        newY = originAnn.y + (originAnn.height - newH);
      }

      newX = Math.max(0, Math.min(width - minSize, newX));
      newY = Math.max(0, Math.min(height - minSize, newY));
      newW = Math.min(newW, width - newX);
      newH = Math.min(newH, height - newY);

      if (originAnn.type === 'text') {
        const minReq = measureTextBoxSize({
          text: originAnn.text,
          fontSize: originAnn.fontSize,
          fontFamily: originAnn.fontFamily || fontFamily,
          bold: originAnn.bold,
          italic: originAnn.italic,
          boxX: newX,
          boxY: newY,
          minWidth: newW,
          minHeight: 24,
          maxPageWidth: width,
          maxPageHeight: height,
          autoExpandWidth: false,
        });
        newH = Math.min(height - newY, Math.max(newH, minReq.height));
      }

      setResizeState({
        ...resizeState,
        draftAnn: { ...originAnn, x: newX, y: newY, width: newW, height: newH },
      });
      return;
    }

    if (dragState) {
      const { startPt, originAnn } = dragState;
      const dx = pt.x - startPt.x;
      const dy = pt.y - startPt.y;

      if (originAnn.type === 'draw' || originAnn.type === 'highlight') {
        setDragState({
          ...dragState,
          draftAnn: {
            ...originAnn,
            points: originAnn.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
          },
        });
      } else if (originAnn.type === 'line' || originAnn.type === 'arrow') {
        setDragState({
          ...dragState,
          draftAnn: {
            ...originAnn,
            x: originAnn.x + dx,
            y: originAnn.y + dy,
          },
        });
      } else {
        setDragState({
          ...dragState,
          draftAnn: {
            ...originAnn,
            x: Math.max(0, Math.min(width - originAnn.width, originAnn.x + dx)),
            y: Math.max(0, Math.min(height - originAnn.height, originAnn.y + dy)),
          },
        });
      }
      return;
    }

    if (isDrawing && (activeTool === 'draw' || activeTool === 'highlight')) {
      setCurrentPoints((prev) => [...prev, pt]);
      return;
    }

    if (
      isDrawing &&
      startPoint &&
      (activeTool === 'text' ||
        activeTool === 'rect' ||
        activeTool === 'circle' ||
        activeTool === 'line' ||
        activeTool === 'arrow')
    ) {
      if (activeTool === 'line' || activeTool === 'arrow') {
        setCurrentShapePreview({
          x: startPoint.x,
          y: startPoint.y,
          w: pt.x - startPoint.x,
          h: pt.y - startPoint.y,
        });
      } else {
        setCurrentShapePreview({
          x: Math.min(startPoint.x, pt.x),
          y: Math.min(startPoint.y, pt.y),
          w: Math.abs(pt.x - startPoint.x),
          h: Math.abs(pt.y - startPoint.y),
        });
      }
    }
  };

  const commitDragOrResize = () => {
    if (resizeState) {
      const { originAnn, draftAnn } = resizeState;
      setResizeState(null);
      if (
        originAnn.x !== draftAnn.x ||
        originAnn.y !== draftAnn.y ||
        originAnn.width !== draftAnn.width ||
        originAnn.height !== draftAnn.height
      ) {
        onUpdateAnnotation(draftAnn);
      }
      return true;
    }
    if (dragState) {
      const { originAnn, draftAnn } = dragState;
      setDragState(null);
      if (JSON.stringify(originAnn) !== JSON.stringify(draftAnn)) {
        onUpdateAnnotation(draftAnn);
      }
      return true;
    }
    return false;
  };

  const handleMouseUp = () => {
    if (isErasing) {
      setIsErasing(false);
      return;
    }

    if (commitDragOrResize()) {
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    if ((activeTool === 'draw' || activeTool === 'highlight') && currentPoints.length > 1) {
      const isHigh = activeTool === 'highlight';
      const hlColor =
        isHigh && (currentColor.toLowerCase() === '#0f172a' || currentColor.toLowerCase() === '#ffffff')
          ? '#facc15'
          : currentColor;
      const newAnn: Annotation = {
        id: generateId(isHigh ? 'hl' : 'draw'),
        pageNumber,
        type: isHigh ? 'highlight' : 'draw',
        x: 0,
        y: 0,
        width,
        height,
        color: isHigh ? hlColor : currentColor,
        opacity: isHigh ? 0.38 : 1,
        strokeWidth: isHigh ? Math.max(14, strokeWidth * 2.5) : strokeWidth,
        points: currentPoints,
      };
      onAddAnnotation(newAnn);
      setCurrentPoints([]);
      return;
    }

    if (startPoint && currentShapePreview && activeTool === 'text') {
      const isDraggedBox = currentShapePreview.w >= 8 || currentShapePreview.h >= 8;
      let boxX: number;
      let boxY: number;
      let boxW: number;
      let boxH: number;

      if (isDraggedBox) {
        boxX = Math.max(4, Math.min(width - 48, currentShapePreview.x));
        boxY = Math.max(4, Math.min(height - minSingleLineTextH - 4, currentShapePreview.y));
        boxW = Math.min(width - boxX - 4, Math.max(80, currentShapePreview.w));
        boxH = Math.min(height - boxY - 4, Math.max(minSingleLineTextH, currentShapePreview.h));
      } else {
        boxW = Math.min(Math.max(148, fontSize * 8.5), Math.max(56, width - startPoint.x - 10));
        boxX = Math.max(4, Math.min(width - boxW - 4, startPoint.x));
        boxH = minSingleLineTextH;
        boxY = Math.max(4, Math.min(height - boxH - 4, startPoint.y - fontSize * 0.55));
      }

      focusedEditorKeyRef.current = null;
      setStartPoint(null);
      setCurrentShapePreview(null);
      onSelect(null);
      setDraftTextAnn({
        id: generateId('text'),
        x: boxX,
        y: boxY,
        baseWidth: boxW,
        baseHeight: boxH,
        text: '',
        isCustomBox: isDraggedBox,
        scrollExtraHeight: 0,
      });
      return;
    }

    if (
      startPoint &&
      currentShapePreview &&
      (activeTool === 'rect' || activeTool === 'circle' || activeTool === 'line' || activeTool === 'arrow')
    ) {
      const isLineOrArrow = activeTool === 'line' || activeTool === 'arrow';
      const w = currentShapePreview.w;
      const h = currentShapePreview.h;

      if (Math.hypot(w, h) > 4) {
        const newAnn: Annotation = {
          id: generateId('shape'),
          pageNumber,
          type: activeTool,
          x: currentShapePreview.x,
          y: currentShapePreview.y,
          width: isLineOrArrow ? w : Math.max(10, Math.abs(w)),
          height: isLineOrArrow ? h : Math.max(10, Math.abs(h)),
          color: currentColor,
          strokeWidth,
          opacity: 1,
          hasFill,
          fillColor: hasFill ? currentFillColor : undefined,
        };
        onAddAnnotation(newAnn);
        onSelect(newAnn.id);
      }
      setStartPoint(null);
      setCurrentShapePreview(null);
    }
  };

  const handleMouseLeave = () => {
    setIsErasing(false);
    setEraserPos(null);
    commitDragOrResize();
    if (isDrawing) {
      handleMouseUp();
    }
  };

  const highlightStrokeWidth = Math.max(14, strokeWidth * 2.5);
  const highlightPreviewColor =
    currentColor.toLowerCase() === '#0f172a' || currentColor.toLowerCase() === '#ffffff'
      ? '#facc15'
      : currentColor;

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 select-none ${
        activeTool === 'hand' || activeTool === 'editContent'
          ? 'pointer-events-none'
          : activeTool === 'select'
          ? 'cursor-default'
          : activeTool === 'text'
          ? 'cursor-text'
          : activeTool === 'erase'
          ? 'cursor-none'
          : 'cursor-crosshair'
      }`}
      style={{
        width: width * scale,
        height: height * scale,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* SVG Layer: Freehand Strokes, Highlights, Lines & Arrows */}
      <svg
        className="absolute inset-0 overflow-visible"
        width={width * scale}
        height={height * scale}
        style={{ pointerEvents: 'none' }}
      >
        {/* Freehand Drawings & Highlights */}
        {pageAnnotations
          .filter((a): a is DrawAnnotation => a.type === 'draw' || a.type === 'highlight')
          .map((a) => {
            if (!a.points || a.points.length < 2) return null;
            const pathData = a.points.reduce(
              (acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x * scale} ${pt.y * scale}`,
              ''
            );
            const isSelected = a.id === selectedId;

            return (
              <g key={a.id}>
                <path
                  d={pathData}
                  stroke={a.color}
                  strokeWidth={a.strokeWidth * scale}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity={a.type === 'highlight' ? 0.38 : a.opacity}
                  className="pointer-events-none"
                />
                {isSelected && (
                  <path
                    d={pathData}
                    stroke="#3b82f6"
                    strokeWidth={(a.strokeWidth + 4) * scale}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="6 4"
                    fill="none"
                    opacity={0.85}
                    className="pointer-events-none"
                  />
                )}
                <path
                  d={pathData}
                  stroke="transparent"
                  strokeWidth={Math.max(22, (a.strokeWidth + 12) * scale)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  style={{
                    pointerEvents: activeTool === 'erase' || activeTool === 'select' ? 'stroke' : 'none',
                    cursor: activeTool === 'erase' ? 'none' : 'move',
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (activeTool === 'erase') {
                      onDeleteAnnotation(a.id);
                      return;
                    }
                    if (activeTool === 'select') {
                      onSelect(a.id);
                      const pt = getPdfCoordinates(e);
                      setDragState({ id: a.id, startPt: pt, originAnn: a, draftAnn: a });
                    }
                  }}
                />
              </g>
            );
          })}

        {/* Vector Lines & Arrows */}
        {pageAnnotations
          .filter((a): a is ShapeAnnotation => a.type === 'line' || a.type === 'arrow')
          .map((a) => {
            const x1 = a.x * scale;
            const y1 = a.y * scale;
            const x2 = (a.x + a.width) * scale;
            const y2 = (a.y + a.height) * scale;
            const isSelected = a.id === selectedId;

            return (
              <g key={a.id}>
                {isSelected && (
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#3b82f6"
                    strokeWidth={(a.strokeWidth + 6) * scale}
                    strokeDasharray="5 3"
                    strokeLinecap="round"
                    opacity={0.65}
                  />
                )}
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={a.color}
                  strokeWidth={a.strokeWidth * scale}
                  strokeLinecap="round"
                  opacity={a.opacity}
                />
                {a.type === 'arrow' && (
                  <polygon
                    points={computeArrowHeadPolygon(x1, y1, x2, y2, a.strokeWidth * scale)}
                    fill={a.color}
                    opacity={a.opacity}
                  />
                )}
                {/* Hit target */}
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="transparent"
                  strokeWidth={Math.max(20, (a.strokeWidth + 12) * scale)}
                  strokeLinecap="round"
                  style={{
                    pointerEvents: activeTool === 'erase' || activeTool === 'select' ? 'stroke' : 'none',
                    cursor: activeTool === 'erase' ? 'none' : 'move',
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (activeTool === 'erase') {
                      onDeleteAnnotation(a.id);
                      return;
                    }
                    if (activeTool === 'select') {
                      onSelect(a.id);
                      const pt = getPdfCoordinates(e);
                      setDragState({ id: a.id, startPt: pt, originAnn: a, draftAnn: a });
                    }
                  }}
                />
                {/* Interactive line endpoints when selected */}
                {isSelected && activeTool === 'select' && (
                  <>
                    <circle
                      cx={x1}
                      cy={y1}
                      r={5.5}
                      fill="#ffffff"
                      stroke="#2563eb"
                      strokeWidth={2}
                      style={{ pointerEvents: 'all', cursor: 'grab' }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        const pt = getPdfCoordinates(e);
                        setResizeState({
                          id: a.id,
                          handle: 'line-start',
                          startPt: pt,
                          originAnn: a,
                          draftAnn: a,
                        });
                      }}
                    />
                    <circle
                      cx={x2}
                      cy={y2}
                      r={5.5}
                      fill="#ffffff"
                      stroke="#2563eb"
                      strokeWidth={2}
                      style={{ pointerEvents: 'all', cursor: 'grab' }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        const pt = getPdfCoordinates(e);
                        setResizeState({
                          id: a.id,
                          handle: 'line-end',
                          startPt: pt,
                          originAnn: a,
                          draftAnn: a,
                        });
                      }}
                    />
                  </>
                )}
              </g>
            );
          })}

        {/* Live Drawing Preview */}
        {isDrawing && currentPoints.length > 1 && (
          <path
            d={currentPoints.reduce(
              (acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x * scale} ${pt.y * scale}`,
              ''
            )}
            stroke={activeTool === 'highlight' ? highlightPreviewColor : currentColor}
            strokeWidth={(activeTool === 'highlight' ? highlightStrokeWidth : strokeWidth) * scale}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={activeTool === 'highlight' ? 0.38 : 1}
          />
        )}

        {/* Live Shape & Text Box Preview */}
        {isDrawing && currentShapePreview && (
          <>
            {activeTool === 'text' && (currentShapePreview.w > 6 || currentShapePreview.h > 6) && (
              <rect
                x={currentShapePreview.x * scale}
                y={currentShapePreview.y * scale}
                width={currentShapePreview.w * scale}
                height={currentShapePreview.h * scale}
                stroke="#2563eb"
                strokeWidth={1.5}
                fill="rgba(37, 99, 235, 0.06)"
                strokeDasharray="5 3"
                rx={2}
              />
            )}
            {activeTool === 'rect' && (
              <rect
                x={currentShapePreview.x * scale}
                y={currentShapePreview.y * scale}
                width={currentShapePreview.w * scale}
                height={currentShapePreview.h * scale}
                stroke={currentColor}
                strokeWidth={strokeWidth * scale}
                fill={hasFill ? currentFillColor : 'none'}
                strokeDasharray="4 4"
              />
            )}
            {activeTool === 'circle' && (
              <ellipse
                cx={(currentShapePreview.x + currentShapePreview.w / 2) * scale}
                cy={(currentShapePreview.y + currentShapePreview.h / 2) * scale}
                rx={(currentShapePreview.w / 2) * scale}
                ry={(currentShapePreview.h / 2) * scale}
                stroke={currentColor}
                strokeWidth={strokeWidth * scale}
                fill={hasFill ? currentFillColor : 'none'}
                strokeDasharray="4 4"
              />
            )}
            {(activeTool === 'line' || activeTool === 'arrow') && (
              <>
                <line
                  x1={currentShapePreview.x * scale}
                  y1={currentShapePreview.y * scale}
                  x2={(currentShapePreview.x + currentShapePreview.w) * scale}
                  y2={(currentShapePreview.y + currentShapePreview.h) * scale}
                  stroke={currentColor}
                  strokeWidth={strokeWidth * scale}
                  strokeDasharray="4 4"
                />
                {activeTool === 'arrow' && (
                  <polygon
                    points={computeArrowHeadPolygon(
                      currentShapePreview.x * scale,
                      currentShapePreview.y * scale,
                      (currentShapePreview.x + currentShapePreview.w) * scale,
                      (currentShapePreview.y + currentShapePreview.h) * scale,
                      strokeWidth * scale
                    )}
                    fill={currentColor}
                  />
                )}
              </>
            )}
          </>
        )}
      </svg>

      {/* Eraser Cursor Ring positioned relative to page container */}
      {activeTool === 'erase' && eraserPos && (
        <div
          className="pointer-events-none absolute z-40 rounded-full border-2 border-rose-500 bg-rose-500/15 -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${eraserPos.x * scale}px`,
            top: `${eraserPos.y * scale}px`,
            width: `${Math.max(24, strokeWidth * 2.5 * scale)}px`,
            height: `${Math.max(24, strokeWidth * 2.5 * scale)}px`,
          }}
        />
      )}

      {/* HTML Elements Layer: Text Boxes, Rects, Circles, Images, Signatures, Stamps */}
      {pageAnnotations.map((ann) => {
        if ('points' in ann || ann.type === 'line' || ann.type === 'arrow') return null;

        const isSelected = ann.id === selectedId;
        const isEditingThis = editingTextId === ann.id;
        const displayH =
          isEditingThis && editingMeasuredH !== null ? editingMeasuredH : Math.abs(ann.height);
        const left = ann.x * scale;
        const top = ann.y * scale;
        const w = Math.abs(ann.width) * scale;
        const h = displayH * scale;
        const annRot = (((ann.rotation || 0) % 360) + 360) % 360;
        const isRotSwapped = annRot === 90 || annRot === 270;
        const innerW = isRotSwapped ? h : w;
        const innerH = isRotSwapped ? w : h;
        const rotatedContentStyle: React.CSSProperties | undefined =
          annRot !== 0
            ? {
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: `${innerW}px`,
                height: `${innerH}px`,
                transform: `translate(-50%, -50%) rotate(${annRot}deg)`,
                transformOrigin: 'center center',
              }
            : undefined;

        const resizeHandles: { key: ResizeHandle; cls: string; cursor: string }[] = [
          { key: 'nw', cls: '-top-1.5 -left-1.5', cursor: 'nwse-resize' },
          { key: 'ne', cls: '-top-1.5 -right-1.5', cursor: 'nesw-resize' },
          { key: 'sw', cls: '-bottom-1.5 -left-1.5', cursor: 'nesw-resize' },
          { key: 'se', cls: '-bottom-1.5 -right-1.5', cursor: 'nwse-resize' },
        ];

        const canClickToEditText = activeTool === 'text' && ann.type === 'text';

        return (
          <div
            key={ann.id}
            className={`absolute ${
              isEditingThis
                ? 'pointer-events-auto z-30'
                : activeTool === 'select'
                ? 'pointer-events-auto cursor-move'
                : canClickToEditText
                ? 'pointer-events-auto cursor-text'
                : activeTool === 'erase'
                ? 'pointer-events-auto cursor-none hover:ring-2 hover:ring-rose-500/80'
                : 'pointer-events-none'
            } ${
              isEditingThis
                ? ''
                : isSelected
                ? 'ring-2 ring-blue-500 shadow-sm'
                : activeTool === 'select' || canClickToEditText
                ? 'hover:ring-1 hover:ring-blue-400/60'
                : ''
            }`}
            style={{
              left: `${left}px`,
              top: `${top}px`,
              width: `${w}px`,
              height: `${h}px`,
              opacity: ann.opacity,
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (activeTool === 'erase') {
                onDeleteAnnotation(ann.id);
                return;
              }
              if (activeTool === 'select') {
                onSelect(ann.id);
              }
            }}
            onMouseDown={(e) => {
              if (activeTool === 'erase') {
                e.stopPropagation();
                onDeleteAnnotation(ann.id);
                return;
              }
              if (canClickToEditText) {
                e.stopPropagation();
                if (suppressTextSpawn || draftTextAnn || editingTextId) {
                  return;
                }
                openExistingTextEditor(ann);
                return;
              }
              if (activeTool === 'select' && !isEditingThis) {
                e.stopPropagation();
                onSelect(ann.id);
                const pt = getPdfCoordinates(e);
                setDragState({ id: ann.id, startPt: pt, originAnn: ann, draftAnn: ann });
              }
            }}
          >
            {ann.type === 'text' && (
              <div
                className={`${rotatedContentStyle ? '' : 'w-full h-full '}box-border ${
                  isEditingThis ? 'overflow-visible' : 'whitespace-pre-wrap break-words select-text overflow-hidden'
                }`}
                style={{
                  ...rotatedContentStyle,
                  ...(isEditingThis
                    ? {}
                    : {
                        padding: `${TEXT_PAD_TOP * scale}px ${TEXT_PAD_X * scale}px`,
                        lineHeight: TEXT_LINE_HEIGHT,
                        color: ann.color,
                        fontSize: `${ann.fontSize * scale}px`,
                        fontFamily: ann.fontFamily || fontFamily,
                        fontWeight: ann.bold ? 'bold' : 'normal',
                        fontStyle: ann.italic ? 'italic' : 'normal',
                        textAlign: ann.textAlign || 'left',
                        backgroundColor: ann.backgroundColor || 'transparent',
                        overflowWrap: 'break-word',
                        wordBreak: 'break-word',
                      }),
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  openExistingTextEditor(ann);
                }}
              >
                {isEditingThis ? (
                  <InlineTextEditorBox
                    editorId={ann.id}
                    value={editingTextVal}
                    color={ann.color}
                    fontSize={ann.fontSize}
                    fontFamily={ann.fontFamily || fontFamily}
                    bold={ann.bold}
                    italic={ann.italic}
                    textAlign={ann.textAlign || 'left'}
                    backgroundColor={ann.backgroundColor}
                    scale={scale}
                    placePillAbove={ann.y + displayH + 34 > height}
                    alignPillRight={ann.x > width * 0.62}
                    attachRef={(el) => attachTextareaRef(el, ann.id)}
                    onChangeText={(nextVal, el) => {
                      setEditingTextVal(nextVal);
                      setEditingScrollExtraH(0);
                      syncTextareaScrollHeight(el, ann.y, false);
                    }}
                    onCommit={commitActiveText}
                    onCancel={cancelActiveText}
                  />
                ) : (
                  ann.text
                )}
              </div>
            )}

            {ann.type === 'rect' && (
              <div
                className="w-full h-full"
                style={{
                  border: `${ann.strokeWidth * scale}px solid ${ann.color}`,
                  backgroundColor: ann.hasFill && ann.fillColor ? ann.fillColor : 'transparent',
                }}
              />
            )}

            {ann.type === 'circle' && (
              <div
                className="w-full h-full rounded-full"
                style={{
                  border: `${ann.strokeWidth * scale}px solid ${ann.color}`,
                  backgroundColor: ann.hasFill && ann.fillColor ? ann.fillColor : 'transparent',
                }}
              />
            )}

            {(ann.type === 'image' || ann.type === 'signature' || ann.type === 'stamp') && (
              <div
                className={rotatedContentStyle ? '' : 'w-full h-full'}
                style={rotatedContentStyle}
              >
                <img
                  src={(ann.assetId && assets[ann.assetId]) || ann.imageUrl}
                  alt={ann.type}
                  className="w-full h-full object-contain pointer-events-none select-none"
                />
              </div>
            )}

            {/* Working 4-corner resize handles */}
            {isSelected && activeTool === 'select' && editingTextId !== ann.id && (
              <>
                {resizeHandles.map((rh) => (
                  <div
                    key={rh.key}
                    className={`absolute ${rh.cls} w-3 h-3 bg-white border-2 border-blue-600 rounded-full shadow-sm z-20`}
                    style={{ cursor: rh.cursor }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const pt = getPdfCoordinates(e);
                      setResizeState({
                        id: ann.id,
                        handle: rh.key,
                        startPt: pt,
                        originAnn: ann,
                        draftAnn: ann,
                      });
                    }}
                  />
                ))}
              </>
            )}
          </div>
        );
      })}

      {/* Uncommitted New Text Box Draft */}
      {effectiveDraftAnn && (
        <div
          className="absolute pointer-events-auto z-40 overflow-visible"
          style={{
            left: `${effectiveDraftAnn.x * scale}px`,
            top: `${effectiveDraftAnn.y * scale}px`,
            width: `${effectiveDraftAnn.width * scale}px`,
            height: `${effectiveDraftAnn.height * scale}px`,
          }}
        >
          <InlineTextEditorBox
            editorId={effectiveDraftAnn.id}
            value={effectiveDraftAnn.text}
            color={effectiveDraftAnn.color}
            fontSize={effectiveDraftAnn.fontSize}
            fontFamily={effectiveDraftAnn.fontFamily}
            bold={effectiveDraftAnn.bold}
            italic={effectiveDraftAnn.italic}
            textAlign={effectiveDraftAnn.textAlign}
            backgroundColor={effectiveDraftAnn.backgroundColor}
            scale={scale}
            placePillAbove={effectiveDraftAnn.y + effectiveDraftAnn.height + 34 > height}
            alignPillRight={effectiveDraftAnn.x > width * 0.62}
            attachRef={(el) => attachTextareaRef(el, effectiveDraftAnn.id)}
            onChangeText={(nextVal, el) => {
              setDraftTextAnn((prev) =>
                prev ? { ...prev, text: nextVal, scrollExtraHeight: 0 } : prev
              );
              syncTextareaScrollHeight(el, effectiveDraftAnn.y, true);
            }}
            onCommit={commitActiveText}
            onCancel={cancelActiveText}
          />
        </div>
      )}
    </div>
  );
};
