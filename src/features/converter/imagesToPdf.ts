import { PDFDocument } from 'pdf-lib';

export interface ImageToPdfOptions {
  pageSize?: 'a4' | 'fit';
  margin?: number; // in points
}

async function rasterizeImageToPng(file: File): Promise<Uint8Array> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Unable to acquire 2D canvas context');
      ctx.drawImage(bitmap, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Canvas PNG conversion failed');
      return new Uint8Array(await blob.arrayBuffer());
    } finally {
      bitmap.close();
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`无法解码图片文件: ${file.name}`));
      img.src = objectUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to acquire 2D canvas context');
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Canvas PNG conversion failed');
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function convertImagesToPdf(
  imageFiles: File[],
  options: ImageToPdfOptions = { pageSize: 'a4', margin: 20 }
): Promise<Uint8Array> {
  if (imageFiles.length === 0) {
    throw new Error('请至少选择一张图片');
  }

  const pdfDoc = await PDFDocument.create();
  const margin = options.margin ?? 20;

  for (const file of imageFiles) {
    const lowerName = file.name.toLowerCase();
    const isPng = file.type === 'image/png' || lowerName.endsWith('.png');

    let embeddedImage;
    if (isPng) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      embeddedImage = await pdfDoc.embedPng(bytes);
    } else {
      // Rasterize JPEG/WebP/BMP/GIF via ImageBitmap so EXIF orientation and formats are normalized cleanly
      const pngBytes = await rasterizeImageToPng(file);
      embeddedImage = await pdfDoc.embedPng(pngBytes);
    }

    const { width: imgW, height: imgH } = embeddedImage;

    let pageWidth: number;
    let pageHeight: number;
    let drawX: number;
    let drawY: number;
    let drawW: number;
    let drawH: number;

    if (options.pageSize === 'fit') {
      pageWidth = imgW + margin * 2;
      pageHeight = imgH + margin * 2;
      drawX = margin;
      drawY = margin;
      drawW = imgW;
      drawH = imgH;
    } else {
      pageWidth = 595.28;
      pageHeight = 841.89;
      const availW = Math.max(10, pageWidth - margin * 2);
      const availH = Math.max(10, pageHeight - margin * 2);
      const fitScale = Math.min(availW / imgW, availH / imgH);
      drawW = imgW * fitScale;
      drawH = imgH * fitScale;
      drawX = (pageWidth - drawW) / 2;
      drawY = (pageHeight - drawH) / 2;
    }

    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    page.drawImage(embeddedImage, {
      x: drawX,
      y: drawY,
      width: drawW,
      height: drawH,
    });
  }

  return await pdfDoc.save();
}
