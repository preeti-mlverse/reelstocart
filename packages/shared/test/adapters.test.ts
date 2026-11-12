import { describe, it, expect } from "vitest";
import { createInstagramAdapter } from "../src/media/instagram.js";
import { createYouTubeAdapter } from "../src/media/youtube.js";
import { createDirectImageAdapter } from "../src/media/directImage.js";
import { createUploadAdapter } from "../src/media/upload.js";

describe("instagram adapter", () => {
  const ig = createInstagramAdapter({ oEmbedEnabled: false });
  it("accepts a reel url and normalizes it", () => {
    const r = ig.validateUrl("https://instagram.com/reel/AbC123_-x/?igsh=xyz");
    expect(r.ok).toBe(true);
    expect(ig.normalizeUrl("https://instagram.com/reel/AbC123_-x/")).toBe("https://www.instagram.com/reel/AbC123_-x/");
  });
  it("rejects non-instagram", () => expect(ig.validateUrl("https://example.com/reel/x").ok).toBe(false));
  it("is PREVIEW_ONLY with upload fallback and no permitted media", async () => {
    expect((await ig.checkAccess("")).status).toBe("PREVIEW_ONLY");
    expect((await ig.getPermittedMedia("")).images).toHaveLength(0);
    expect(ig.returnFallbackInstructions().required).toBe(true);
    expect(ig.getCapabilities().originalMediaProcessingPermitted).toBe(false);
  });
});

describe("youtube adapter", () => {
  const yt = createYouTubeAdapter({ oEmbedEnabled: true });
  it("parses shorts, watch, and youtu.be", () => {
    expect(yt.normalizeUrl("https://www.youtube.com/shorts/abc123DEF_-")).toBe("https://www.youtube.com/shorts/abc123DEF_-");
    expect(yt.normalizeUrl("https://youtu.be/abc123DEF_-")).toBe("https://www.youtube.com/watch?v=abc123DEF_-");
    expect(yt.normalizeUrl("https://www.youtube.com/watch?v=abc123DEF_-&t=5")).toBe("https://www.youtube.com/watch?v=abc123DEF_-");
  });
  it("never permits stream processing", async () => {
    expect((await yt.checkAccess("")).status).toBe("PREVIEW_ONLY");
    expect(yt.getCapabilities().frameExtractionAvailable).toBe(false);
    const p = await yt.getPreview("https://www.youtube.com/shorts/abc123DEF_-");
    expect(p.type).toBe("embed_html");
    expect(p.embedHtml).toContain("youtube.com/embed/abc123DEF_-");
  });
});

describe("direct image adapter", () => {
  const di = createDirectImageAdapter();
  it("accepts public https image, blocks SSRF", async () => {
    expect(di.validateUrl("https://images.example.com/a.jpg").ok).toBe(true);
    expect((await di.checkAccess("https://127.0.0.1/a.jpg")).status).toBe("UNSUPPORTED");
    expect((await di.checkAccess("https://images.example.com/a.jpg")).status).toBe("MEDIA_ACCESSIBLE");
  });
});

describe("upload adapter", () => {
  const up = createUploadAdapter();
  it("accepts a media id and is immediately processable", async () => {
    expect(up.validateUrl("med_abc123").ok).toBe(true);
    expect(up.validateUrl("https://x.com").ok).toBe(false);
    expect((await up.checkAccess("med_abc123")).status).toBe("MEDIA_ACCESSIBLE");
    expect(up.getCapabilities().frameExtractionAvailable).toBe(true);
  });
});
