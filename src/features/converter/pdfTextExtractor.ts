import { pdfjsLib } from '../../utils/pdfWorker';
import { loadPdfDocument } from '../../lib/pdf/loader';
import type { Annotation, PageMetadata } from '../../types/pdf';

export interface ExtractedSpan {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
  bold: boolean;
  italic: boolean;
}

export interface ExtractedLine {
  y: number;
  maxFontSize: number;
  text: string;
  spans: ExtractedSpan[];
}

export interface ExtractedPageContent {
  pageNumber: number;
  lines: ExtractedLine[];
}

function isCjkChar(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x3000 && code <= 0x303f) ||
    (code >= 0xff00 && code <= 0xffef)
  );
}

/** Join spans on the same visual line while avoiding spurious spaces between CJK glyphs. */
export function joinSpansToLineText(spans: ExtractedSpan[]): string {
  if (spans.length === 0) return '';
  let out = spans[0].str;
  for (let i = 1; i < spans.length; i++) {
    const prev = spans[i - 1];
    const curr = spans[i];
    const prevEnd = prev.x + prev.width;
    const gap = curr.x - prevEnd;
    const prevLast = prev.str[prev.str.length - 1] || '';
    const currFirst = curr.str[0] || '';
    const bothCjk = isCjkChar(prevLast) && isCjkChar(currFirst);
    const spaceThreshold = bothCjk ? prev.fontSize * 0.45 : prev.fontSize * 0.18;

    if (gap > spaceThreshold && !prevLast.endsWith(' ') && !currFirst.startsWith(' ')) {
      out += ' ';
    }
    out += curr.str;
  }
  return out.trim();
}

export async function extractStructuredPdfPages(
  pdfBytes: Uint8Array,
  pages?: PageMetadata[],
  annotations: Annotation[] = [],
  exportPageNumbers?: number[]
): Promise<ExtractedPageContent[]> {
  const { pdf: pdfDoc } = await loadPdfDocument(pdfBytes);
  const pageList: PageMetadata[] =
    pages && pages.length > 0
      ? pages
      : Array.from({ length: pdfDoc.numPages }, (_, idx) => ({
          id: `raw_${idx}`,
          pageNumber: idx + 1,
          originalPageIndex: idx,
          originalRotation: 0,
          extraRotation: 0,
          rotation: 0,
          width: 595.28,
          height: 841.89,
        }));

  const filterSet = exportPageNumbers ? new Set(exportPageNumbers) : null;
  const results: ExtractedPageContent[] = [];

  for (let i = 0; i < pageList.length; i++) {
    const pageMeta = pageList[i];
    const displayPageNum = i + 1;
    if (filterSet && !filterSet.has(displayPageNum)) continue;

    const pageAnns = annotations.filter((a) => a.pageNumber === displayPageNum);
    const coveredBoxes = pageAnns
      .filter((a) => a.type === 'text' && (a.backgroundColor && a.backgroundColor !== 'transparent'))
      .map((a) => ({ x: a.x, y: a.y, width: a.width, height: a.height }));

    const rawItems: ExtractedSpan[] = [];

    if (!pageMeta.isBlank && pageMeta.originalPageIndex >= 0) {
      const page = await pdfDoc.getPage(pageMeta.originalPageIndex + 1);
      const intrinsicRotation = pageMeta.originalRotation || page.rotate || 0;
      const effectiveRotation = ((intrinsicRotation + (pageMeta.extraRotation || 0)) % 360 + 360) % 360;
      const viewport = page.getViewport({ scale: 1.0, rotation: effectiveRotation });
      const textContent = await page.getTextContent();

      for (const item of textContent.items) {
        if (!('str' in item) || item.str.trim().length === 0) continue;
        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const fontSize = Math.max(6, Math.round(Math.hypot(tx[0], tx[1])));
        const x = tx[4];
        const baselineY = tx[5];
        const y = baselineY - fontSize * 0.85;
        const width = item.width || item.str.length * fontSize * 0.5;
        const height = Math.max(fontSize, item.height || fontSize);

        // Skip original spans covered by a direct-edit whiteout text replacement
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const isOverridden = coveredBoxes.some(
          (box) =>
            centerX >= box.x - 2 &&
            centerX <= box.x + box.width + 2 &&
            centerY >= box.y - 2 &&
            centerY <= box.y + box.height + 2
        );
        if (isOverridden) continue;

        const fontName = item.fontName || 'Helvetica';
        rawItems.push({
          str: item.str,
          x,
          y,
          width,
          height,
          fontSize,
          fontName,
          bold: fontName.toLowerCase().includes('bold'),
          italic:
            fontName.toLowerCase().includes('italic') ||
            fontName.toLowerCase().includes('oblique'),
        });
      }
    }

    // Include user-added and edited text annotations in reading flow
    for (const ann of pageAnns) {
      if (ann.type === 'text' && ann.text.trim()) {
        const annLines = ann.text.split('\n');
        const lineH = ann.fontSize * 1.25;
        annLines.forEach((lineStr, idx) => {
          if (!lineStr.trim()) return;
          rawItems.push({
            str: lineStr,
            x: ann.x,
            y: ann.y + idx * lineH,
            width: ann.width,
            height: lineH,
            fontSize: ann.fontSize,
            fontName: ann.fontFamily,
            bold: ann.bold,
            italic: ann.italic,
          });
        });
      }
    }

    rawItems.sort((a, b) => {
      const lineThreshold = Math.max(4, Math.min(a.fontSize, b.fontSize) * 0.4);
      if (Math.abs(a.y - b.y) <= lineThreshold) {
        return a.x - b.x;
      }
      return a.y - b.y;
    });

    const lines: ExtractedLine[] = [];
    let currentLine: ExtractedSpan[] = [];
    let currentLineY = -Infinity;

    for (const item of rawItems) {
      if (currentLine.length === 0) {
        currentLine.push(item);
        currentLineY = item.y;
      } else {
        const threshold = Math.max(4, Math.min(currentLine[0].fontSize, item.fontSize) * 0.4);
        if (Math.abs(item.y - currentLineY) <= threshold) {
          currentLine.push(item);
        } else {
          lines.push({
            y: currentLineY,
            maxFontSize: Math.max(...currentLine.map((s) => s.fontSize)),
            text: joinSpansToLineText(currentLine),
            spans: currentLine,
          });
          currentLine = [item];
          currentLineY = item.y;
        }
      }
    }

    if (currentLine.length > 0) {
      lines.push({
        y: currentLineY,
        maxFontSize: Math.max(...currentLine.map((s) => s.fontSize)),
        text: joinSpansToLineText(currentLine),
        spans: currentLine,
      });
    }

    results.push({ pageNumber: displayPageNum, lines });
  }

  return results;
}
