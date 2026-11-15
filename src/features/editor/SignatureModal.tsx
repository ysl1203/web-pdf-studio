import React, { useRef, useState, useEffect } from 'react';
import { X, Check, RotateCcw, PenTool, Type, Upload } from 'lucide-react';

interface SignatureResult {
  dataUrl: string;
  aspectRatio: number;
}

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSignature: (result: SignatureResult) => void;
}

function trimTransparentBounds(
  sourceCanvas: HTMLCanvasElement,
  padding = 12
): SignatureResult | null {
  const ctx = sourceCanvas.getContext('2d');
  if (!ctx) return null;
  const { width, height } = sourceCanvas;
  const imgData = ctx.getImageData(0, 0, width, height).data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = imgData[(y * width + x) * 4 + 3];
      if (alpha > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return null; // Empty canvas
  }

  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropW = Math.min(width - cropX, maxX - minX + 1 + padding * 2);
  const cropH = Math.min(height - cropY, maxY - minY + 1 + padding * 2);

  const out = document.createElement('canvas');
  out.width = cropW;
  out.height = cropH;
  const outCtx = out.getContext('2d');
  if (!outCtx) return null;
  outCtx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  return {
    dataUrl: out.toDataURL('image/png'),
    aspectRatio: cropW / Math.max(1, cropH),
  };
}

const TYPED_FONT_OPTIONS = [
  { label: '手写体', value: '"Brush Script MT", "Segoe Script", KaiTi, STKaiti, cursive' },
  { label: '楷书', value: 'KaiTi, "Kaiti SC", STKaiti, Georgia, serif' },
  { label: '宋体', value: '"Songti SC", SimSun, "Times New Roman", serif' },
  { label: '黑体', value: '"Microsoft YaHei", "PingFang SC", sans-serif' },
];

