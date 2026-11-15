import { extractStructuredPdfPages } from './pdfTextExtractor';
import type { Annotation, PageMetadata } from '../../types/pdf';

export async function extractPdfTextAndMarkdown(
  pdfBytes: Uint8Array,
  pages?: PageMetadata[],
  annotations: Annotation[] = [],
  exportPageNumbers?: number[]
): Promise<{ text: string; markdown: string }> {
  const extractedPages = await extractStructuredPdfPages(
    pdfBytes,
    pages,
    annotations,
    exportPageNumbers
  );

  let plainText = '';
  let markdownText = '';

  for (const page of extractedPages) {
    plainText += `--- [Page ${page.pageNumber}] ---\n\n`;
    markdownText += `${markdownText ? '\n' : ''}## Page ${page.pageNumber}\n\n`;

    for (const line of page.lines) {
      if (!line.text) continue;
      plainText += `${line.text}\n`;

      if (line.maxFontSize >= 22) {
        markdownText += `# ${line.text}\n\n`;
      } else if (line.maxFontSize >= 15) {
        markdownText += `### ${line.text}\n\n`;
      } else {
        markdownText += `${line.text}\n\n`;
      }
    }
  }

  return { text: plainText.trim(), markdown: markdownText.trim() };
}
