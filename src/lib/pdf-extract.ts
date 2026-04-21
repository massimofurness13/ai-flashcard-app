/**
 * Client-side PDF text extraction. Uses pdfjs-dist dynamically imported
 * so the library's ~400kb bundle doesn't ship until the user actually
 * picks a PDF. Worker is disabled (useWorkerFetch: false + GlobalWorker
 * unset) so we don't have to wire up a separate worker file in Next.
 */

const MAX_PAGES = 50; // keep UI responsive; most lesson/chapter PDFs fit

export interface PdfExtractResult {
  text: string;
  pages: number;
  truncated: boolean;
}

export async function extractPdfText(file: File): Promise<PdfExtractResult> {
  const pdfjs = await import("pdfjs-dist");
  // Running without a worker: slower but simpler. Fine for interactive use.
  pdfjs.GlobalWorkerOptions.workerSrc = "";

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    // Prevent network fetches inside the worker for fonts/cmaps
    disableFontFace: true,
    useSystemFonts: true,
  }).promise;

  const pages = Math.min(doc.numPages, MAX_PAGES);
  const texts: string[] = [];

  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      // TextItem has `.str`; TextMarkedContent doesn't — filter those out
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean)
      .join(" ");
    texts.push(pageText);
  }

  return {
    text: texts.join("\n\n").trim(),
    pages,
    truncated: doc.numPages > MAX_PAGES,
  };
}
