import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Upload } from 'lucide-react';
import { pdfjsLib } from './utils/pdfWorker';
import { loadPdfDocument } from './lib/pdf/loader';
import { createSamplePdf } from './utils/samplePdf';
import { generateId } from './utils/id';
import { convertImagesToPdf } from './features/converter/imagesToPdf';
import { RibbonHeader } from './components/RibbonHeader';
import { FloatingToolDock } from './components/FloatingToolDock';
import { PropertiesBar } from './components/PropertiesBar';
import { StatusBar } from './components/StatusBar';
import { SearchBar } from './components/SearchBar';
import { ToastContainer } from './components/ToastContainer';
import { PasswordModal } from './components/PasswordModal';
import { PageThumbnailsSidebar } from './features/page-manager/PageThumbnailsSidebar';
import { PDFPageView } from './core/viewer/PDFPageView';
import { SignatureModal } from './features/editor/SignatureModal';
import { StampModal } from './features/editor/StampModal';
import { WatermarkModal } from './features/editor/WatermarkModal';
import { ExportModal } from './components/ExportModal';
import type {
  ToolType,
  Annotation,
  PageMetadata,
  WatermarkSettings,
  HistorySnapshot,
  SearchMatch,
  ToastMessage,
} from './types/pdf';

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

/** Rotate annotations 90 degrees clockwise around visual page (W, H) */
function rotateAnnotation90CW(ann: Annotation, pageW: number, pageH: number): Annotation {
  void pageW;
  if (ann.type === 'draw' || ann.type === 'highlight') {
    return {
      ...ann,
      width: pageH,
      height: pageW,
      points: ann.points.map((pt) => ({ x: pageH - pt.y, y: pt.x })),
    };
  }
  if (ann.type === 'line' || ann.type === 'arrow') {
    const startX = ann.x;
    const startY = ann.y;
    const endX = ann.x + ann.width;
    const endY = ann.y + ann.height;
    const newStartX = pageH - startY;
    const newStartY = startX;
    const newEndX = pageH - endY;
    const newEndY = endX;
    return {
      ...ann,
      x: newStartX,
      y: newStartY,
      width: newEndX - newStartX,
      height: newEndY - newStartY,
    };
  }
  const nextRotation =
    ann.type === 'text' || ann.type === 'image' || ann.type === 'signature' || ann.type === 'stamp'
      ? (((ann.rotation || 0) + 90) % 360 + 360) % 360
      : ann.rotation;

  return {
    ...ann,
    x: pageH - (ann.y + ann.height),
    y: ann.x,
    width: ann.height,
    height: ann.width,
    rotation: nextRotation,
  };
}

