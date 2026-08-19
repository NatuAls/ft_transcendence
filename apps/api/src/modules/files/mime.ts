import { fileTypeFromBuffer } from 'file-type';

/** MIME allow-list. Checked against real magic bytes, never the extension. */
export const ALLOWED = new Map<string, string>([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['application/pdf', 'pdf'],
  ['application/zip', 'zip'],
]);

/** Types with no magic bytes at all; validated by content sniffing instead. */
export const TEXT_TYPES = new Map<string, string>([
  ['text/plain', 'txt'],
  ['text/markdown', 'md'],
  ['text/csv', 'csv'],
  ['application/json', 'json'],
]);

/** Control characters that must not appear in something we accept as text. */
// eslint-disable-next-line no-control-regex
const BINARY_MARKER = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;

export async function detectMime(
  buffer: Buffer,
  declared: string,
): Promise<string> {
  const detected = await fileTypeFromBuffer(buffer);
  if (detected) return detected.mime;

  // No signature at all: only accept it if the content really looks like text
  // and the client declared a text type we allow.
  if (TEXT_TYPES.has(declared)) {
    const sample = buffer.subarray(0, 4096).toString('utf8');
    if (!BINARY_MARKER.test(sample)) return declared;
  }
  return 'application/octet-stream';
}
