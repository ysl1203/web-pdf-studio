import React, { useState } from 'react';
import { X, Stamp, Upload, Plus } from 'lucide-react';

interface StampResult {
  dataUrl: string;
  aspectRatio: number;
  kind: 'stamp' | 'image';
}

interface StampModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertStamp: (result: StampResult) => void;
}

interface PresetStamp {
  title: string;
  sub: string;
  color: string;
}

const PRESET_STAMPS: PresetStamp[] = [
  { title: '已审核', sub: 'APPROVED', color: '#16a34a' },
  { title: '机密文件', sub: 'CONFIDENTIAL', color: '#dc2626' },
  { title: '已通过', sub: 'PASSED', color: '#2563eb' },
  { title: '加急处理', sub: 'URGENT', color: '#d97706' },
  { title: '草稿件', sub: 'DRAFT', color: '#64748b' },
  { title: '作废', sub: 'VOID', color: '#be123c' },
];

function renderVectorStampToPng(title: string, sub: string, color: string): StampResult {
  const width = 440;
  const height = 160;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, width, height);

  // Double stamp border
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, width - 16, height - 16);
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, width - 32, height - 32);

  // Title text
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 46px "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.fillText(title, width / 2, sub ? 66 : height / 2, width - 56);

  if (sub) {
    ctx.font = 'bold 20px "Inter", Arial, sans-serif';
    ctx.fillText(sub, width / 2, 118, width - 56);
  }

  return {
    dataUrl: canvas.toDataURL('image/png'),
    aspectRatio: width / height,
    kind: 'stamp',
  };
}

export const StampModal: React.FC<StampModalProps> = ({
  isOpen,
  onClose,
  onInsertStamp,
}) => {
  const [customText, setCustomText] = useState('');
  const [customColor, setCustomColor] = useState('#dc2626');

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl !== 'string') return;
      const img = new Image();
      img.onload = () => {
        onInsertStamp({
          dataUrl,
          aspectRatio: (img.naturalWidth || 200) / Math.max(1, img.naturalHeight || 200),
          kind: 'image',
        });
        onClose();
      };
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
        className="w-[480px] bg-[var(--bg-chrome)] border border-[var(--border-strong)] rounded-xl shadow-2xl p-5 text-[var(--text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-hairline)]">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Stamp className="w-4 h-4 text-[var(--accent)]" />
            <span>审阅图章与图片插图</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="my-4 space-y-4">
          {/* Preset stamps grid */}
          <div>
            <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">
              标准业务图章（点击立即加盖到当前页）
            </div>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_STAMPS.map((st) => (
                <button
                  key={st.title}
                  onClick={() => {
                    onInsertStamp(renderVectorStampToPng(st.title, st.sub, st.color));
                    onClose();
                  }}
                  className="p-2.5 rounded-lg bg-white hover:ring-2 hover:ring-[var(--accent)] border border-[var(--border-hairline)] transition cursor-pointer flex flex-col items-center justify-center"
                >
                  <div
                    className="w-full py-1 px-1.5 border-2 rounded-xs text-center"
                    style={{ borderColor: st.color, color: st.color }}
                  >
                    <div className="text-xs font-bold leading-tight">{st.title}</div>
                    <div className="text-[9px] font-bold tracking-wider leading-tight mt-0.5">
                      {st.sub}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom text stamp */}
          <div className="p-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-2.5">
            <div className="text-xs font-medium text-[var(--text-secondary)]">自定义文字图章</div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="输入印章文字，如：财务专用..."
                className="flex-1 h-8 px-2.5 rounded-md bg-[var(--bg-chrome)] border border-[var(--border-strong)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-8 h-8 rounded border border-[var(--border-strong)] bg-transparent cursor-pointer"
                title="印章颜色"
              />
              <button
                onClick={() => {
                  if (!customText.trim()) return;
                  onInsertStamp(renderVectorStampToPng(customText.trim(), '', customColor));
                  onClose();
                }}
                disabled={!customText.trim()}
                className="h-8 px-3 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-white text-xs font-medium flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>生成</span>
              </button>
            </div>
          </div>

          {/* Insert local image */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
            <div>
              <div className="text-xs font-medium text-[var(--text-primary)]">插入本地图片</div>
              <div className="text-[11px] text-[var(--text-muted)]">
                支持 PNG、JPG、WebP 等格式，插入后可自由移动和等比缩放
              </div>
            </div>
            <label className="h-8 px-3 rounded-md bg-[var(--bg-chrome)] hover:bg-[var(--bg-hover)] border border-[var(--border-strong)] text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0">
              <Upload className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>选择图片</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
