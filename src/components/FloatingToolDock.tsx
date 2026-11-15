import React from 'react';
import {
  MousePointer,
  Hand,
  Undo2,
  Redo2,
  Edit3,
  Type,
  PenTool,
  Highlighter,
  Square,
  Circle,
  Minus,
  MoveRight,
  PenLine,
  Stamp,
  Droplets,
  Eraser,
} from 'lucide-react';
import type { ToolType } from '../types/pdf';

interface FloatingToolDockProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenSignature: () => void;
  onOpenStamp: () => void;
  onOpenWatermark: () => void;
  watermarkEnabled: boolean;
}

export const FloatingToolDock: React.FC<FloatingToolDockProps> = ({
  activeTool,
  onSelectTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenSignature,
  onOpenStamp,
  onOpenWatermark,
  watermarkEnabled,
}) => {
  const pillBtn = (isActive: boolean, danger = false) =>
    `h-8 px-1.5 xl:px-2 rounded-xl flex items-center gap-1 text-[11.5px] font-medium transition cursor-pointer shrink-0 ${
      isActive
        ? danger
          ? 'bg-[var(--danger)] text-white shadow-sm'
          : 'bg-[var(--accent)] text-white shadow-sm'
        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
    }`;

  const iconOnlyBtn = (isActive: boolean) =>
    `h-8 w-7 rounded-xl flex items-center justify-center transition cursor-pointer shrink-0 ${
      isActive
        ? 'bg-[var(--accent)] text-white shadow-sm'
        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
    }`;

  return (
    <div
      className="absolute inset-x-3 bottom-4 z-30 flex justify-center pointer-events-none select-none"
      role="toolbar"
      aria-label="编辑与批注工具栏"
    >
      <div
        className="pointer-events-auto max-w-full overflow-x-auto flex items-center gap-0.5 px-2 py-1.5 rounded-2xl bg-[var(--bg-surface)]/95 backdrop-blur-md border border-[var(--border-hairline)] whitespace-nowrap"
        style={{ boxShadow: 'var(--shadow-float)' }}
      >
        {/* Selection & Pan */}
        <button
          onClick={() => onSelectTool('select')}
          className={pillBtn(activeTool === 'select')}
          title="选择与编辑批注 (V)"
        >
          <MousePointer className="w-3.5 h-3.5" />
          <span>选择</span>
        </button>

        <button
          onClick={() => onSelectTool('hand')}
          className={pillBtn(activeTool === 'hand')}
          title="抓手平移画布 (H 或按住空格键)"
        >
          <Hand className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">抓手</span>
        </button>

        <span className="h-5 w-px bg-[var(--border-hairline)] mx-0.5 shrink-0" />

        {/* Text & Rewrite */}
        <button
          onClick={() => onSelectTool('editContent')}
          className={pillBtn(activeTool === 'editContent')}
          title="直接点击 PDF 原文段落进行修改并智能匹配底色覆盖"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>改原文</span>
        </button>

        <button
          onClick={() => onSelectTool('text')}
          className={pillBtn(activeTool === 'text')}
          title="插入新文本框 (T)"
        >
          <Type className="w-3.5 h-3.5" />
          <span>文字</span>
        </button>

        <span className="h-5 w-px bg-[var(--border-hairline)] mx-0.5 shrink-0" />

        {/* Freehand Ink & Highlighter */}
        <button
          onClick={() => onSelectTool('draw')}
          className={pillBtn(activeTool === 'draw')}
          title="自由画笔批注 (P)"
        >
          <PenTool className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">画笔</span>
        </button>

        <button
          onClick={() => onSelectTool('highlight')}
          className={pillBtn(activeTool === 'highlight')}
          title="荧光笔高亮"
        >
          <Highlighter className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">高亮</span>
        </button>

        <span className="h-5 w-px bg-[var(--border-hairline)] mx-0.5 shrink-0" />

        {/* Vector Shapes */}
        <button
          onClick={() => onSelectTool('rect')}
          className={iconOnlyBtn(activeTool === 'rect')}
          title="矩形框"
        >
          <Square className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onSelectTool('circle')}
          className={iconOnlyBtn(activeTool === 'circle')}
          title="圆形 / 椭圆"
        >
          <Circle className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onSelectTool('line')}
          className={iconOnlyBtn(activeTool === 'line')}
          title="直线"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onSelectTool('arrow')}
          className={iconOnlyBtn(activeTool === 'arrow')}
          title="指向箭头"
        >
          <MoveRight className="w-3.5 h-3.5" />
        </button>

        <span className="h-5 w-px bg-[var(--border-hairline)] mx-0.5 shrink-0" />

        {/* Signature, Stamp & Watermark */}
        <button
          onClick={onOpenSignature}
          className={pillBtn(activeTool === 'signature')}
          title="绘制手写签名或上传透明签名图片"
        >
          <PenLine className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">签名</span>
        </button>

        <button
          onClick={onOpenStamp}
          className={pillBtn(activeTool === 'stamp')}
          title="插入审阅图章或本地图片"
        >
          <Stamp className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">图章</span>
        </button>

        <button
          onClick={onOpenWatermark}
          className={`${pillBtn(false)} relative`}
          title="配置全文档平铺安全水印"
        >
          <Droplets className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">水印</span>
          {watermarkEnabled && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] shrink-0" />
          )}
        </button>

        <span className="h-5 w-px bg-[var(--border-hairline)] mx-0.5 shrink-0" />

        {/* Eraser & History */}
        <button
          onClick={() => onSelectTool('erase')}
          className={pillBtn(activeTool === 'erase', true)}
          title="橡皮擦：点击或划过批注即可擦除 (E)"
        >
          <Eraser className="w-3.5 h-3.5" />
          <span>橡皮擦</span>
        </button>

        <span className="h-5 w-px bg-[var(--border-hairline)] mx-0.5 shrink-0" />

        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="h-8 w-7 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
          title="撤销 (Ctrl+Z)"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="h-8 w-7 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
          title="重做 (Ctrl+Y / Ctrl+Shift+Z)"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
