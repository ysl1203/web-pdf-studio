import {
  PDFDocument,
  rgb,
  degrees,
  StandardFonts,
  LineCapStyle,
  type PDFFont,
  type PDFImage,
} from 'pdf-lib';
import { embedCjkFont } from '../../lib/pdf/fonts';
import type { Annotation, PageMetadata, WatermarkSettings } from '../../types/pdf';

function hexToRgb(hex: string, defaultColor = rgb(0, 0, 0)) {
  if (!hex || !hex.startsWith('#')) return defaultColor;
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16) / 255;
    const g = parseInt(cleanHex[1] + cleanHex[1], 16) / 255;
    const b = parseInt(cleanHex[2] + cleanHex[2], 16) / 255;
    return rgb(r, g, b);
  }
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    return rgb(r, g, b);
  }
  return defaultColor;
}

function hasNonAscii(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 127) return true;
  }
  return false;
}

type FontVariantKey =
  | 'cjk-regular'
  | 'cjk-bold'
  | 'sans-regular'
  | 'sans-bold'
  | 'sans-italic'
  | 'sans-bold-italic'
  | 'serif-regular'
  | 'serif-bold'
  | 'serif-italic'
  | 'serif-bold-italic'
  | 'mono-regular'
  | 'mono-bold'
  | 'mono-italic'
  | 'mono-bold-italic';

const STANDARD_FONT_MAP: Record<Exclude<FontVariantKey, 'cjk-regular' | 'cjk-bold'>, StandardFonts> = {
  'sans-regular': StandardFonts.Helvetica,
  'sans-bold': StandardFonts.HelveticaBold,
  'sans-italic': StandardFonts.HelveticaOblique,
  'sans-bold-italic': StandardFonts.HelveticaBoldOblique,
  'serif-regular': StandardFonts.TimesRoman,
  'serif-bold': StandardFonts.TimesRomanBold,
  'serif-italic': StandardFonts.TimesRomanItalic,
  'serif-bold-italic': StandardFonts.TimesRomanBoldItalic,
  'mono-regular': StandardFonts.Courier,
  'mono-bold': StandardFonts.CourierBold,
  'mono-italic': StandardFonts.CourierOblique,
  'mono-bold-italic': StandardFonts.CourierBoldOblique,
};

function selectFontKey(fontFamily: string, bold: boolean, italic: boolean, needsCjk: boolean): FontVariantKey {
  if (needsCjk) {
    return bold ? 'cjk-bold' : 'cjk-regular';
  }
  const lower = (fontFamily || '').toLowerCase();
  let family: 'sans' | 'serif' | 'mono' = 'sans';
  if (lower.includes('courier') || lower.includes('mono')) {
    family = 'mono';
  } else if (lower.includes('times') || lower.includes('georgia') || lower.includes('serif')) {
    family = 'serif';
  }
  if (bold && italic) return `${family}-bold-italic`;
  if (bold) return `${family}-bold`;
  if (italic) return `${family}-italic`;
  return `${family}-regular`;
}

function wrapTextToWidth(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const safeMaxWidth = Math.max(fontSize, maxWidth);
  const rawParagraphs = text.split('\n');
  const wrapped: string[] = [];

  const measure = (s: string): number => {
    try {
      return font.widthOfTextAtSize(s, fontSize);
    } catch {
      return s.length * fontSize * 0.65;
    }
  };

  for (const para of rawParagraphs) {
    if (!para) {
      wrapped.push('');
      continue;
    }
    let currentLine = '';
    for (const ch of para) {
      const candidate = currentLine + ch;
      if (currentLine.length > 0 && measure(candidate) > safeMaxWidth) {
        // Prefer breaking at last ASCII space if one exists inside the line
        const lastSpace = currentLine.lastIndexOf(' ');
        if (lastSpace > 0 && ch !== ' ') {
          wrapped.push(currentLine.slice(0, lastSpace));
          currentLine = currentLine.slice(lastSpace + 1) + ch;
        } else {
          wrapped.push(currentLine);
          currentLine = ch === ' ' ? '' : ch;
        }
      } else {
        currentLine = candidate;
      }
    }
    wrapped.push(currentLine);
  }

  return wrapped;
}

/**
 * Transform visual top-left viewport coordinates (vx, vy) on a page rotated by
 * `effectiveRotation` (0, 90, 180, 270 CW) into raw PDF user-space coordinates.
 */
