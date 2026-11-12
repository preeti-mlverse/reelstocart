import { describe, it, expect } from "vitest";
import {
  validateRemoteUrl, isPrivateIpv4, isPrivateIpv6, assertResolvedIpAllowed, DEFAULT_REMOTE_POLICY,
} from "../src/ssrf.js";

describe("isPrivateIpv4", () => {
  it.each(["10.0.0.1", "127.0.0.1", "169.254.1.1", "172.16.5.4", "192.168.1.1", "100.64.0.1", "0.0.0.0"])(
    "flags %s as private",
    (ip) => expect(isPrivateIpv4(ip)).toBe(true)
  );
  it.each(["8.8.8.8", "1.1.1.1", "201.18.219.164", "172.32.0.1"])(
    "allows public %s",
    (ip) => expect(isPrivateIpv4(ip)).toBe(false)
  );
});

describe("isPrivateIpv6", () => {
  it("flags loopback/link-local/ula", () => {
    expect(isPrivateIpv6("::1")).toBe(true);
    expect(isPrivateIpv6("fe80::1")).toBe(true);
    expect(isPrivateIpv6("fd12::1")).toBe(true);
    expect(isPrivateIpv6("::ffff:10.0.0.1")).toBe(true);
  });
  it("allows public v6", () => expect(isPrivateIpv6("2404:6800:4007::1")).toBe(false));
});

describe("validateRemoteUrl", () => {
  it("rejects non-https by default", () => {
    expect(validateRemoteUrl("http://example.com/a.jpg").ok).toBe(false);
  });
  it("rejects loopback and private literals", () => {
    expect(validateRemoteUrl("https://127.0.0.1/x").ok).toBe(false);
    expect(validateRemoteUrl("https://192.168.0.5/x").ok).toBe(false);
    expect(validateRemoteUrl("https://localhost/x").ok).toBe(false);
    expect(validateRemoteUrl("https://[::1]/x").ok).toBe(false);
  });
  it("rejects .local and .internal", () => {
    expect(validateRemoteUrl("https://db.internal/x").ok).toBe(false);
  });
  it("accepts a public https image url and strips credentials", () => {
    const r = validateRemoteUrl("https://user:pass@images.example.com/a.jpg?w=5#frag");
    expect(r.ok).toBe(true);
    expect(r.normalized).toBe("https://images.example.com/a.jpg?w=5");
  });
  it("honours host allowlist", () => {
    const policy = { ...DEFAULT_REMOTE_POLICY, hostAllowlist: [".cdn.example.com"] };
    expect(validateRemoteUrl("https://img.cdn.example.com/a.jpg", policy).ok).toBe(true);
    expect(validateRemoteUrl("https://evil.com/a.jpg", policy).ok).toBe(false);
  });
  it("allows localhost when policy permits (dev)", () => {
    expect(validateRemoteUrl("http://localhost:9000/a.jpg", { schemes: ["http"], allowLocalhost: true }).ok).toBe(true);
  });
});

describe("assertResolvedIpAllowed", () => {
  it("blocks DNS-rebinding to private IP", () => {
    expect(assertResolvedIpAllowed("10.0.0.5").ok).toBe(false);
    expect(assertResolvedIpAllowed("8.8.8.8").ok).toBe(true);
  });
});