export function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem('web_pdf_studio_theme_v2') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('web_pdf_studio_theme_v2', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('Web_PDF_Studio_Sample.pdf');
  const [pages, setPages] = useState<PageMetadata[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.0);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [backendOnline, setBackendOnline] = useState<boolean>(false);

  // Editor Style Properties
  const [currentColor, setCurrentColor] = useState<string>('#dc2626');
  const [strokeWidth, setStrokeWidth] = useState<number>(2);
  const [fontSize, setFontSize] = useState<number>(16);
  const [fontFamily, setFontFamily] = useState<string>(
    'Noto Sans SC, "PingFang SC", "Microsoft YaHei", sans-serif'
  );
  const [isBold, setIsBold] = useState<boolean>(false);
  const [isItalic, setIsItalic] = useState<boolean>(false);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const [textBackgroundColor, setTextBackgroundColor] = useState<string>('transparent');
  const [hasFill, setHasFill] = useState<boolean>(false);
  const [currentFillColor, setCurrentFillColor] = useState<string>('#ef4444');

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);

  const [watermark, setWatermark] = useState<WatermarkSettings>({
    enabled: false,
    text: 'CONFIDENTIAL',
    color: '#94a3b8',
    opacity: 0.15,
    fontSize: 32,
    angle: 45,
    spacing: 160,
  });

  // Modals & Overlays
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState<boolean>(false);
  const [isStampModalOpen, setIsStampModalOpen] = useState<boolean>(false);
  const [isWatermarkModalOpen, setIsWatermarkModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportModalFormat, setExportModalFormat] = useState<'pdf' | 'docx' | 'images' | 'md'>(
    'pdf'
  );

  // Encrypted PDF unlock state
  const [pendingEncryptedFile, setPendingEncryptedFile] = useState<{
    bytes: Uint8Array;
    name: string;
    error?: string;
  } | null>(null);

  // Toast Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = useCallback(
    (type: ToastMessage['type'], title: string, description?: string) => {
      const id = generateId('toast');
      setToasts((prev) => [...prev.slice(-3), { id, type, title, description }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);

  // Workspace Pan & Drag-Drop state
  const workspaceRef = useRef<HTMLDivElement>(null);
  const globalOpenFileRef = useRef<HTMLInputElement>(null);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [spacePanSavedTool, setSpacePanSavedTool] = useState<ToolType | null>(null);
  const [panStart, setPanStart] = useState({
    x: 0,
    y: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragDepthRef = useRef(0);

  // Check backend health once on startup
  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setBackendOnline(data?.status === 'online');
      })
      .catch(() => setBackendOnline(false));
  }, []);

  const pushHistory = useCallback(
    (snapBytes: Uint8Array | null, snapPages: PageMetadata[], snapAnns: Annotation[]) => {
      setUndoStack((prev) => [
        ...prev.slice(-49),
        { pdfBytes: snapBytes, pages: snapPages, annotations: snapAnns },
      ]);
      setRedoStack([]);
    },
    []
  );

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, { pdfBytes, pages, annotations }]);
    setPdfBytes(previous.pdfBytes);
    setPages(previous.pages);
    setAnnotations(previous.annotations);
    setSelectedAnnotationId(null);
  }, [undoStack, pdfBytes, pages, annotations]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, { pdfBytes, pages, annotations }]);
    setPdfBytes(next.pdfBytes);
    setPages(next.pages);
    setAnnotations(next.annotations);
    setSelectedAnnotationId(null);
  }, [redoStack, pdfBytes, pages, annotations]);

  const buildPagesFromBytes = async (
    bytes: Uint8Array,
    password?: string
  ): Promise<{ workingBytes: Uint8Array; pageList: PageMetadata[]; decryptedNotice: boolean }> => {
    const { pdf: pdfDoc, pageCount } = await loadPdfDocument(bytes, password);
    let workingBytes = bytes;
    let decryptedNotice = false;

    // Ensure pdf-lib can load the bytes for editing/export; if encrypted, rebuild an unlocked copy via pdf.js
    try {
      await PDFDocument.load(bytes.slice());
    } catch {
      const rebuiltDoc = await PDFDocument.create();
      for (let i = 1; i <= pageCount; i++) {
        const page = await pdfDoc.getPage(i);
        const vp1 = page.getViewport({ scale: 1.0, rotation: page.rotate || 0 });
        const vp2 = page.getViewport({ scale: 2.0, rotation: page.rotate || 0 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(vp2.width);
        canvas.height = Math.round(vp2.height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport: vp2, canvas }).promise;
          const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
          if (blob) {
            const embedded = await rebuiltDoc.embedPng(new Uint8Array(await blob.arrayBuffer()));
            const newPage = rebuiltDoc.addPage([vp1.width, vp1.height]);
            newPage.drawImage(embedded, { x: 0, y: 0, width: vp1.width, height: vp1.height });
          }
        }
      }
      workingBytes = await rebuiltDoc.save();
      decryptedNotice = true;
    }

    const { pdf: finalDoc, pageCount: finalCount } = await loadPdfDocument(workingBytes);
    const pageMetaList: PageMetadata[] = [];
    for (let i = 1; i <= finalCount; i++) {
      const page = await finalDoc.getPage(i);
      const intrinsicRotation = page.rotate || 0;
      const viewport = page.getViewport({ scale: 1.0, rotation: intrinsicRotation });
      pageMetaList.push({
        id: generateId('pg'),
        pageNumber: i,
        originalPageIndex: i - 1,
        originalRotation: intrinsicRotation,
        extraRotation: 0,
        rotation: intrinsicRotation,
        width: viewport.width,
        height: viewport.height,
      });
    }
    return { workingBytes, pageList: pageMetaList, decryptedNotice };
  };

  const loadSampleDocument = useCallback(async () => {
    try {
      const bytes = await createSamplePdf();
      const { workingBytes, pageList } = await buildPagesFromBytes(bytes);
      setPdfBytes(workingBytes);
      setFileName('Web_PDF_Studio_Sample.pdf');
      setPages(pageList);
      setCurrentPage(1);
      setAnnotations([]);
      setSelectedAnnotationId(null);
      setUndoStack([]);
      setRedoStack([]);
    } catch (err) {
      console.error('Failed to load sample document:', err);
      addToast('error', '示例文档加载失败', String(err));
    }
  }, [addToast]);

  useEffect(() => {
    let cancelled = false;
    createSamplePdf()
      .then((bytes) => buildPagesFromBytes(bytes))
      .then(({ workingBytes, pageList }) => {
        if (cancelled) return;
        setPdfBytes(workingBytes);
        setFileName('Web_PDF_Studio_Sample.pdf');
        setPages(pageList);
        setCurrentPage(1);
        setAnnotations([]);
        setSelectedAnnotationId(null);
        setUndoStack([]);
        setRedoStack([]);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load sample document:', err);
          addToast('error', '示例文档加载失败', String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  const loadPdfFromBytes = async (bytes: Uint8Array, name: string, password?: string) => {
    try {
      const { workingBytes, pageList, decryptedNotice } = await buildPagesFromBytes(bytes, password);
      setPendingEncryptedFile(null);
      setPdfBytes(workingBytes);
      setFileName(name);
      setPages(pageList);
      setCurrentPage(1);
      setAnnotations([]);
      setSelectedAnnotationId(null);
      setUndoStack([]);
      setRedoStack([]);
      setSearchQuery('');
      setSearchMatches([]);
      if (decryptedNotice) {
        addToast('info', '已解锁加密 PDF', '已自动转为可编辑与导出的本地副本');
      } else {
        addToast('success', '已打开文档', `${name}（共 ${pageList.length} 页）`);
      }
    } catch (err: unknown) {
      const errName = (err as { name?: string })?.name;
      if (errName === 'PasswordException') {
        const code = (err as { code?: number })?.code;
        setPendingEncryptedFile({
          bytes,
          name,
          error: code === 2 ? '密码错误，请重新输入' : undefined,
        });
        return;
      }
      addToast('error', '无法打开 PDF 文件', (err as Error)?.message || '文件可能已损坏或格式不受支持');
    }
  };

  const handleOpenFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (buffer) {
        await loadPdfFromBytes(new Uint8Array(buffer), file.name);
      }
    };
    reader.onerror = () => addToast('error', '读取文件失败', file.name);
    reader.readAsArrayBuffer(file);
  };

  const handleOpenImagesToPdf = async (files: FileList | File[]) => {
    try {
      const fileArray = Array.from(files);
      const bytes = await convertImagesToPdf(fileArray);
      const { workingBytes, pageList } = await buildPagesFromBytes(bytes);
      setPdfBytes(workingBytes);
      setFileName(`images_${fileArray.length}p.pdf`);
      setPages(pageList);
      setCurrentPage(1);
      setAnnotations([]);
      setSelectedAnnotationId(null);
      setUndoStack([]);
      setRedoStack([]);
      addToast('success', '图片已转换为 PDF', `共生成 ${pageList.length} 页`);
    } catch (err) {
      addToast('error', '图片转 PDF 失败', (err as Error)?.message || String(err));
    }
  };

  const handleMergePdfFile = async (file: File) => {
    if (!pdfBytes) {
      handleOpenFile(file);
      return;
    }
    try {
      const incomingBytes = new Uint8Array(await file.arrayBuffer());
      const baseDoc = await PDFDocument.load(pdfBytes.slice());
      const incomingDoc = await PDFDocument.load(incomingBytes.slice());
      const baseRawCount = baseDoc.getPageCount();
      const incomingIndices = incomingDoc.getPageIndices();
      const copiedPages = await baseDoc.copyPages(incomingDoc, incomingIndices);
      copiedPages.forEach((p) => baseDoc.addPage(p));
      const mergedBytes = await baseDoc.save();

      const { pdf: mergedJsDoc } = await loadPdfDocument(mergedBytes);
      const appendedMetas: PageMetadata[] = [];
      for (let i = 0; i < incomingIndices.length; i++) {
        const rawIdx = baseRawCount + i;
        const page = await mergedJsDoc.getPage(rawIdx + 1);
        const intrinsicRotation = page.rotate || 0;
        const vp = page.getViewport({ scale: 1.0, rotation: intrinsicRotation });
        appendedMetas.push({
          id: generateId('pg'),
          pageNumber: pages.length + i + 1,
          originalPageIndex: rawIdx,
          originalRotation: intrinsicRotation,
          extraRotation: 0,
          rotation: intrinsicRotation,
          width: vp.width,
          height: vp.height,
        });
      }

      pushHistory(pdfBytes, pages, annotations);
      setPdfBytes(mergedBytes);
      setPages((prev) => [...prev, ...appendedMetas]);
      addToast('success', '已合并 PDF 页面', `追加了 ${appendedMetas.length} 页（来自 ${file.name}）`);
    } catch (err) {
      addToast('error', '合并 PDF 失败', (err as Error)?.message || '请确认目标 PDF 未被密码锁定');
    }
  };

  // Page Operations with synchronized annotation mapping
  const handleRotatePage = (pageNum: number) => {
    const target = pages[pageNum - 1];
    if (!target) return;
    pushHistory(pdfBytes, pages, annotations);

    const oldW = target.width;
    const oldH = target.height;

    setPages((prev) =>
      prev.map((p, idx) => {
        if (idx + 1 !== pageNum) return p;
        const nextExtra = (p.extraRotation + 90) % 360;
        const effective = ((p.originalRotation + nextExtra) % 360 + 360) % 360;
        return {
          ...p,
          extraRotation: nextExtra,
          rotation: effective,
          width: p.height,
          height: p.width,
        };
      })
    );

    setAnnotations((prev) =>
      prev.map((a) => (a.pageNumber === pageNum ? rotateAnnotation90CW(a, oldW, oldH) : a))
    );
  };

  const handleRotateAllPages = () => {
    if (pages.length === 0) return;
    pushHistory(pdfBytes, pages, annotations);
    const oldSizeByPage = new Map<number, { w: number; h: number }>();
    pages.forEach((p, idx) => oldSizeByPage.set(idx + 1, { w: p.width, h: p.height }));

    setPages((prev) =>
      prev.map((p) => {
        const nextExtra = (p.extraRotation + 90) % 360;
        const effective = ((p.originalRotation + nextExtra) % 360 + 360) % 360;
        return {
          ...p,
          extraRotation: nextExtra,
          rotation: effective,
          width: p.height,
          height: p.width,
        };
      })
    );

    setAnnotations((prev) =>
      prev.map((a) => {
        const dims = oldSizeByPage.get(a.pageNumber);
        return dims ? rotateAnnotation90CW(a, dims.w, dims.h) : a;
      })
    );
  };

  const handleDeletePage = (pageNum: number) => {
    if (pages.length <= 1) return;
    pushHistory(pdfBytes, pages, annotations);

    setPages((prev) =>
      prev
        .filter((_, idx) => idx + 1 !== pageNum)
        .map((p, idx) => ({ ...p, pageNumber: idx + 1 }))
    );

    setAnnotations((prev) =>
      prev
        .filter((a) => a.pageNumber !== pageNum)
        .map((a) => (a.pageNumber > pageNum ? { ...a, pageNumber: a.pageNumber - 1 } : a))
    );
    setSelectedAnnotationId(null);
    setCurrentPage((prev) => Math.max(1, Math.min(prev, pages.length - 1)));
  };

  const handleDuplicatePage = (pageNum: number) => {
    const target = pages[pageNum - 1];
    if (!target) return;
    pushHistory(pdfBytes, pages, annotations);

    const newPages = [...pages];
    newPages.splice(pageNum, 0, { ...target, id: generateId('pg') });
    setPages(newPages.map((p, idx) => ({ ...p, pageNumber: idx + 1 })));

    setAnnotations((prev) => {
      const shifted = prev.map((a) =>
        a.pageNumber > pageNum ? { ...a, pageNumber: a.pageNumber + 1 } : a
      );
      const cloned = prev
        .filter((a) => a.pageNumber === pageNum)
        .map((a) => ({
          ...a,
          id: generateId('dup'),
          pageNumber: pageNum + 1,
        }));
      return [...shifted, ...cloned];
    });
  };

  const handleInsertBlankPage = (afterPageNum: number) => {
    pushHistory(pdfBytes, pages, annotations);
    const blankPage: PageMetadata = {
      id: generateId('blank'),
      pageNumber: afterPageNum + 1,
      originalPageIndex: -1,
      originalRotation: 0,
      extraRotation: 0,
      rotation: 0,
      width: 595.28,
      height: 841.89,
      isBlank: true,
    };
    const nextPages = [...pages];
    nextPages.splice(afterPageNum, 0, blankPage);
    setPages(nextPages.map((p, idx) => ({ ...p, pageNumber: idx + 1 })));

    setAnnotations((prev) =>
      prev.map((a) => (a.pageNumber > afterPageNum ? { ...a, pageNumber: a.pageNumber + 1 } : a))
    );
    setCurrentPage(afterPageNum + 1);
  };

  const handleReorderPages = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    pushHistory(pdfBytes, pages, annotations);

    const nextPages = [...pages];
    const [moved] = nextPages.splice(fromIdx, 1);
    nextPages.splice(toIdx, 0, moved);

    const oldToNewPageNum = new Map<number, number>();
    pages.forEach((oldPage, oldIdx) => {
      const newIdx = nextPages.findIndex((p) => p.id === oldPage.id);
      if (newIdx >= 0) {
        oldToNewPageNum.set(oldIdx + 1, newIdx + 1);
      }
    });

    setPages(nextPages.map((p, idx) => ({ ...p, pageNumber: idx + 1 })));
    setAnnotations((prev) =>
      prev.map((a) => ({
        ...a,
        pageNumber: oldToNewPageNum.get(a.pageNumber) ?? a.pageNumber,
      }))
    );
    setCurrentPage(toIdx + 1);
  };

  // Annotations
  const handleAddAnnotation = (ann: Annotation) => {
    pushHistory(pdfBytes, pages, annotations);
    setAnnotations((prev) => [...prev, ann]);
  };

  const handleUpdateAnnotation = (updated: Annotation) => {
    pushHistory(pdfBytes, pages, annotations);
    setAnnotations((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const handleDeleteAnnotation = useCallback(
    (id: string) => {
      pushHistory(pdfBytes, pages, annotations);
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
      setSelectedAnnotationId((curr) => (curr === id ? null : curr));
    },
    [pushHistory, pdfBytes, pages, annotations]
  );

  const handleClearAllAnnotations = () => {
    if (annotations.length === 0) return;
    pushHistory(pdfBytes, pages, annotations);
    setAnnotations([]);
    setSelectedAnnotationId(null);
    addToast('info', '已清空全部批注');
  };

  const insertImageAssetAnnotation = (
    dataUrl: string,
    aspectRatio: number,
    kind: 'signature' | 'stamp' | 'image'
  ) => {
    const assetId = generateId(kind);
    setAssets((prev) => ({ ...prev, [assetId]: dataUrl }));

    const targetMeta = pages[currentPage - 1];
    const pageW = targetMeta?.width || 595.28;
    const pageH = targetMeta?.height || 841.89;
    const baseW = kind === 'stamp' ? 150 : 180;
    const width = Math.min(baseW, pageW * 0.6);
    const height = Math.max(24, width / Math.max(0.2, aspectRatio));

    const newAnn: Annotation = {
      id: generateId(kind),
      pageNumber: currentPage,
      type: kind,
      assetId,
      x: Math.max(20, (pageW - width) / 2),
      y: Math.max(20, (pageH - height) / 3),
      width,
      height,
      color: '#000000',
      opacity: 1,
      aspectRatio,
    };
    handleAddAnnotation(newAnn);
    setSelectedAnnotationId(newAnn.id);
    setActiveTool('select');
  };

  // Page Navigation & Fit Zoom
  const handleSelectPage = useCallback((pageNum: number) => {
    setCurrentPage(pageNum);
    const targetElement = document.getElementById(`pdf-page-${pageNum}`);
    if (targetElement && workspaceRef.current) {
      const container = workspaceRef.current;
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      const scrollOffset = targetRect.top - containerRect.top + container.scrollTop - 20;
      container.scrollTo({ top: Math.max(0, scrollOffset), behavior: 'smooth' });
    }
  }, []);

  const handleFitWidth = () => {
    const ws = workspaceRef.current;
    const targetMeta = pages[currentPage - 1] || pages[0];
    if (!ws || !targetMeta) return;
    const nextZoom = Math.max(0.4, Math.min(3.0, (ws.clientWidth - 72) / targetMeta.width));
    setZoom(Number(nextZoom.toFixed(2)));
  };

  const handleFitPage = () => {
    const ws = workspaceRef.current;
    const targetMeta = pages[currentPage - 1] || pages[0];
    if (!ws || !targetMeta) return;
    const zw = (ws.clientWidth - 72) / targetMeta.width;
    const zh = (ws.clientHeight - 64) / targetMeta.height;
    const nextZoom = Math.max(0.4, Math.min(3.0, Math.min(zw, zh)));
    setZoom(Number(nextZoom.toFixed(2)));
  };

  const handleScrollWorkspace = () => {
    const container = workspaceRef.current;
    if (!container || pages.length === 0) return;
    const containerRect = container.getBoundingClientRect();

    let bestPage = currentPage;
    let bestVisibleHeight = -1;

    for (let i = 1; i <= pages.length; i++) {
      const el = document.getElementById(`pdf-page-${i}`);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const visibleTop = Math.max(rect.top, containerRect.top);
      const visibleBot = Math.min(rect.bottom, containerRect.bottom);
      const visibleH = Math.max(0, visibleBot - visibleTop);
      if (visibleH > bestVisibleHeight) {
        bestVisibleHeight = visibleH;
        bestPage = i;
      }
    }

    if (bestVisibleHeight > 0 && bestPage !== currentPage) {
      setCurrentPage(bestPage);
    }
  };

  // Document Search Execution
  const effectiveSearchMatches =
    !isSearchOpen || !searchQuery.trim() ? [] : searchMatches;

  useEffect(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!isSearchOpen || !trimmed || !pdfBytes || pages.length === 0) {
      return;
    }

    let cancelled = false;
    const runSearch = async () => {
      try {
        const { pdf: pdfDoc } = await loadPdfDocument(pdfBytes);
        const found: SearchMatch[] = [];

        for (let i = 0; i < pages.length; i++) {
          if (cancelled) return;
          const pMeta = pages[i];
          const displayNum = i + 1;
          if (!pMeta.isBlank && pMeta.originalPageIndex >= 0) {
            const page = await pdfDoc.getPage(pMeta.originalPageIndex + 1);
            const intrinsic = pMeta.originalRotation || page.rotate || 0;
            const effective = ((intrinsic + (pMeta.extraRotation || 0)) % 360 + 360) % 360;
            const viewport = page.getViewport({ scale: 1.0, rotation: effective });
            const content = await page.getTextContent();

            let matchCounter = 0;
            for (const item of content.items) {
              if ('str' in item && item.str.toLowerCase().includes(trimmed)) {
                const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                const fs = Math.max(8, Math.round(Math.hypot(tx[0], tx[1])));
                found.push({
                  id: `m_${displayNum}_${matchCounter++}`,
                  pageNumber: displayNum,
                  x: Math.max(0, tx[4]),
                  y: Math.max(0, tx[5] - fs * 0.9),
                  width: Math.max(14, item.width || item.str.length * fs * 0.55),
                  height: fs * 1.25,
                  snippet: item.str,
                });
              }
            }
          }
        }

        if (!cancelled) {
          setSearchMatches(found);
          setActiveMatchIdx(0);
          if (found.length > 0) {
            handleSelectPage(found[0].pageNumber);
          }
        }
      } catch (err) {
        console.warn('Search failed:', err);
      }
    };

    const timer = window.setTimeout(runSearch, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery, isSearchOpen, pdfBytes, pages, handleSelectPage]);

  const jumpToSearchMatch = (nextIdx: number) => {
    if (effectiveSearchMatches.length === 0) return;
    const wrapped = (nextIdx + effectiveSearchMatches.length) % effectiveSearchMatches.length;
    setActiveMatchIdx(wrapped);
    handleSelectPage(effectiveSearchMatches[wrapped].pageNumber);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        globalOpenFileRef.current?.click();
        return;
      }
      if (isCtrl && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
        return;
      }
      if (isCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (pdfBytes) {
          setExportModalFormat('pdf');
          setIsExportModalOpen(true);
        }
        return;
      }

      if (isEditableElement(e.target)) return;

      if (isCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if (isCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (isCtrl && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setZoom((z) => Math.min(3.0, Number((z + 0.15).toFixed(2))));
        return;
      }
      if (isCtrl && e.key === '-') {
        e.preventDefault();
        setZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))));
        return;
      }
      if (isCtrl && e.key === '0') {
        e.preventDefault();
        setZoom(1.0);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedAnnotationId) {
          e.preventDefault();
          handleDeleteAnnotation(selectedAnnotationId);
        }
        return;
      }

      if (e.key === 'Escape') {
        if (isSearchOpen) setIsSearchOpen(false);
        else if (selectedAnnotationId) setSelectedAnnotationId(null);
        else setActiveTool('select');
        return;
      }

      if (e.code === 'Space' && !e.repeat && activeTool !== 'hand') {
        e.preventDefault();
        setSpacePanSavedTool(activeTool);
        setActiveTool('hand');
        return;
      }

      if (!isCtrl && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'v') setActiveTool('select');
        else if (k === 'h') setActiveTool('hand');
        else if (k === 't') setActiveTool('text');
        else if (k === 'p') setActiveTool('draw');
        else if (k === 'e') setActiveTool('erase');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && spacePanSavedTool) {
        setActiveTool(spacePanSavedTool);
        setSpacePanSavedTool(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    handleUndo,
    handleRedo,
    handleDeleteAnnotation,
    selectedAnnotationId,
    isSearchOpen,
    pdfBytes,
    activeTool,
    spacePanSavedTool,
  ]);

  // Ctrl + Wheel Zoom in Workspace
  const handleWheelWorkspace = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.12 : -0.12;
      setZoom((z) => Math.max(0.4, Math.min(3.0, Number((z + delta).toFixed(2)))));
    }
  };

  // Pan Handlers
  const handleMouseDownWorkspace = (e: React.MouseEvent) => {
    if (activeTool !== 'hand' || !workspaceRef.current) return;
    setIsPanning(true);
    setPanStart({
      x: e.clientX,
      y: e.clientY,
      scrollLeft: workspaceRef.current.scrollLeft,
      scrollTop: workspaceRef.current.scrollTop,
    });
  };

  const handleMouseMoveWorkspace = (e: React.MouseEvent) => {
    if (!isPanning || activeTool !== 'hand' || !workspaceRef.current) return;
    workspaceRef.current.scrollLeft = panStart.scrollLeft - (e.clientX - panStart.x);
    workspaceRef.current.scrollTop = panStart.scrollTop - (e.clientY - panStart.y);
  };

  const handleMouseUpWorkspace = () => {
    setIsPanning(false);
  };

  // Drag & Drop File Support
  const handleDragEnterRoot = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFile(true);
  };

  const handleDragOverRoot = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
  };

  const handleDragLeaveRoot = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDraggingFile(false);
    }
  };

  const handleDropRoot = async (e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFile(false);

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    const pdfFile = files.find(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (pdfFile) {
      handleOpenFile(pdfFile);
      return;
    }

    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      await handleOpenImagesToPdf(imageFiles);
      return;
    }

    addToast('warning', '不支持的文件类型', '请拖入 PDF 文档或常见图片文件 (PNG/JPG/WebP)');
  };

  const selectedAnnotation = annotations.find((a) => a.id === selectedAnnotationId) || null;
  const activeMatchId = effectiveSearchMatches[activeMatchIdx]?.id || null;

  return (
    <div
      className="flex flex-col h-screen w-screen bg-[var(--bg-mat)] text-[var(--text-primary)] overflow-hidden relative"
      onDragEnter={handleDragEnterRoot}
      onDragOver={handleDragOverRoot}
      onDragLeave={handleDragLeaveRoot}
      onDrop={handleDropRoot}
    >
      <RibbonHeader
        fileName={fileName}
        pageCount={pages.length}
        hasUnsavedEdits={annotations.length > 0 || undoStack.length > 0}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onOpenFile={handleOpenFile}
        onMergePdfFile={handleMergePdfFile}
        onOpenImagesToPdf={handleOpenImagesToPdf}
        onOpenExportModal={() => {
          if (!pdfBytes) {
            addToast('warning', '尚未打开文档', '请先打开或拖入一个 PDF 文件');
            return;
          }
          setExportModalFormat('pdf');
          setIsExportModalOpen(true);
        }}
        onOpenConvertDocx={() => {
          if (!pdfBytes) {
            addToast('warning', '尚未打开文档', '请先打开 PDF 文件');
            return;
          }
          setExportModalFormat('docx');
          setIsExportModalOpen(true);
        }}
        onToggleSearch={() => setIsSearchOpen((prev) => !prev)}
        onRotateAllPages={handleRotateAllPages}
        onLoadSample={loadSampleDocument}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />

      <PropertiesBar
        activeTool={activeTool}
        selectedAnnotation={selectedAnnotation}
        annotationCount={annotations.length}
        currentColor={currentColor}
        onChangeColor={(col) => {
          setCurrentColor(col);
          if (selectedAnnotation) {
            handleUpdateAnnotation({ ...selectedAnnotation, color: col });
          }
        }}
        strokeWidth={strokeWidth}
        onChangeStrokeWidth={(w) => {
          setStrokeWidth(w);
          if (selectedAnnotation && 'strokeWidth' in selectedAnnotation) {
            handleUpdateAnnotation({ ...selectedAnnotation, strokeWidth: w });
          }
        }}
        fontSize={fontSize}
        onChangeFontSize={(sz) => {
          setFontSize(sz);
          if (selectedAnnotation && selectedAnnotation.type === 'text') {
            handleUpdateAnnotation({ ...selectedAnnotation, fontSize: sz });
          }
        }}
        fontFamily={fontFamily}
        onChangeFontFamily={(font) => {
          setFontFamily(font);
          if (selectedAnnotation && selectedAnnotation.type === 'text') {
            handleUpdateAnnotation({ ...selectedAnnotation, fontFamily: font });
          }
        }}
        bold={isBold}
        onToggleBold={(b) => {
          setIsBold(b);
          if (selectedAnnotation && selectedAnnotation.type === 'text') {
            handleUpdateAnnotation({ ...selectedAnnotation, bold: b });
          }
        }}
        italic={isItalic}
        onToggleItalic={(it) => {
          setIsItalic(it);
          if (selectedAnnotation && selectedAnnotation.type === 'text') {
            handleUpdateAnnotation({ ...selectedAnnotation, italic: it });
          }
        }}
        textAlign={textAlign}
        onChangeTextAlign={(al) => {
          setTextAlign(al);
          if (selectedAnnotation && selectedAnnotation.type === 'text') {
            handleUpdateAnnotation({ ...selectedAnnotation, textAlign: al });
          }
        }}
        hasFill={hasFill}
        onToggleFill={(fill) => {
          setHasFill(fill);
          if (selectedAnnotation && 'hasFill' in selectedAnnotation) {
            handleUpdateAnnotation({
              ...selectedAnnotation,
              hasFill: fill,
              fillColor: fill ? currentFillColor : undefined,
            });
          }
        }}
        fillColor={currentFillColor}
        onChangeFillColor={(fc) => {
          setCurrentFillColor(fc);
          if (selectedAnnotation && 'fillColor' in selectedAnnotation) {
            handleUpdateAnnotation({ ...selectedAnnotation, fillColor: fc });
          }
        }}
        textBackgroundColor={textBackgroundColor}
        onChangeTextBackground={(bgColor) => {
          setTextBackgroundColor(bgColor);
          if (selectedAnnotation && selectedAnnotation.type === 'text') {
            handleUpdateAnnotation({ ...selectedAnnotation, backgroundColor: bgColor });
          }
        }}
        onDeleteSelected={() => {
          if (selectedAnnotationId) handleDeleteAnnotation(selectedAnnotationId);
        }}
        onClearAllAnnotations={handleClearAllAnnotations}
      />

      <div className="flex flex-1 overflow-hidden relative">
        <PageThumbnailsSidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((prev) => !prev)}
          pdfBytes={pdfBytes}
          pages={pages}
          currentPage={currentPage}
          onSelectPage={handleSelectPage}
          onRotatePage={handleRotatePage}
          onDeletePage={handleDeletePage}
          onDuplicatePage={handleDuplicatePage}
          onInsertBlankPage={handleInsertBlankPage}
          onMergePdfFile={handleMergePdfFile}
          onReorderPages={handleReorderPages}
        />

        {/* Central Drafting Mat & Document Canvas + Floating Tool Dock */}
        <div className="flex-1 h-full relative flex flex-col overflow-hidden">
          <main
            ref={workspaceRef}
            className={`flex-1 h-full overflow-auto studio-mat pt-7 px-7 pb-24 flex flex-col items-center ${
              activeTool === 'hand' ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
            onMouseDown={handleMouseDownWorkspace}
            onMouseMove={handleMouseMoveWorkspace}
            onMouseUp={handleMouseUpWorkspace}
            onMouseLeave={handleMouseUpWorkspace}
            onScroll={handleScrollWorkspace}
            onWheel={handleWheelWorkspace}
          >
            {pdfBytes && pages.length > 0 ? (
              pages.map((p, idx) => (
                <PDFPageView
                  key={p.id}
                  pdfBytes={pdfBytes}
                  pageMeta={p}
                  displayPageNumber={idx + 1}
                  isSelected={currentPage === idx + 1}
                  scale={zoom}
                  activeTool={activeTool}
                  annotations={annotations}
                  selectedAnnotationId={selectedAnnotationId}
                  onSelectAnnotation={setSelectedAnnotationId}
                  onAddAnnotation={handleAddAnnotation}
                  onUpdateAnnotation={handleUpdateAnnotation}
                  onDeleteAnnotation={handleDeleteAnnotation}
                  currentColor={currentColor}
                  strokeWidth={strokeWidth}
                  fontSize={fontSize}
                  fontFamily={fontFamily}
                  bold={isBold}
                  italic={isItalic}
                  textAlign={textAlign}
                  textBackgroundColor={textBackgroundColor}
                  onFinishTextCreation={() => setActiveTool('select')}
                  currentFillColor={currentFillColor}
                  hasFill={hasFill}
                  watermark={watermark}
                  assets={assets}
                  searchMatches={effectiveSearchMatches.filter((m) => m.pageNumber === idx + 1)}
                  activeMatchId={activeMatchId}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] text-xs gap-2">
                <Upload className="w-8 h-8 opacity-40" />
                <span>拖入 PDF 或图片文件到此窗口，或点击上方「打开 PDF」</span>
              </div>
            )}
          </main>

          <FloatingToolDock
            activeTool={activeTool}
            onSelectTool={(tool) => {
              setActiveTool(tool);
              if (tool !== 'select') setSelectedAnnotationId(null);
            }}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onOpenSignature={() => setIsSignatureModalOpen(true)}
            onOpenStamp={() => setIsStampModalOpen(true)}
            onOpenWatermark={() => setIsWatermarkModalOpen(true)}
            watermarkEnabled={watermark.enabled}
          />
        </div>
      </div>

      <StatusBar
        currentPage={currentPage}
        totalPages={pages.length}
        onJumpToPage={handleSelectPage}
        zoom={zoom}
        onZoomChange={setZoom}
        onFitWidth={handleFitWidth}
        onFitPage={handleFitPage}
        backendOnline={backendOnline}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        annotationCount={annotations.length}
      />

      <SearchBar
        isOpen={isSearchOpen}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        matchCount={effectiveSearchMatches.length}
        activeMatchIndex={activeMatchIdx}
        onPrevMatch={() => jumpToSearchMatch(activeMatchIdx - 1)}
        onNextMatch={() => jumpToSearchMatch(activeMatchIdx + 1)}
        onClose={() => setIsSearchOpen(false)}
      />

      <input
        ref={globalOpenFileRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleOpenFile(file);
          e.target.value = '';
        }}
      />

      {/* Drag & Drop Full-Window Overlay */}
      {isDraggingFile && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center pointer-events-none">
          <div className="px-8 py-6 rounded-2xl bg-[var(--bg-chrome)] border-2 border-dashed border-[var(--accent)] text-center shadow-2xl">
            <Upload className="w-9 h-9 text-[var(--accent)] mx-auto mb-2" />
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              释放鼠标立即加载文件
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">
              支持 PDF 文档或多张图片自动合并转换
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {isSignatureModalOpen && (
        <SignatureModal
          isOpen={isSignatureModalOpen}
          onClose={() => setIsSignatureModalOpen(false)}
          onSaveSignature={({ dataUrl, aspectRatio }) =>
            insertImageAssetAnnotation(dataUrl, aspectRatio, 'signature')
          }
        />
      )}

      {isStampModalOpen && (
        <StampModal
          isOpen={isStampModalOpen}
          onClose={() => setIsStampModalOpen(false)}
          onInsertStamp={({ dataUrl, aspectRatio, kind }) =>
            insertImageAssetAnnotation(dataUrl, aspectRatio, kind)
          }
        />
      )}

      {isWatermarkModalOpen && (
        <WatermarkModal
          isOpen={isWatermarkModalOpen}
          onClose={() => setIsWatermarkModalOpen(false)}
          watermark={watermark}
          onChange={setWatermark}
        />
      )}

      {isExportModalOpen && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          pdfBytes={pdfBytes}
          pages={pages}
          currentPage={currentPage}
          annotations={annotations}
          watermark={watermark}
          originalFileName={fileName}
          defaultFormat={exportModalFormat}
          assets={assets}
          backendOnline={backendOnline}
          onNotify={addToast}
        />
      )}

      {pendingEncryptedFile && (
        <PasswordModal
          isOpen={Boolean(pendingEncryptedFile)}
          fileName={pendingEncryptedFile.name}
          errorMsg={pendingEncryptedFile.error}
          onSubmit={(pwd) => {
            loadPdfFromBytes(pendingEncryptedFile.bytes, pendingEncryptedFile.name, pwd);
          }}
          onCancel={() => setPendingEncryptedFile(null)}
        />
      )}

      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}

export default App;