function createPageCoordMapper(
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  effectiveRotation: number
) {
  const rot = ((effectiveRotation % 360) + 360) % 360;

  const mapPoint = (vx: number, vy: number): { x: number; y: number } => {
    switch (rot) {
      case 90:
        return { x: boxX + vy, y: boxY + vx };
      case 180:
        return { x: boxX + (boxW - vx), y: boxY + vy };
      case 270:
        return { x: boxX + (boxW - vy), y: boxY + (boxH - vx) };
      default:
        return { x: boxX + vx, y: boxY + (boxH - vy) };
    }
  };

  // Maps a visual top-left box (vx, vy, w, h) to the origin & dimensions required by pdf-lib
  // when drawn with `rotate: degrees(rot)`.
  const mapBox = (vx: number, vy: number, w: number, h: number) => {
    const bottomLeft = mapPoint(vx, vy + h);
    const center = mapPoint(vx + w / 2, vy + h / 2);
    const isSwapped = rot === 90 || rot === 270;
    return {
      x: bottomLeft.x,
      y: bottomLeft.y,
      width: w,
      height: h,
      rotate: degrees(rot),
      centerX: center.x,
      centerY: center.y,
      rx: isSwapped ? h / 2 : w / 2,
      ry: isSwapped ? w / 2 : h / 2,
    };
  };

  const visualWidth = rot === 90 || rot === 270 ? boxH : boxW;
  const visualHeight = rot === 90 || rot === 270 ? boxW : boxH;

  return { rot, visualWidth, visualHeight, mapPoint, mapBox };
}

function createAnnLocalMapper(
  ann: { x: number; y: number; width: number; height: number; rotation?: number },
  mapper: ReturnType<typeof createPageCoordMapper>
) {
  const annRot = (((ann.rotation || 0) % 360) + 360) % 360;
  const isSwapped = annRot === 90 || annRot === 270;
  const unrotW = isSwapped ? ann.height : ann.width;
  const unrotH = isSwapped ? ann.width : ann.height;

  const toVisual = (lw: number, lh: number): { vx: number; vy: number } => {
    switch (annRot) {
      case 90:
        return { vx: ann.x + ann.width - lh, vy: ann.y + lw };
      case 180:
        return { vx: ann.x + ann.width - lw, vy: ann.y + ann.height - lh };
      case 270:
        return { vx: ann.x + lh, vy: ann.y + ann.height - lw };
      default:
        return { vx: ann.x + lw, vy: ann.y + lh };
    }
  };

  const mapLocalPoint = (lw: number, lh: number) => {
    const v = toVisual(lw, lh);
    return mapper.mapPoint(v.vx, v.vy);
  };

  const boxOrigin = mapLocalPoint(0, unrotH);
  const pdfRotAngle = (((mapper.rot - annRot) % 360) + 360) % 360;
  return {
    unrotW,
    unrotH,
    boxOrigin,
    pdfRotate: degrees(pdfRotAngle),
    mapLocalPoint,
  };
}

async function dataUrlToPngBytes(dataUrl: string): Promise<Uint8Array> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image data URL'));
    img.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width || 1;
  canvas.height = img.naturalHeight || img.height || 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');
  ctx.drawImage(img, 0, 0);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('PNG conversion failed');
  return new Uint8Array(await blob.arrayBuffer());
}

