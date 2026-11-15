export type ToolType =
  | 'select'
  | 'hand'
  | 'editContent'
  | 'text'
  | 'draw'
  | 'highlight'
  | 'rect'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'stamp'
  | 'signature'
  | 'erase';

export interface Point {
  x: number;
  y: number;
}

export interface BaseAnnotation {
  id: string;
  pageNumber: number; // 1-based display page index
  x: number;          // relative to page top-left in PDF points (72 dpi)
  y: number;          // relative to page top-left in PDF points
  width: number;
  height: number;
  color: string;
  opacity: number;
  rotation?: number;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  textAlign: 'left' | 'center' | 'right';
  backgroundColor?: string;
  descentRatio?: number;
  /** Tracks original PDF text item id when created via direct content editing */
  replacesTextKey?: string;
}

export interface ShapeAnnotation extends BaseAnnotation {
  type: 'rect' | 'circle' | 'line' | 'arrow';
  strokeWidth: number;
  fillColor?: string;
  hasFill?: boolean;
}

export interface DrawAnnotation extends BaseAnnotation {
  type: 'draw' | 'highlight';
  strokeWidth: number;
  points: Point[];
}

export interface ImageAnnotation extends BaseAnnotation {
  type: 'image' | 'signature' | 'stamp';
  assetId: string; // Key in global assets dictionary
  aspectRatio: number;
  imageUrl?: string; // Fallback or inline preview
}

export type Annotation =
  | TextAnnotation
  | ShapeAnnotation
  | DrawAnnotation
  | ImageAnnotation;

export interface PageMetadata {
  id: string;                // Stable unique React key per page instance
  pageNumber: number;        // Display page number (1..N)
  originalPageIndex: number; // 0-based index in loaded pdfBytes (-1 if blank)
  originalRotation: number;  // Intrinsic page rotation in PDF (0, 90, 180, 270)
  extraRotation: number;     // User-applied rotation (0, 90, 180, 270)
  rotation: number;          // Effective rotation: (originalRotation + extraRotation) % 360
  width: number;             // Visual page width in points (72 dpi) after rotation
  height: number;            // Visual page height in points (72 dpi) after rotation
  isBlank?: boolean;         // True for user-inserted blank A4 pages
}

export interface WatermarkSettings {
  enabled: boolean;
  text: string;
  color: string;
  opacity: number;
  fontSize: number;
  angle: number;
  spacing: number;
}

export interface HistorySnapshot {
  pdfBytes: Uint8Array | null;
  pages: PageMetadata[];
  annotations: Annotation[];
}

export interface SearchMatch {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  snippet: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  description?: string;
}
