import { pdfjsLib } from '../../utils/pdfWorker';
import { resolveAssetUrl } from '../../utils/assets';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export interface LoadPdfResult {
  pdf: PDFDocumentProxy;
  pageCount: number;
  encrypted: boolean;
}

// WeakMap cache keyed by the Uint8Array instance + password so multiple pages
// and thumbnail generators share one parsed PDFDocumentProxy without re-parsing.
const documentCache = new WeakMap<Uint8Array, Map<string, Promise<LoadPdfResult>>>();

/**
 * Loads a PDF document using pdf.js safely and shares the parsed proxy per Uint8Array ref.
 * Always clones bytes (bytes.slice()) before handing to the worker so the original
 * Uint8Array buffer in React state is never detached.
 */
export async function loadPdfDocument(
  bytes: Uint8Array,
  password?: string
): Promise<LoadPdfResult> {
  const cacheKey = password ?? '';
  let byPassword = documentCache.get(bytes);
  if (byPassword) {
    const existing = byPassword.get(cacheKey);
    if (existing) return existing;
  } else {
    byPassword = new Map();
    documentCache.set(bytes, byPassword);
  }

  const promise = (async (): Promise<LoadPdfResult> => {
    const clonedBytes = bytes.slice();
    const loadingTask = pdfjsLib.getDocument({
      data: clonedBytes,
      password: password || undefined,
      cMapUrl: resolveAssetUrl('pdfjs/cmaps/'),
      cMapPacked: true,
      standardFontDataUrl: resolveAssetUrl('pdfjs/standard_fonts/'),
    });

    const pdf = await loadingTask.promise;
    return {
      pdf,
      pageCount: pdf.numPages,
      encrypted: Boolean(password),
    };
  })().catch((err) => {
    // Do not cache failed loads (e.g. incorrect password)
    byPassword?.delete(cacheKey);
    throw err;
  });

  byPassword.set(cacheKey, promise);
  return promise;
}
