import fontkit from 'pdf-fontkit';
import { resolveAssetUrl } from '../../utils/assets';
import type { PDFDocument, PDFFont } from 'pdf-lib';

let regularFontBytes: Uint8Array | null = null;
let boldFontBytes: Uint8Array | null = null;

/**
 * Loads font bytes from public assets directory on demand.
 */
async function fetchFontBytes(url: string): Promise<Uint8Array> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to load font from ${url}: ${resp.statusText}`);
  }
  const buffer = await resp.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function getRegularFontBytes(): Promise<Uint8Array> {
  if (!regularFontBytes) {
    regularFontBytes = await fetchFontBytes(resolveAssetUrl('fonts/NotoSansSC-Regular.ttf'));
  }
  return regularFontBytes;
}

export async function getBoldFontBytes(): Promise<Uint8Array> {
  if (!boldFontBytes) {
    boldFontBytes = await fetchFontBytes(resolveAssetUrl('fonts/NotoSansSC-Bold.ttf'));
  }
  return boldFontBytes;
}

/**
 * Embeds Noto Sans SC (Regular or Bold) into the given PDFDocument with subsetting.
 * Caches embedded fonts per document instance.
 */
export async function embedCjkFont(
  doc: PDFDocument,
  bold: boolean = false
): Promise<PDFFont> {
  // Register fontkit plugin if not already registered
  try {
    doc.registerFontkit(fontkit);
  } catch {
    // already registered
  }

  const bytes = bold ? await getBoldFontBytes() : await getRegularFontBytes();
  return await doc.embedFont(bytes, { subset: true });
}
