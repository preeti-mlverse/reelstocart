/**
 * Magic-byte file-type detection (Phase 2). Never trust the client Content-Type
 * or extension. Returns the real type or null if it is not an allowed media file.
 */
export type DetectedType =
  | { kind: "image"; mime: "image/jpeg" | "image/png" | "image/webp" | "image/heic" }
  | { kind: "video"; mime: "video/mp4" | "video/quicktime" | "video/webm" };

const startsWith = (buf: Uint8Array, sig: number[], offset = 0) =>
  sig.every((b, i) => buf[offset + i] === b);

const ascii = (buf: Uint8Array, s: string, offset = 0) =>
  [...s].every((c, i) => buf[offset + i] === c.charCodeAt(0));

export function detectMediaType(buf: Uint8Array): DetectedType | null {
  if (buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { kind: "image", mime: "image/jpeg" };
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { kind: "image", mime: "image/png" };
  // WEBP: "RIFF"...."WEBP"
  if (ascii(buf, "RIFF") && ascii(buf, "WEBP", 8)) return { kind: "image", mime: "image/webp" };
  // WEBM / Matroska: 1A 45 DF A3
  if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) return { kind: "video", mime: "video/webm" };

  // ISO-BMFF (mp4/mov/heic): size(4) + 'ftyp' + brand
  if (ascii(buf, "ftyp", 4)) {
    const brand = String.fromCharCode(buf[8]!, buf[9]!, buf[10]!, buf[11]!);
    const b = brand.toLowerCase();
    if (b.startsWith("qt")) return { kind: "video", mime: "video/quicktime" };
    if (b.startsWith("hei") || b.startsWith("hev") || b === "mif1" || b === "msf1")
      return { kind: "image", mime: "image/heic" };
    // isom / mp42 / mp41 / avc1 / dash / iso2 etc.
    return { kind: "video", mime: "video/mp4" };
  }
  return null;
}

export const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const;
export const ALLOWED_VIDEO_MIMES = ["video/mp4", "video/quicktime", "video/webm"] as const;
