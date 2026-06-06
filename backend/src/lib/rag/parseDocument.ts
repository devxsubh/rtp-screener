// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;
import mammoth from "mammoth";

export type ParsedPage = { pageNum: number | null; text: string };

export async function parseDocumentToText(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<ParsedPage[]> {
  const mime = mimeType.toLowerCase();
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (mime === "application/pdf" || ext === "pdf") {
    return parsePdf(buffer);
  }

  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/msword" ||
    ext === "docx" ||
    ext === "doc"
  ) {
    return parseDocx(buffer);
  }

  if (mime === "text/plain" || mime === "text/csv" || ext === "txt" || ext === "csv") {
    return [{ pageNum: null, text: buffer.toString("utf-8") }];
  }

  throw new Error(`Unsupported file type: ${mimeType} (${filename})`);
}

async function parsePdf(buffer: Buffer): Promise<ParsedPage[]> {
  const data = await pdfParse(buffer);
  const raw = data.text ?? "";

  // Split by form-feed character for rough page boundaries
  const pageSplits = raw.split(/\f/).filter((p: string) => p.trim().length > 0);
  if (pageSplits.length === 0) return [];

  return pageSplits.map((text: string, i: number) => ({ pageNum: i + 1, text: text.trim() }));
}

async function parseDocx(buffer: Buffer): Promise<ParsedPage[]> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.trim();
  if (!text) return [];
  return [{ pageNum: null, text }];
}
