import JSZip from 'jszip';
import { downloadFile, type DownloadOutcome } from '../../utils/download';
import { loadPdfDocument } from '../../lib/pdf/loader';
import type { Annotation, PageMetadata, WatermarkSettings } from '../../types/pdf';

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load annotation image'));
    img.src = src;
  });
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const safeMax = Math.max(20, maxWidth);
  const result: string[] = [];
  for (const para of text.split('\n')) {
    if (!para) {
      result.push('');
      continue;
    }
    let line = '';
    for (const ch of para) {
      const candidate = line + ch;
      if (line.length > 0 && ctx.measureText(candidate).width > safeMax) {
        result.push(line);
        line = ch === ' ' ? '' : ch;
      } else {
        line = candidate;
      }
    }
    result.push(line);
  }
  return result;
}

export async function convertPdfToImages(
  pdfBytes: Uint8Array,
  pages: PageMetadata[],
  annotations: Annotation[],
  watermark: WatermarkSettings,
  options: {
    format: 'png' | 'jpeg';
    scale: number;
    quality?: number;
    assets?: Record<string, string>;
    exportPageNumbers?: number[];
    baseName?: string;
    onProgress?: (current: number, total: number) => void;
  }
): Promise<DownloadOutcome> {
  const { pdf: pdfDoc } = await loadPdfDocument(pdfBytes);
  const zip = new JSZip();
  const assets = options.assets || {};
  const targetSet = options.exportPageNumbers ? new Set(options.exportPageNumbers) : null;
  const targetIndices = pages
    .map((_, idx) => idx)
    .filter((idx) => !targetSet || targetSet.has(idx + 1));

  const totalPages = targetIndices.length;
  const imageBlobs: { name: string; blob: Blob }[] = [];

  for (let step = 0; step < totalPages; step++) {
    const idx = targetIndices[step];
    const pageMeta = pages[idx];
    const pageNum = idx + 1;
    options.onProgress?.(step + 1, totalPages);

    const canvas = document.createElement('canvas');
    const ratio = options.scale;

    if (pageMeta.isBlank || pageMeta.originalPageIndex < 0) {
      canvas.width = Math.round((pageMeta.width || 595.28) * ratio);
      canvas.height = Math.round((pageMeta.height || 841.89) * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      const pdfPage = await pdfDoc.getPage(pageMeta.originalPageIndex + 1);
      const intrinsicRotation = pageMeta.originalRotation || pdfPage.rotate || 0;
      const effectiveRotation = ((intrinsicRotation + (pageMeta.extraRotation || 0)) % 360 + 360) % 360;
      const viewport = pdfPage.getViewport({
        scale: ratio,
        rotation: effectiveRotation,
      });

      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      // Always paint solid white paper base first so JPEG and transparent PDFs render cleanly
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await pdfPage.render({
        canvasContext: ctx,
        viewport,
        canvas,
      }).promise;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    const pageAnns = annotations.filter((a) => a.pageNumber === pageNum);

    for (const ann of pageAnns) {
      ctx.save();
      ctx.globalAlpha = ann.opacity;

      const ax = ann.x * ratio;
      const ay = ann.y * ratio;
      const aw = ann.width * ratio;
      const ah = ann.height * ratio;
      const annRot = (((ann.rotation || 0) % 360) + 360) % 360;
      const isRotSwapped = annRot === 90 || annRot === 270;
      const unrotW = isRotSwapped ? ah : aw;
      const unrotH = isRotSwapped ? aw : ah;

      if (ann.type === 'text') {
        if (annRot !== 0) {
          ctx.translate(ax + aw / 2, ay + ah / 2);
          ctx.rotate((annRot * Math.PI) / 180);
        }
        const rx = annRot !== 0 ? -unrotW / 2 : ax;
        const ry = annRot !== 0 ? -unrotH / 2 : ay;

        if (ann.backgroundColor && ann.backgroundColor !== 'transparent') {
          ctx.fillStyle = ann.backgroundColor;
          ctx.fillRect(rx, ry, unrotW, unrotH);
        }
        ctx.fillStyle = ann.color;
        ctx.font = `${ann.italic ? 'italic ' : ''}${ann.bold ? 'bold ' : ''}${ann.fontSize * ratio}px ${ann.fontFamily || 'sans-serif'}`;
        ctx.textBaseline = 'top';
        ctx.textAlign = ann.textAlign || 'left';

        const padX = 4 * ratio;
        const lineHeight = ann.fontSize * 1.25 * ratio;
        const lines = wrapCanvasText(ctx, ann.text, unrotW - padX * 2);
        const alignX =
          ann.textAlign === 'center'
            ? rx + unrotW / 2
            : ann.textAlign === 'right'
            ? rx + unrotW - padX
            : rx + padX;

        lines.forEach((line, lIdx) => {
          ctx.fillText(line, alignX, ry + 3 * ratio + lIdx * lineHeight);
        });
      } else if (ann.type === 'rect') {
        if (ann.hasFill && ann.fillColor) {
          ctx.fillStyle = ann.fillColor;
          ctx.fillRect(ax, ay, aw, ah);
        }
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = ann.strokeWidth * ratio;
        ctx.strokeRect(ax, ay, aw, ah);
      } else if (ann.type === 'circle') {
        ctx.beginPath();
        ctx.ellipse(ax + aw / 2, ay + ah / 2, Math.abs(aw) / 2, Math.abs(ah) / 2, 0, 0, 2 * Math.PI);
        if (ann.hasFill && ann.fillColor) {
          ctx.fillStyle = ann.fillColor;
          ctx.fill();
        }
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = ann.strokeWidth * ratio;
        ctx.stroke();
      } else if (ann.type === 'line' || ann.type === 'arrow') {
        const endX = ax + aw;
        const endY = ay + ah;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = ann.strokeWidth * ratio;
        ctx.lineCap = 'round';
        ctx.stroke();

        if (ann.type === 'arrow') {
          const angle = Math.atan2(endY - ay, endX - ax);
          const headLength = Math.max(10, ann.strokeWidth * 3.2) * ratio;
          const headAngle = Math.PI / 6;
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - headLength * Math.cos(angle - headAngle),
            endY - headLength * Math.sin(angle - headAngle)
          );
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - headLength * Math.cos(angle + headAngle),
            endY - headLength * Math.sin(angle + headAngle)
          );
          ctx.stroke();
        }
      } else if (ann.type === 'draw' || ann.type === 'highlight') {
        if (ann.points && ann.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(ann.points[0].x * ratio, ann.points[0].y * ratio);
          for (let p = 1; p < ann.points.length; p++) {
            ctx.lineTo(ann.points[p].x * ratio, ann.points[p].y * ratio);
          }
          ctx.strokeStyle = ann.color;
          ctx.lineWidth = ann.strokeWidth * ratio;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          if (ann.type === 'highlight') {
            ctx.globalAlpha = 0.38;
          }
          ctx.stroke();
        }
      } else if (ann.type === 'image' || ann.type === 'signature' || ann.type === 'stamp') {
        const imgSrc = (ann.assetId && assets[ann.assetId]) || ann.imageUrl;
        if (imgSrc) {
          try {
            const img = await loadImageElement(imgSrc);
            if (annRot !== 0) {
              ctx.translate(ax + aw / 2, ay + ah / 2);
              ctx.rotate((annRot * Math.PI) / 180);
            }
            const rx = annRot !== 0 ? -unrotW / 2 : ax;
            const ry = annRot !== 0 ? -unrotH / 2 : ay;
            const natW = img.naturalWidth || unrotW;
            const natH = img.naturalHeight || unrotH;
            const fitScale = Math.min(unrotW / natW, unrotH / natH);
            const drawW = natW * fitScale;
            const drawH = natH * fitScale;
            ctx.drawImage(
              img,
              rx + (unrotW - drawW) / 2,
              ry + (unrotH - drawH) / 2,
              drawW,
              drawH
            );
          } catch (err) {
            console.warn('Skipped unrenderable image annotation:', err);
          }
        }
      }
      ctx.restore();
    }

    if (watermark && watermark.enabled && watermark.text.trim()) {
      ctx.save();
      ctx.globalAlpha = watermark.opacity;
      ctx.fillStyle = watermark.color;
      ctx.font = `bold ${watermark.fontSize * ratio}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const baseStep = Math.max(120, watermark.spacing) * ratio;
      const measuredW = ctx.measureText(watermark.text).width;
      const angleRad = (watermark.angle * Math.PI) / 180;
      const stepX = Math.max(baseStep, Math.abs(measuredW * Math.cos(angleRad)) + 84 * ratio);
      const stepY = Math.max(baseStep, watermark.fontSize * 3.2 * ratio);

      for (let wx = 60 * ratio; wx < canvas.width + stepX; wx += stepX) {
        for (let wy = 60 * ratio; wy < canvas.height + stepY; wy += stepY) {
          ctx.save();
          ctx.translate(wx, wy);
          ctx.rotate(angleRad);
          ctx.fillText(watermark.text, 0, 0);
          ctx.restore();
        }
      }
      ctx.restore();
    }

    const mimeType = options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const blob: Blob | null = await new Promise((res) => {
      canvas.toBlob((b) => res(b), mimeType, options.quality ?? 0.92);
    });

    if (blob) {
      const ext = options.format === 'jpeg' ? 'jpg' : 'png';
      const imgFileName = `page_${String(pageNum).padStart(3, '0')}.${ext}`;
      imageBlobs.push({ name: imgFileName, blob });
      zip.file(imgFileName, blob);
    }
  }

  const prefix = options.baseName || 'pdf_export';
  if (imageBlobs.length === 1) {
    const ext = options.format === 'jpeg' ? 'jpg' : 'png';
    return await downloadFile(imageBlobs[0].blob, `${prefix}_p${targetIndices[0] + 1}.${ext}`);
  }
  if (imageBlobs.length > 1) {
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return await downloadFile(zipBlob, `${prefix}_images.zip`);
  }
  return 'cancelled';
}
