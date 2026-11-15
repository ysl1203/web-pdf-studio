declare global {
  interface Window {
    pywebview?: {
      api?: {
        save_file_dialog?: (
          filename: string,
          base64Data: string
        ) => Promise<{ status: string; path?: string; message?: string }>;
      };
    };
  }
}

export type DownloadOutcome = 'saved' | 'cancelled';

/** Convert Blob to base64 efficiently using FileReader without slow byte-by-byte string concatenation. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const commaIdx = result.indexOf(',');
        resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
      } else {
        reject(new Error('Failed to encode blob as base64'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Reliable file download & export helper.
 * 1. Inside Windows .exe (pywebview), triggers the native Windows File Save Dialog via Python API.
 * 2. In web browsers, triggers standard Blob object URL download.
 */
export async function downloadFile(blob: Blob, fileName: string): Promise<DownloadOutcome> {
  if (window.pywebview?.api?.save_file_dialog) {
    try {
      const base64Data = await blobToBase64(blob);
      const result = await window.pywebview.api.save_file_dialog(fileName, base64Data);
      if (result?.status === 'ok') {
        return 'saved';
      }
      if (result?.status === 'cancelled') {
        return 'cancelled';
      }
    } catch (err) {
      console.warn('Native desktop save dialog failed, falling back to browser download:', err);
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1500);
  return 'saved';
}
