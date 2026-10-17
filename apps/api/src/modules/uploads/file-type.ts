// Identifies an upload from its leading bytes, so a file's claimed type
// (browser-supplied and easy to fake) is checked against what it really is.
// Only the types uploads accept are recognised; anything else returns null.

const DOC_MIME = "application/msword";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function detectFileType(buffer: Buffer): string | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  if (ascii(buffer, 0, 4) === "RIFF" && ascii(buffer, 8, 12) === "WEBP") {
    return "image/webp";
  }

  // ISO media "ftyp" box with an AVIF brand.
  if (ascii(buffer, 4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(buffer, 8, 12))) {
    return "image/avif";
  }

  if (ascii(buffer, 0, 5) === "%PDF-") {
    return "application/pdf";
  }

  // OLE compound file, the container of legacy .doc files.
  if (startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return DOC_MIME;
  }

  // A .docx is a ZIP archive whose entries include the Word document parts.
  if (
    startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) &&
    buffer.includes("[Content_Types].xml") &&
    buffer.includes("word/")
  ) {
    return DOCX_MIME;
  }

  return null;
}

function startsWith(buffer: Buffer, bytes: number[]) {
  return buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);
}

function ascii(buffer: Buffer, start: number, end: number) {
  return buffer.length >= end ? buffer.toString("latin1", start, end) : "";
}
