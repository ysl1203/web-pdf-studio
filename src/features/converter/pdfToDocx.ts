import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table } from 'docx';
import { extractStructuredPdfPages } from './pdfTextExtractor';
import type { Annotation, PageMetadata } from '../../types/pdf';

export async function convertPdfToDocx(
  pdfBytes: Uint8Array,
  pages?: PageMetadata[],
  annotations: Annotation[] = [],
  exportPageNumbers?: number[]
): Promise<Blob> {
  const extractedPages = await extractStructuredPdfPages(
    pdfBytes,
    pages,
    annotations,
    exportPageNumbers
  );

  const docChildren: (Paragraph | Table)[] = [];

  extractedPages.forEach((pageContent, idx) => {
    if (idx > 0) {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `--- 第 ${pageContent.pageNumber} 页 ---`,
              color: '94A3B8',
              size: 18,
              italics: true,
            }),
          ],
          spacing: { before: 240, after: 120 },
        })
      );
    }

    for (const line of pageContent.lines) {
      if (!line.text) continue;

      if (line.maxFontSize >= 22) {
        docChildren.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [
              new TextRun({
                text: line.text,
                bold: true,
                size: line.maxFontSize * 2,
                color: '1E293B',
              }),
            ],
            spacing: { before: 260, after: 120 },
          })
        );
      } else if (line.maxFontSize >= 15) {
        docChildren.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: line.text,
                bold: true,
                size: line.maxFontSize * 2,
                color: '334155',
              }),
            ],
            spacing: { before: 180, after: 90 },
          })
        );
      } else {
        const textRuns: TextRun[] = [];
        for (let sIdx = 0; sIdx < line.spans.length; sIdx++) {
          const span = line.spans[sIdx];
          let runText = span.str;
          if (sIdx < line.spans.length - 1) {
            const next = line.spans[sIdx + 1];
            const gap = next.x - (span.x + span.width);
            if (gap > span.fontSize * 0.22 && !runText.endsWith(' ') && !next.str.startsWith(' ')) {
              runText += ' ';
            }
          }
          textRuns.push(
            new TextRun({
              text: runText,
              bold: span.bold,
              italics: span.italic,
              size: Math.max(20, span.fontSize * 2),
              color: '1E293B',
            })
          );
        }

        docChildren.push(
          new Paragraph({
            children: textRuns,
            spacing: { line: 276, before: 60, after: 60 },
          })
        );
      }
    }
  });

  const doc = new Document({
    creator: 'Web PDF Studio',
    title: 'Converted Document',
    description: 'Generated from PDF with Microsoft Word and WPS compatibility',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
