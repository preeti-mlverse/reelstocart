import { describe, it, expect } from "vitest";
import { detectMediaType } from "../src/filesig.js";
import { validateUpload } from "../src/media/upload.js";

const bytes = (...a: number[]) => new Uint8Array([...a, ...new Array(16).fill(0)]);
const withAscii = (prefixLen: number, s: string) => {
  const arr = new Uint8Array(32);
  for (let i = 0; i < s.length; i++) arr[prefixLen + i] = s.charCodeAt(i);
  return arr;
};

describe("detectMediaType", () => {
  it("detects JPEG", () => expect(detectMediaType(bytes(0xff, 0xd8, 0xff))?.mime).toBe("image/jpeg"));
  it("detects PNG", () =>
    expect(detectMediaType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.mime).toBe("image/png"));
  it("detects WEBP", () => {
    const b = new Uint8Array(16);
    "RIFF".split("").forEach((c, i) => (b[i] = c.charCodeAt(0)));
    "WEBP".split("").forEach((c, i) => (b[8 + i] = c.charCodeAt(0)));
    expect(detectMediaType(b)?.mime).toBe("image/webp");
  });
  it("detects mp4 via ftyp", () => {
    const b = withAscii(4, "ftypisom");
    expect(detectMediaType(b)?.kind).toBe("video");
  });
  it("detects HEIC via ftyp brand", () => {
    const b = withAscii(4, "ftypheic");
    expect(detectMediaType(b)).toEqual({ kind: "image", mime: "image/heic" });
  });
  it("rejects a spoofed text file", () => {
    const b = new TextEncoder().encode("GIF89a this is not allowed here!!");
    expect(detectMediaType(b)).toBeNull();
  });
});

describe("validateUpload", () => {
  const limits = { maxUploadBytes: 1000, maxImageDimension: 8000, maxVideoDurationSeconds: 120, maxVideoFrames: 1800 };
  it("accepts a small JPEG", () => {
    expect(validateUpload(bytes(0xff, 0xd8, 0xff), limits)).toMatchObject({ ok: true, kind: "image" });
  });
  it("rejects empty", () => expect(validateUpload(new Uint8Array(0), limits).ok).toBe(false));
  it("rejects oversize", () => {
    const big = new Uint8Array(2000);
    big.set([0xff, 0xd8, 0xff]);
    expect(validateUpload(big, limits)).toMatchObject({ ok: false, reason: "file_too_large" });
  });
  it("rejects spoofed type", () => {
    expect(validateUpload(new TextEncoder().encode("<?php echo 1; ?>        "), limits).ok).toBe(false);
  });
});
