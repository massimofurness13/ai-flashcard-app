/**
 * Client-side PDF text extraction. Uses pdfjs-dist dynamically imported
 * so the library's ~400kb bundle doesn't ship until the user actually
 * picks a PDF. The matching worker is copied by predev/prebuild, keeping
 * parsing off the UI thread without fetching executable code from a CDN.
 */

const MAX_PAGES = 50; // keep UI responsive; most lesson/chapter PDFs fit

export interface PdfExtractResult {
  text: string;
  pages: number;
  truncated: boolean;
}

export async function extractPdfText(file: File): Promise<PdfExtractResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.${pdfjs.version}.min.mjs`;

  const buffer = await file.arrayBuffer();
  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    // Prevent network fetches inside the worker for fonts/cmaps
    disableFontFace: true,
    useSystemFonts: true,
    useWorkerFetch: false,
  });

  try {
    const doc = await task.promise;
    const pages = Math.min(doc.numPages, MAX_PAGES);
    const texts: string[] = [];

    for (let i = 1; i <= pages; i++) {
      const page = await doc.getPage(i);
      // PDF.js 6 uses ReadableStream's async iterator in getTextContent.
      // iOS WebKit supports getReader but may not implement that iterator.
      const reader = page.streamTextContent().getReader();
      const words: string[] = [];
      try {
        while (true) {
          const {value, done} = await reader.read();
          if (done) break;
          for (const item of value.items) if ("str" in item && item.str) words.push(item.str);
        }
      } finally { reader.releaseLock(); page.cleanup(); }
      texts.push(words.join(" "));
    }

    return { text: texts.join("\n\n").trim(), pages, truncated: doc.numPages > MAX_PAGES };
  } finally {
    await task.destroy();
  }
}
