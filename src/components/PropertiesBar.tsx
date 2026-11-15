import React, { useRef } from 'react';
import {
  Trash2,
  Type as TypeIcon,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Plus,
  Minus,
  Pipette,
  Eraser,
  Edit3,
  Hand,
  MousePointer,
} from 'lucide-react';
import { AVAILABLE_FONTS } from '../lib/pdf/fontOptions';
import type { ToolType, Annotation } from '../types/pdf';

interface PropertiesBarProps {
  activeTool: ToolType;
  selectedAnnotation: Annotation | null;
  annotationCount: number;
  currentColor: string;
  onChangeColor: (color: string) => void;
  strokeWidth: number;
  onChangeStrokeWidth: (width: number) => void;
  fontSize: number;
  onChangeFontSize: (size: number) => void;
  fontFamily: string;
  onChangeFontFamily: (font: string) => void;
  bold: boolean;
  onToggleBold: (bold: boolean) => void;
  italic: boolean;
  onToggleItalic: (italic: boolean) => void;
  textAlign: 'left' | 'center' | 'right';
  onChangeTextAlign: (align: 'left' | 'center' | 'right') => void;
  hasFill: boolean;
  onToggleFill: (hasFill: boolean) => void;
  fillColor: string;
  onChangeFillColor: (color: string) => void;
  textBackgroundColor?: string;
  onChangeTextBackground?: (bgColor: string) => void;
  onDeleteSelected: () => void;
  onClearAllAnnotations: () => void;
}

