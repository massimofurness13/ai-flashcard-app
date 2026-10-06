import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ getDocument: vi.fn(), getPage: vi.fn(), destroy: vi.fn(), cleanup: vi.fn(), worker: { workerSrc: "" } }));
vi.mock("pdfjs-dist", () => ({ version: "6.4.299", GlobalWorkerOptions: mock.worker, getDocument: mock.getDocument }));
import { extractPdfText } from "@/lib/pdf-extract";
const file = new File(["fixture"], "lesson.pdf", { type: "application/pdf" });
beforeEach(() => {
  vi.clearAllMocks();
  mock.getPage.mockResolvedValue({ getTextContent: async () => ({ items: [{ str: "Hola" }, { type: "mark" }, { str: "Hello" }] }), cleanup: mock.cleanup });
  mock.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 1, getPage: mock.getPage }), destroy: mock.destroy });
});
describe("PDF text import", () => {
  it("loads the matching local worker and extracts text without worker network fetches", async () => {
    expect(await extractPdfText(file)).toEqual({ text: "Hola Hello", pages: 1, truncated: false });
    expect(mock.worker.workerSrc).toBe("/pdf.worker.6.4.299.min.mjs");
    expect(mock.getDocument.mock.calls[0][0]).toMatchObject({ useWorkerFetch: false });
    expect(mock.destroy).toHaveBeenCalledOnce();
    expect(mock.cleanup).toHaveBeenCalledOnce();
  });
  it("caps large documents at 50 pages", async () => {
    mock.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 100, getPage: mock.getPage }), destroy: mock.destroy });
    expect(await extractPdfText(file)).toMatchObject({ pages: 50, truncated: true });
    expect(mock.getPage).toHaveBeenCalledTimes(50);
    expect(mock.destroy).toHaveBeenCalledOnce();
  });
  it("releases the worker after corrupt documents", async () => {
    mock.getPage.mockRejectedValue(new Error("Invalid PDF"));
    await expect(extractPdfText(file)).rejects.toThrow("Invalid PDF");
    expect(mock.destroy).toHaveBeenCalledOnce();
  });
});