/** Fallback rasterizer if text contains glyphs (e.g. emojis) unsupported by embedded PDF fonts. */
async function renderTextFallbackImage(
  doc: PDFDocument,
  ann: Extract<Annotation, { type: 'text' }>,
  boxW: number,
  boxH: number
): Promise<PDFImage | null> {
  try {
    const scale = 3;
    const canvas = document.createElement('canvas');
    const w = Math.max(20, Math.ceil(boxW));
    const h = Math.max(20, Math.ceil(boxH));
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(scale, scale);

    if (ann.backgroundColor && ann.backgroundColor !== 'transparent') {
      ctx.fillStyle = ann.backgroundColor;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.fillStyle = ann.color || '#0f172a';
    ctx.font = `${ann.italic ? 'italic ' : ''}${ann.bold ? 'bold ' : ''}${ann.fontSize}px ${ann.fontFamily || 'sans-serif'}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = ann.textAlign || 'left';

    const padX = 4;
    const lineHeight = ann.fontSize * 1.25;
    const lines = ann.text.split('\n');
    const alignX =
      ann.textAlign === 'center' ? w / 2 : ann.textAlign === 'right' ? w - padX : padX;

    lines.forEach((line, idx) => {
      ctx.fillText(line, alignX, 3 + idx * lineHeight, Math.max(10, w - padX * 2));
    });

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) return null;
    return await doc.embedPng(new Uint8Array(await blob.arrayBuffer()));
  } catch {
    return null;
  }
}

export async function exportSynthesizedPdf(
  originalPdfBytes: Uint8Array,
  pages: PageMetadata[],
  annotations: Annotation[],
  watermark: WatermarkSettings,
  assets: Record<string, string> = {},
  exportPageNumbers?: number[]
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(originalPdfBytes.slice());
  const outDoc = await PDFDocument.create();

  const fontCache = new Map<FontVariantKey, PDFFont>();
  const getFont = async (key: FontVariantKey): Promise<PDFFont> => {
    const cached = fontCache.get(key);
    if (cached) return cached;
    let font: PDFFont;
    if (key === 'cjk-regular') {
      font = await embedCjkFont(outDoc, false);
    } else if (key === 'cjk-bold') {
      font = await embedCjkFont(outDoc, true);
    } else {
      font = await outDoc.embedFont(STANDARD_FONT_MAP[key]);
    }
    fontCache.set(key, font);
    return font;
  };

  try {
    const srcForm = srcDoc.getForm();
    if (srcForm && srcForm.getFields().length > 0) {
      const srcCjkFont = await embedCjkFont(srcDoc, false);
      srcForm.updateFieldAppearances(srcCjkFont);
      srcForm.flatten({ updateFieldAppearances: false });
    }
  } catch {
    // Optional form flattening
  }

  const imageCache = new Map<string, PDFImage>();
  const targetPageSet = exportPageNumbers ? new Set(exportPageNumbers) : null;

  for (let i = 0; i < pages.length; i++) {
    const pageMeta = pages[i];
    const displayPageNum = i + 1;
    if (targetPageSet && !targetPageSet.has(displayPageNum)) {
      continue;
    }

    let page;
    let effectiveRotation = 0;

    if (pageMeta.isBlank || pageMeta.originalPageIndex < 0) {
      const w = pageMeta.width || 595.28;
      const h = pageMeta.height || 841.89;
      page = outDoc.addPage([w, h]);
      effectiveRotation = 0;
    } else {
      const [copiedPage] = await outDoc.copyPages(srcDoc, [pageMeta.originalPageIndex]);
      const intrinsicRotation = pageMeta.originalRotation || copiedPage.getRotation().angle || 0;
      effectiveRotation = ((intrinsicRotation + (pageMeta.extraRotation || 0)) % 360 + 360) % 360;
      copiedPage.setRotation(degrees(effectiveRotation));
      page = outDoc.addPage(copiedPage);
    }

    const box = page.getCropBox() || page.getMediaBox();
    const mapper = createPageCoordMapper(
      box.x,
      box.y,
      box.width,
      box.height,
      effectiveRotation
    );

    const pageAnns = annotations.filter((a) => a.pageNumber === displayPageNum);

    for (const ann of pageAnns) {
      if (ann.type === 'text') {
        const annMap = createAnnLocalMapper(ann, mapper);
        const needsCjk = hasNonAscii(ann.text);
        const fontKey = selectFontKey(ann.fontFamily, ann.bold, ann.italic, needsCjk);
        const textFont = await getFont(fontKey);

        // Verify all glyphs can be encoded by the chosen font; fallback to raster if not (e.g. emojis)
        let canEncode = true;
        try {
          textFont.encodeText(ann.text.replace(/\n/g, ''));
        } catch {
          canEncode = false;
        }

        if (!canEncode) {
          const fallbackImg = await renderTextFallbackImage(
            outDoc,
            ann,
            annMap.unrotW,
            annMap.unrotH
          );
          if (fallbackImg) {
            page.drawImage(fallbackImg, {
              x: annMap.boxOrigin.x,
              y: annMap.boxOrigin.y,
              width: annMap.unrotW,
              height: annMap.unrotH,
              rotate: annMap.pdfRotate,
              opacity: ann.opacity,
            });
            continue;
          }
        }

        if (ann.backgroundColor && ann.backgroundColor !== 'transparent') {
          page.drawRectangle({
            x: annMap.boxOrigin.x,
            y: annMap.boxOrigin.y,
            width: annMap.unrotW,
            height: annMap.unrotH,
            rotate: annMap.pdfRotate,
            color: hexToRgb(ann.backgroundColor, rgb(1, 1, 1)),
            opacity: ann.opacity,
          });
        }

        const padX = 4;
        const padTop = 3;
        const lineHeight = ann.fontSize * 1.25;
        const lines = wrapTextToWidth(ann.text, textFont, ann.fontSize, annMap.unrotW - padX * 2);

        lines.forEach((line, lineIdx) => {
          if (!line) return;
          let textWidth = 0;
          try {
            textWidth = textFont.widthOfTextAtSize(line, ann.fontSize);
          } catch {
            textWidth = line.length * ann.fontSize * 0.55;
          }

          let textLw = padX;
          if (ann.textAlign === 'center') {
            textLw = Math.max(padX, (annMap.unrotW - textWidth) / 2);
          } else if (ann.textAlign === 'right') {
            textLw = Math.max(padX, annMap.unrotW - padX - textWidth);
          }

          // Baseline sits ~0.88 * fontSize below top of the line box
          const baselineLh = padTop + ann.fontSize * 0.88 + lineIdx * lineHeight;
          const pt = annMap.mapLocalPoint(textLw, baselineLh);

          try {
            page.drawText(line, {
              x: pt.x,
              y: pt.y,
              size: ann.fontSize,
              font: textFont,
              color: hexToRgb(ann.color, rgb(0, 0, 0)),
              opacity: ann.opacity,
              rotate: annMap.pdfRotate,
            });
          } catch (err) {
            console.warn('Skipped unencodable text line:', err);
          }
        });
      } else if (ann.type === 'rect') {
        const boxInfo = mapper.mapBox(ann.x, ann.y, ann.width, ann.height);
        page.drawRectangle({
          x: boxInfo.x,
          y: boxInfo.y,
          width: boxInfo.width,
          height: boxInfo.height,
          rotate: boxInfo.rotate,
          borderColor: hexToRgb(ann.color),
          borderWidth: ann.strokeWidth,
          borderOpacity: ann.opacity,
          color: ann.hasFill && ann.fillColor ? hexToRgb(ann.fillColor) : undefined,
          opacity: ann.hasFill && ann.fillColor ? ann.opacity : 0,
        });
      } else if (ann.type === 'circle') {
        const boxInfo = mapper.mapBox(ann.x, ann.y, ann.width, ann.height);
        page.drawEllipse({
          x: boxInfo.centerX,
          y: boxInfo.centerY,
          xScale: boxInfo.rx,
          yScale: boxInfo.ry,
          borderColor: hexToRgb(ann.color),
          borderWidth: ann.strokeWidth,
          borderOpacity: ann.opacity,
          color: ann.hasFill && ann.fillColor ? hexToRgb(ann.fillColor) : undefined,
          opacity: ann.hasFill && ann.fillColor ? ann.opacity : 0,
        });
      } else if (ann.type === 'line' || ann.type === 'arrow') {
        const start = mapper.mapPoint(ann.x, ann.y);
        const end = mapper.mapPoint(ann.x + ann.width, ann.y + ann.height);

        page.drawLine({
          start,
          end,
          thickness: ann.strokeWidth,
          color: hexToRgb(ann.color),
          opacity: ann.opacity,
          lineCap: LineCapStyle.Round,
        });

        if (ann.type === 'arrow') {
          const angle = Math.atan2(end.y - start.y, end.x - start.x);
          const headLength = Math.max(10, ann.strokeWidth * 3.2);
          const headAngle = Math.PI / 6;

          const p1 = {
            x: end.x - headLength * Math.cos(angle - headAngle),
            y: end.y - headLength * Math.sin(angle - headAngle),
          };
          const p2 = {
            x: end.x - headLength * Math.cos(angle + headAngle),
            y: end.y - headLength * Math.sin(angle + headAngle),
          };

          page.drawLine({
            start: end,
            end: p1,
            thickness: ann.strokeWidth,
            color: hexToRgb(ann.color),
            opacity: ann.opacity,
            lineCap: LineCapStyle.Round,
          });
          page.drawLine({
            start: end,
            end: p2,
            thickness: ann.strokeWidth,
            color: hexToRgb(ann.color),
            opacity: ann.opacity,
            lineCap: LineCapStyle.Round,
          });
        }
      } else if (ann.type === 'draw' || ann.type === 'highlight') {
        if (ann.points && ann.points.length > 1) {
          const isHighlight = ann.type === 'highlight';
          const lineOpacity = isHighlight ? 0.35 : ann.opacity;
          for (let p = 0; p < ann.points.length - 1; p++) {
            const p1 = mapper.mapPoint(ann.points[p].x, ann.points[p].y);
            const p2 = mapper.mapPoint(ann.points[p + 1].x, ann.points[p + 1].y);
            page.drawLine({
              start: p1,
              end: p2,
              thickness: ann.strokeWidth,
              color: hexToRgb(ann.color),
              opacity: lineOpacity,
              lineCap: LineCapStyle.Round,
            });
          }
        }
      } else if (ann.type === 'image' || ann.type === 'signature' || ann.type === 'stamp') {
        const imgDataUrl = (ann.assetId && assets[ann.assetId]) || ann.imageUrl;
        if (imgDataUrl) {
          let embeddedImage = imageCache.get(imgDataUrl);
          if (!embeddedImage) {
            try {
              if (imgDataUrl.startsWith('data:image/png')) {
                const base64Data = imgDataUrl.split(',')[1];
                const binary = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
                embeddedImage = await outDoc.embedPng(binary);
              } else if (
                imgDataUrl.startsWith('data:image/jpeg') ||
                imgDataUrl.startsWith('data:image/jpg')
              ) {
                const base64Data = imgDataUrl.split(',')[1];
                const binary = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
                embeddedImage = await outDoc.embedJpg(binary);
              } else {
                const pngBytes = await dataUrlToPngBytes(imgDataUrl);
                embeddedImage = await outDoc.embedPng(pngBytes);
              }
              if (embeddedImage) {
                imageCache.set(imgDataUrl, embeddedImage);
              }
            } catch (err) {
              console.warn('Failed to embed image annotation:', err);
            }
          }

          if (embeddedImage) {
            const annMap = createAnnLocalMapper(ann, mapper);
            const fitScale = Math.min(
              annMap.unrotW / embeddedImage.width,
              annMap.unrotH / embeddedImage.height
            );
            const drawW = embeddedImage.width * fitScale;
            const drawH = embeddedImage.height * fitScale;
            const offsetX = (annMap.unrotW - drawW) / 2;
            const offsetY = (annMap.unrotH - drawH) / 2;
            const imgOrigin = annMap.mapLocalPoint(offsetX, offsetY + drawH);
            page.drawImage(embeddedImage, {
              x: imgOrigin.x,
              y: imgOrigin.y,
              width: drawW,
              height: drawH,
              rotate: annMap.pdfRotate,
              opacity: ann.opacity,
            });
          }
        }
      }
    }

    if (watermark && watermark.enabled && watermark.text.trim()) {
      const baseStep = Math.max(120, watermark.spacing);
      const wmColor = hexToRgb(watermark.color, rgb(0.6, 0.65, 0.72));
      const isWmChinese = hasNonAscii(watermark.text);
      const wmFont = await getFont(isWmChinese ? 'cjk-regular' : 'sans-bold');
      let wmTextWidth = watermark.text.length * watermark.fontSize * 0.62;
      try {
        wmTextWidth = wmFont.widthOfTextAtSize(watermark.text, watermark.fontSize);
      } catch {
        // use heuristic width
      }

      const angleRad = (watermark.angle * Math.PI) / 180;
      const stepX = Math.max(baseStep, Math.abs(wmTextWidth * Math.cos(angleRad)) + 84);
      const stepY = Math.max(baseStep, watermark.fontSize * 3.2);

      // Rotate in the same visual direction as CSS (positive angle = clockwise)
      const pdfWmRotate = degrees(mapper.rot - watermark.angle);
      for (let wx = 60; wx < mapper.visualWidth + stepX; wx += stepX) {
        for (let wy = 60; wy < mapper.visualHeight + stepY; wy += stepY) {
          const vx =
            wx -
            (wmTextWidth / 2) * Math.cos(angleRad) -
            watermark.fontSize * 0.35 * Math.sin(angleRad);
          const vy =
            wy -
            (wmTextWidth / 2) * Math.sin(angleRad) +
            watermark.fontSize * 0.35 * Math.cos(angleRad);
          const pt = mapper.mapPoint(vx, vy);
          try {
            page.drawText(watermark.text, {
              x: pt.x,
              y: pt.y,
              size: watermark.fontSize,
              font: wmFont,
              color: wmColor,
              opacity: watermark.opacity,
              rotate: pdfWmRotate,
            });
          } catch {
            // Skip if unencodable watermark character
          }
        }
      }
    }
  }

  return await outDoc.save();
}