export const SignatureModal: React.FC<SignatureModalProps> = ({
  isOpen,
  onClose,
  onSaveSignature,
}) => {
  const [tab, setTab] = useState<'draw' | 'type' | 'upload'>('draw');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnInk, setHasDrawnInk] = useState(false);
  const [penColor, setPenColor] = useState('#0f172a');
  const [penSize, setPenSize] = useState(3);
  const [typedName, setTypedName] = useState('');
  const [selectedFont, setSelectedFont] = useState(TYPED_FONT_OPTIONS[0].value);
  const [uploadedPreview, setUploadedPreview] = useState<SignatureResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || tab !== 'draw' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const logicalW = 460;
    const logicalH = 180;
    canvas.width = logicalW * dpr;
    canvas.height = logicalH * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, logicalW, logicalH);
    }
  }, [isOpen, tab]);

  if (!isOpen) return null;

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = 460 / Math.max(1, rect.width);
    const scaleY = 180 / Math.max(1, rect.height);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pt = getCanvasPoint(e);

    setIsDrawing(true);
    setHasDrawnInk(true);
    setErrorMsg(null);
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pt = getCanvasPoint(e);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    setHasDrawnInk(false);
    setErrorMsg(null);
  };

  const handleConfirm = () => {
    setErrorMsg(null);

    if (tab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawnInk) {
        setErrorMsg('请在白色签字板上书写您的签名');
        return;
      }
      const trimmed = trimTransparentBounds(canvas, 14);
      if (!trimmed) {
        setErrorMsg('未检测到有效笔迹，请重新绘制');
        return;
      }
      onSaveSignature(trimmed);
      onClose();
      return;
    }

    if (tab === 'type') {
      if (!typedName.trim()) {
        setErrorMsg('请输入签名文字');
        return;
      }
      const offscreen = document.createElement('canvas');
      offscreen.width = 900;
      offscreen.height = 240;
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.fillStyle = penColor;
        ctx.font = `italic 84px ${selectedFont}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(typedName.trim(), 450, 120, 840);
        const trimmed = trimTransparentBounds(offscreen, 16);
        if (trimmed) {
          onSaveSignature(trimmed);
          onClose();
        }
      }
      return;
    }

    if (tab === 'upload') {
      if (!uploadedPreview) {
        setErrorMsg('请先选择一张签名或电子公章图片');
        return;
      }
      onSaveSignature(uploadedPreview);
      onClose();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl !== 'string') return;
      const img = new Image();
      img.onload = () => {
        setUploadedPreview({
          dataUrl,
          aspectRatio: (img.naturalWidth || 200) / Math.max(1, img.naturalHeight || 100),
        });
      };
      img.onerror = () => setErrorMsg('无法加载所选图片文件');
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-[510px] bg-[var(--bg-chrome)] border border-[var(--border-strong)] rounded-xl shadow-2xl p-5 text-[var(--text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-hairline)]">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <PenTool className="w-4 h-4 text-[var(--accent)]" />
            <span>创建电子签名</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="grid grid-cols-3 gap-1 my-3.5 p-1 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg text-xs">
          {[
            { id: 'draw' as const, label: '手写绘制', icon: <PenTool className="w-3.5 h-3.5" /> },
            { id: 'type' as const, label: '输入文字', icon: <Type className="w-3.5 h-3.5" /> },
            { id: 'upload' as const, label: '上传图片', icon: <Upload className="w-3.5 h-3.5" /> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setErrorMsg(null);
                if (t.id === 'draw') setHasDrawnInk(false);
              }}
              className={`h-8 rounded-md flex items-center justify-center gap-1.5 font-medium transition cursor-pointer ${
                tab === t.id
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Color & Thickness */}
        {tab !== 'upload' && (
          <div className="flex items-center justify-between mb-3 text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-2">
              <span>墨水颜色</span>
              <div className="flex items-center gap-1.5">
                {[
                  { label: '深黑', color: '#0f172a' },
                  { label: '蓝黑', color: '#1e3a8a' },
                  { label: '朱红', color: '#dc2626' },
                ].map((c) => (
                  <button
                    key={c.color}
                    onClick={() => setPenColor(c.color)}
                    className={`w-5 h-5 rounded-full border-2 cursor-pointer transition ${
                      penColor === c.color ? 'border-[var(--accent)] scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c.color }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            {tab === 'draw' && (
              <div className="flex items-center gap-1.5">
                <span>笔锋粗细</span>
                {[2, 3, 5].map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setPenSize(sz)}
                    className={`px-2 py-0.5 rounded font-mono text-[11px] cursor-pointer ${
                      penSize === sz
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-surface)] border border-[var(--border-hairline)]'
                    }`}
                  >
                    {sz}px
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'draw' && (
          <div className="relative border border-[var(--border-strong)] bg-white rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-[180px] block cursor-crosshair touch-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
            {!hasDrawnInk && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs">
                在此白色区域手写或触控签名
              </div>
            )}
            <button
              onClick={clearCanvas}
              className="absolute bottom-2 right-2 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-medium rounded-md flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>清除重写</span>
            </button>
          </div>
        )}

        {tab === 'type' && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="请输入姓名或签章文字..."
              value={typedName}
              onChange={(e) => {
                setTypedName(e.target.value);
                setErrorMsg(null);
              }}
              className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
            />
            <div className="grid grid-cols-2 gap-2">
              {TYPED_FONT_OPTIONS.map((f) => (
                <button
                  key={f.label}
                  onClick={() => setSelectedFont(f.value)}
                  className={`p-3 rounded-lg border text-center transition cursor-pointer bg-white ${
                    selectedFont === f.value
                      ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30'
                      : 'border-[var(--border-hairline)] opacity-85 hover:opacity-100'
                  }`}
                >
                  <div
                    className="text-xl italic truncate"
                    style={{ fontFamily: f.value, color: penColor }}
                  >
                    {typedName.trim() || 'Signature 签名'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">{f.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'upload' && (
          <div className="border border-dashed border-[var(--border-strong)] rounded-lg p-6 text-center bg-[var(--bg-surface)]">
            {uploadedPreview ? (
              <div className="space-y-3">
                <div className="h-32 bg-white rounded-md flex items-center justify-center p-2 border border-[var(--border-hairline)]">
                  <img
                    src={uploadedPreview.dataUrl}
                    alt="签名预览"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <label className="inline-block text-xs text-[var(--accent)] hover:underline cursor-pointer">
                  重新选择图片
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 mx-auto text-[var(--text-muted)] mb-2" />
                <p className="text-xs font-medium text-[var(--text-primary)]">
                  选择透明背景 PNG 或扫描签名图片
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  插入后自动保持原始纵横比例，不拉伸变形
                </p>
                <label className="mt-3 inline-block px-3.5 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium rounded-md cursor-pointer">
                  选择图片文件
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </>
            )}
          </div>
        )}

        {errorMsg && (
          <p className="mt-2.5 text-xs text-[var(--danger)]">{errorMsg}</p>
        )}

        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-[var(--border-hairline)]">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-1.5 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg flex items-center gap-1.5 font-medium cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>放置到当前页</span>
          </button>
        </div>
      </div>
    </div>
  );
};
