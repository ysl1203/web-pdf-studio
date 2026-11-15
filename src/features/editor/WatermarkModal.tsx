import React from 'react';
import { X, Check, Droplets } from 'lucide-react';
import type { WatermarkSettings } from '../../types/pdf';

interface WatermarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  watermark: WatermarkSettings;
  onChange: (updated: WatermarkSettings) => void;
}

export const WatermarkModal: React.FC<WatermarkModalProps> = ({
  isOpen,
  onClose,
  watermark,
  onChange,
}) => {
  if (!isOpen) return null;

  const presets = ['机密文件', 'CONFIDENTIAL', '内部资料', '草稿 DRAFT', '仅供审核'];
  const colors = ['#94a3b8', '#475569', '#dc2626', '#2563eb'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-[500px] bg-[var(--bg-chrome)] border border-[var(--border-strong)] rounded-xl shadow-2xl p-5 text-[var(--text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-hairline)]">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Droplets className="w-4 h-4 text-[var(--accent)]" />
            <span>文档安全水印</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-5 gap-4 my-4">
          {/* Controls */}
          <div className="col-span-3 space-y-3.5 text-xs">
            <label className="flex items-center justify-between p-2.5 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-hairline)] cursor-pointer">
              <span className="font-medium">启用全文档水印</span>
              <input
                type="checkbox"
                checked={watermark.enabled}
                onChange={(e) => onChange({ ...watermark, enabled: e.target.checked })}
                className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
              />
            </label>

            <div>
              <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
                水印文字
              </label>
              <input
                type="text"
                value={watermark.text}
                onChange={(e) => onChange({ ...watermark, text: e.target.value })}
                placeholder="输入水印内容..."
                className="w-full h-8 px-2.5 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-md text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {presets.map((p) => (
                  <button
                    key={p}
                    onClick={() => onChange({ ...watermark, text: p, enabled: true })}
                    className="px-2 py-0.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] text-[11px] rounded border border-[var(--border-hairline)] cursor-pointer"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-secondary)]">水印颜色</span>
              <div className="flex items-center gap-1.5">
                {colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => onChange({ ...watermark, color: c })}
                    className={`w-4 h-4 rounded-full border cursor-pointer ${
                      watermark.color.toLowerCase() === c.toLowerCase()
                        ? 'border-[var(--text-primary)] ring-2 ring-[var(--accent)]'
                        : 'border-[var(--border-strong)]'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-[var(--text-secondary)] mb-1">
                <span>不透明度</span>
                <span className="font-mono tabular-nums">{Math.round(watermark.opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.5"
                step="0.01"
                value={watermark.opacity}
                onChange={(e) => onChange({ ...watermark, opacity: parseFloat(e.target.value) })}
                className="w-full accent-[var(--accent)] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-[var(--text-secondary)] mb-1">
                <span>旋转角度</span>
                <span className="font-mono tabular-nums">{watermark.angle}°</span>
              </div>
              <input
                type="range"
                min="-60"
                max="60"
                step="5"
                value={watermark.angle}
                onChange={(e) => onChange({ ...watermark, angle: parseInt(e.target.value, 10) })}
                className="w-full accent-[var(--accent)] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-[var(--text-secondary)] mb-1">
                <span>字号大小</span>
                <span className="font-mono tabular-nums">{watermark.fontSize} pt</span>
              </div>
              <input
                type="range"
                min="16"
                max="60"
                step="2"
                value={watermark.fontSize}
                onChange={(e) => onChange({ ...watermark, fontSize: parseInt(e.target.value, 10) })}
                className="w-full accent-[var(--accent)] cursor-pointer"
              />
            </div>
          </div>

          {/* Live A4 Miniature Preview */}
          <div className="col-span-2 flex flex-col">
            <div className="text-[11px] text-[var(--text-secondary)] mb-1.5">实时效果预览</div>
            <div className="flex-1 bg-white rounded-md border border-[var(--border-strong)] relative overflow-hidden flex flex-col justify-between p-3 select-none min-h-[220px]">
              <div className="space-y-1.5 opacity-30">
                <div className="h-2.5 w-2/3 bg-slate-800 rounded-xs" />
                <div className="h-1.5 w-full bg-slate-400 rounded-xs" />
                <div className="h-1.5 w-5/6 bg-slate-400 rounded-xs" />
                <div className="h-1.5 w-full bg-slate-400 rounded-xs" />
                <div className="h-1.5 w-4/5 bg-slate-400 rounded-xs" />
              </div>

              {watermark.enabled && watermark.text.trim() && (
                <div
                  className="absolute inset-0 flex flex-wrap items-center justify-center gap-4 pointer-events-none"
                  style={{ opacity: watermark.opacity }}
                >
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <span
                      key={idx}
                      className="font-bold whitespace-nowrap"
                      style={{
                        color: watermark.color,
                        fontSize: `${Math.max(9, watermark.fontSize * 0.34)}px`,
                        transform: `rotate(${watermark.angle}deg)`,
                      }}
                    >
                      {watermark.text}
                    </span>
                  ))}
                </div>
              )}

              <div className="space-y-1.5 opacity-25">
                <div className="h-1.5 w-full bg-slate-400 rounded-xs" />
                <div className="h-1.5 w-3/4 bg-slate-400 rounded-xs" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-hairline)]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg flex items-center gap-1.5 font-medium cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>应用设置</span>
          </button>
        </div>
      </div>
    </div>
  );
};