export const PropertiesBar: React.FC<PropertiesBarProps> = ({
  activeTool,
  selectedAnnotation,
  annotationCount,
  currentColor,
  onChangeColor,
  strokeWidth,
  onChangeStrokeWidth,
  fontSize,
  onChangeFontSize,
  fontFamily,
  onChangeFontFamily,
  bold,
  onToggleBold,
  italic,
  onToggleItalic,
  textAlign,
  onChangeTextAlign,
  hasFill,
  onToggleFill,
  fillColor,
  onChangeFillColor,
  textBackgroundColor = 'transparent',
  onChangeTextBackground,
  onDeleteSelected,
  onClearAllAnnotations,
}) => {
  const colorInputRef = useRef<HTMLInputElement>(null);
  const fillColorInputRef = useRef<HTMLInputElement>(null);
  const textBgInputRef = useRef<HTMLInputElement>(null);

  const colorPresets = [
    { label: '墨黑', color: '#0f172a' },
    { label: '钴蓝', color: '#2563eb' },
    { label: '朱红', color: '#dc2626' },
    { label: '松绿', color: '#16a34a' },
    { label: '琥珀', color: '#d97706' },
    { label: '荧光黄', color: '#facc15' },
    { label: '纯白', color: '#ffffff' },
  ];

  const strokeOptions = [1, 2, 3, 5, 8, 12];
  const fontSizePresets = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48];

  const activeColor = selectedAnnotation ? selectedAnnotation.color : currentColor;
  const activeStrokeWidth =
    selectedAnnotation && 'strokeWidth' in selectedAnnotation
      ? selectedAnnotation.strokeWidth
      : strokeWidth;
  const activeFontSize =
    selectedAnnotation && selectedAnnotation.type === 'text'
      ? selectedAnnotation.fontSize
      : fontSize;
  const activeFontFamily =
    selectedAnnotation && selectedAnnotation.type === 'text'
      ? selectedAnnotation.fontFamily
      : fontFamily;
  const activeBold =
    selectedAnnotation && selectedAnnotation.type === 'text' ? selectedAnnotation.bold : bold;
  const activeItalic =
    selectedAnnotation && selectedAnnotation.type === 'text' ? selectedAnnotation.italic : italic;
  const activeAlign =
    selectedAnnotation && selectedAnnotation.type === 'text'
      ? selectedAnnotation.textAlign
      : textAlign;
  const activeHasFill =
    selectedAnnotation && 'hasFill' in selectedAnnotation
      ? Boolean(selectedAnnotation.hasFill)
      : hasFill;
  const activeFillColor =
    selectedAnnotation && 'fillColor' in selectedAnnotation && selectedAnnotation.fillColor
      ? selectedAnnotation.fillColor
      : fillColor;
  const activeTextBg =
    selectedAnnotation && selectedAnnotation.type === 'text'
      ? selectedAnnotation.backgroundColor || 'transparent'
      : textBackgroundColor;

  const isTextMode = activeTool === 'text' || selectedAnnotation?.type === 'text';
  const isDrawOrHighlight =
    activeTool === 'draw' ||
    activeTool === 'highlight' ||
    selectedAnnotation?.type === 'draw' ||
    selectedAnnotation?.type === 'highlight';
  const isShapeMode =
    activeTool === 'rect' ||
    activeTool === 'circle' ||
    activeTool === 'line' ||
    activeTool === 'arrow' ||
    selectedAnnotation?.type === 'rect' ||
    selectedAnnotation?.type === 'circle' ||
    selectedAnnotation?.type === 'line' ||
    selectedAnnotation?.type === 'arrow';
  const isBoxShape =
    activeTool === 'rect' ||
    activeTool === 'circle' ||
    selectedAnnotation?.type === 'rect' ||
    selectedAnnotation?.type === 'circle';
  const isImageSelected =
    selectedAnnotation?.type === 'signature' ||
    selectedAnnotation?.type === 'stamp' ||
    selectedAnnotation?.type === 'image';

  const showStyleControls =
    Boolean(selectedAnnotation) || isTextMode || isDrawOrHighlight || isShapeMode;

  return (
    <div
      data-text-toolbar="true"
      onMouseDown={(e) => {
        if (e.target instanceof HTMLElement && !e.target.closest('select, input')) {
          e.preventDefault();
        }
      }}
      className="h-9 px-3.5 bg-[var(--bg-chrome)] border-b border-[var(--border-hairline)] flex items-center justify-between text-xs text-[var(--text-secondary)] z-20 shrink-0"
    >
      <div className="flex items-center gap-3 overflow-x-auto py-0.5 min-w-0">
        {activeTool === 'erase' && !selectedAnnotation && (
          <div className="flex items-center gap-2 text-[var(--danger)]">
            <Eraser className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs font-medium">
              橡皮擦已激活：点击或按住拖动划过任意笔迹、高亮、图形或文本框即可擦除
            </span>
          </div>
        )}

        {activeTool === 'editContent' && !selectedAnnotation && (
          <div className="flex items-center gap-2 text-[var(--accent)]">
            <Edit3 className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs">
              修改原文模式：点击虚线框选的 PDF 原有文字即可就地改写，自动采样周围背景色覆盖原文
            </span>
          </div>
        )}

        {activeTool === 'hand' && !selectedAnnotation && (
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <Hand className="w-3.5 h-3.5 shrink-0" />
            <span>抓手模式：按住鼠标左键拖动平移文档视图，按 V 键切回选择指针</span>
          </div>
        )}

        {activeTool === 'select' && !selectedAnnotation && (
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <MousePointer className="w-3.5 h-3.5 shrink-0" />
            <span>单击页面上的文字、图形或签名即可移动位置、拖拽四角缩放或调整样式（双击文字可再编辑）</span>
          </div>
        )}

        {isImageSelected && (
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <span>已选中{selectedAnnotation.type === 'signature' ? '电子签名' : '图片/图章'}：拖拽主体移动位置，拖拽四角控制点等比缩放</span>
          </div>
        )}

        {showStyleControls && !isImageSelected && activeTool !== 'erase' && (
          <>
            {/* Color Palette */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] text-[var(--text-muted)]">颜色</span>
              <div className="flex items-center gap-1">
                {colorPresets.map((c) => (
                  <button
                    key={c.color}
                    onClick={() => onChangeColor(c.color)}
                    className={`w-4 h-4 rounded-full border transition cursor-pointer ${
                      activeColor.toLowerCase() === c.color.toLowerCase()
                        ? 'border-[var(--text-primary)] ring-2 ring-[var(--accent)] scale-110'
                        : 'border-[var(--border-strong)] hover:scale-110'
                    }`}
                    style={{ backgroundColor: c.color }}
                    title={`${c.label} (${c.color})`}
                  />
                ))}

                <button
                  onClick={() => colorInputRef.current?.click()}
                  className="w-4 h-4 rounded-full border border-[var(--border-strong)] flex items-center justify-center bg-[var(--bg-surface)] hover:border-[var(--accent)] cursor-pointer ml-0.5"
                  title="自定义颜色"
                >
                  <Pipette className="w-2.5 h-2.5 text-[var(--text-primary)]" />
                </button>
                <input
                  type="color"
                  ref={colorInputRef}
                  value={activeColor.startsWith('#') && activeColor.length === 7 ? activeColor : '#2563eb'}
                  onChange={(e) => onChangeColor(e.target.value)}
                  className="opacity-0 absolute w-0 h-0 pointer-events-none"
                />
                <span className="text-[10px] font-mono tabular-nums text-[var(--text-muted)] uppercase ml-0.5">
                  {activeColor}
                </span>
              </div>
            </div>
          </>
        )}

        {/* Text controls */}
        {isTextMode && (
          <>
            <span className="h-4 w-px bg-[var(--border-hairline)] shrink-0" />
            <div className="flex items-center gap-1.5 shrink-0">
              <TypeIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <select
                value={activeFontFamily}
                onChange={(e) => onChangeFontFamily(e.target.value)}
                className="h-6 bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] text-xs rounded px-1.5 outline-none focus:border-[var(--accent)] cursor-pointer max-w-[140px]"
              >
                <optgroup label="中文字体">
                  {AVAILABLE_FONTS.filter((f) => f.category === 'cjk').map((f) => (
                    <option key={f.label} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="西文字体">
                  {AVAILABLE_FONTS.filter((f) => f.category === 'en').map((f) => (
                    <option key={f.label} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onChangeFontSize(Math.max(8, activeFontSize - 1))}
                className="h-6 w-6 rounded bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] flex items-center justify-center cursor-pointer"
                title="减小字号"
              >
                <Minus className="w-3 h-3" />
              </button>
              <input
                type="number"
                min={6}
                max={144}
                value={activeFontSize}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val > 0) onChangeFontSize(val);
                }}
                className="h-6 w-11 text-center bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] rounded text-xs font-mono tabular-nums outline-none focus:border-[var(--accent)]"
              />
              <button
                onClick={() => onChangeFontSize(Math.min(144, activeFontSize + 1))}
                className="h-6 w-6 rounded bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] flex items-center justify-center cursor-pointer"
                title="增大字号"
              >
                <Plus className="w-3 h-3" />
              </button>
              <select
                value={fontSizePresets.includes(activeFontSize) ? activeFontSize : ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (val) onChangeFontSize(val);
                }}
                className="h-6 bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-secondary)] text-[11px] rounded px-1 outline-none cursor-pointer"
                title="常用字号"
              >
                <option value="" disabled>
                  字号
                </option>
                {fontSizePresets.map((sz) => (
                  <option key={sz} value={sz}>
                    {sz} pt
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-0.5 bg-[var(--bg-surface)] p-0.5 rounded border border-[var(--border-hairline)] shrink-0">
              <button
                onClick={() => onToggleBold(!activeBold)}
                className={`p-1 rounded cursor-pointer ${
                  activeBold ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--bg-hover)]'
                }`}
                title="加粗"
              >
                <Bold className="w-3 h-3" />
              </button>
              <button
                onClick={() => onToggleItalic(!activeItalic)}
                className={`p-1 rounded cursor-pointer ${
                  activeItalic ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--bg-hover)]'
                }`}
                title="斜体"
              >
                <Italic className="w-3 h-3" />
              </button>
            </div>

            <div className="flex items-center gap-0.5 bg-[var(--bg-surface)] p-0.5 rounded border border-[var(--border-hairline)] shrink-0">
              <button
                onClick={() => onChangeTextAlign('left')}
                className={`p-1 rounded cursor-pointer ${
                  activeAlign === 'left' ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--bg-hover)]'
                }`}
                title="左对齐"
              >
                <AlignLeft className="w-3 h-3" />
              </button>
              <button
                onClick={() => onChangeTextAlign('center')}
                className={`p-1 rounded cursor-pointer ${
                  activeAlign === 'center' ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--bg-hover)]'
                }`}
                title="居中"
              >
                <AlignCenter className="w-3 h-3" />
              </button>
              <button
                onClick={() => onChangeTextAlign('right')}
                className={`p-1 rounded cursor-pointer ${
                  activeAlign === 'right' ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--bg-hover)]'
                }`}
                title="右对齐"
              >
                <AlignRight className="w-3 h-3" />
              </button>
            </div>

            {onChangeTextBackground && (
              <div className="flex items-center gap-1.5 shrink-0 pl-1">
                <label className="flex items-center gap-1 cursor-pointer text-[11px]">
                  <input
                    type="checkbox"
                    checked={Boolean(activeTextBg) && activeTextBg !== 'transparent'}
                    onChange={(e) =>
                      onChangeTextBackground(e.target.checked ? '#ffffff' : 'transparent')
                    }
                    className="accent-[var(--accent)] cursor-pointer"
                  />
                  底色覆盖
                </label>
                {activeTextBg && activeTextBg !== 'transparent' && (
                  <>
                    <button
                      onClick={() => textBgInputRef.current?.click()}
                      className="w-4 h-4 rounded border border-[var(--border-strong)] cursor-pointer"
                      style={{ backgroundColor: activeTextBg }}
                      title="调整遮盖底色"
                    />
                    <input
                      type="color"
                      ref={textBgInputRef}
                      value={
                        activeTextBg.startsWith('#') && activeTextBg.length === 7
                          ? activeTextBg
                          : '#ffffff'
                      }
                      onChange={(e) => onChangeTextBackground(e.target.value)}
                      className="opacity-0 absolute w-0 h-0 pointer-events-none"
                    />
                  </>
                )}
              </div>
            )}

            {activeTool === 'text' && !selectedAnnotation && (
              <span className="text-[11px] text-[var(--text-muted)] shrink-0 pl-1 hidden xl:inline">
                单击自适应输入 · 拖拽定宽框选
              </span>
            )}
          </>
        )}

        {/* Stroke width */}
        {(isDrawOrHighlight || isShapeMode) && activeTool !== 'erase' && (
          <>
            <span className="h-4 w-px bg-[var(--border-hairline)] shrink-0" />
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[11px] text-[var(--text-muted)] mr-0.5">线宽</span>
              {strokeOptions.map((w) => (
                <button
                  key={w}
                  onClick={() => onChangeStrokeWidth(w)}
                  className={`h-6 px-1.5 rounded text-[11px] font-mono tabular-nums cursor-pointer transition ${
                    activeStrokeWidth === w
                      ? 'bg-[var(--accent)] text-white font-medium'
                      : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)]'
                  }`}
                >
                  {w}px
                </button>
              ))}
            </div>
          </>
        )}

        {/* Shape Fill */}
        {isBoxShape && activeTool !== 'erase' && (
          <>
            <span className="h-4 w-px bg-[var(--border-hairline)] shrink-0" />
            <div className="flex items-center gap-1.5 shrink-0">
              <label className="flex items-center gap-1 text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeHasFill}
                  onChange={(e) => onToggleFill(e.target.checked)}
                  className="accent-[var(--accent)] cursor-pointer"
                />
                填充
              </label>
              {activeHasFill && (
                <>
                  <button
                    onClick={() => fillColorInputRef.current?.click()}
                    className="w-4 h-4 rounded border border-[var(--border-strong)] cursor-pointer"
                    style={{ backgroundColor: activeFillColor }}
                    title="选择填充颜色"
                  />
                  <input
                    type="color"
                    ref={fillColorInputRef}
                    value={activeFillColor.startsWith('#') && activeFillColor.length === 7 ? activeFillColor : '#ffffff'}
                    onChange={(e) => onChangeFillColor(e.target.value)}
                    className="opacity-0 absolute w-0 h-0 pointer-events-none"
                  />
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right contextual action */}
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {selectedAnnotation ? (
          <button
            onClick={onDeleteSelected}
            className="h-6 px-2.5 rounded bg-rose-500/15 text-[var(--danger)] hover:bg-rose-500/25 border border-rose-500/30 flex items-center gap-1 text-[11px] font-medium cursor-pointer"
            title="删除选中批注 (Delete / Backspace)"
          >
            <Trash2 className="w-3 h-3" />
            <span>删除批注</span>
          </button>
        ) : annotationCount > 0 ? (
          <button
            onClick={onClearAllAnnotations}
            className="h-6 px-2 rounded text-[11px] text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-hover)] transition cursor-pointer"
            title="清空文档上的所有批注和修改"
          >
            清空全部批注 ({annotationCount})
          </button>
        ) : null}
      </div>
    </div>
  );
};
