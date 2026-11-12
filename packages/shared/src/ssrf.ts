/**
 * SSRF defence for remote URL ingestion (Phase 2 security).
 * Pure functions, no network — safe to unit-test. The network fetch layer
 * MUST additionally re-check the DNS-resolved IP and block private redirects.
 */

export interface UrlPolicy {
  /** allowed URL schemes */
  schemes: string[];
  /** when true, localhost/loopback hosts are allowed (dev only) */
  allowLocalhost: boolean;
  /** optional host allowlist (exact host or suffix match with leading dot) */
  hostAllowlist?: string[];
}

export const DEFAULT_REMOTE_POLICY: UrlPolicy = {
  schemes: ["https"],
  allowLocalhost: false,
};

export interface ValidationResult {
  ok: boolean;
  reason?: string;
  normalized?: string;
}

const PRIVATE_V4 = [
  [10, 0, 0, 0, 8],
  [127, 0, 0, 0, 8], // loopback
  [169, 254, 0, 0, 16], // link-local
  [172, 16, 0, 0, 12],
  [192, 168, 0, 0, 16],
  [100, 64, 0, 0, 10], // CGNAT
  [0, 0, 0, 0, 8], // this-network
] as const;

function ipv4ToInt(a: number, b: number, c: number, d: number): number {
  return ((a << 24) >>> 0) + (b << 16) + (c << 8) + d;
}

export function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return false;
  const val = ipv4ToInt(parts[0]!, parts[1]!, parts[2]!, parts[3]!);
  return PRIVATE_V4.some(([a, b, c, d, bits]) => {
    const base = ipv4ToInt(a, b, c, d);
    const mask = (~0 << (32 - bits)) >>> 0; // bits is 8..16 here, never 0
    return (val & mask) === (base & mask);
  });
}

export function isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "::1" || h === "::") return true; // loopback / unspecified
  if (h.startsWith("fe80")) return true; // link-local
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique-local fc00::/7
  // IPv4-mapped (::ffff:a.b.c.d)
  const m = h.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (m) return isPrivateIpv4(m[1]!);
  return false;
}

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function hostAllowed(host: string, allow?: string[]): boolean {
  if (!allow || allow.length === 0) return true;
  const h = host.toLowerCase();
  return allow.some((a) => {
    const al = a.toLowerCase();
    return al.startsWith(".") ? h === al.slice(1) || h.endsWith(al) : h === al;
  });
}

/** Validate a URL string against a policy. Does NOT perform DNS resolution. */
export function validateRemoteUrl(raw: string, policy: UrlPolicy = DEFAULT_REMOTE_POLICY): ValidationResult {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "malformed_url" };
  }
  const scheme = u.protocol.replace(":", "");
  if (!policy.schemes.includes(scheme)) return { ok: false, reason: `scheme_not_allowed:${scheme}` };

  const host = u.hostname.toLowerCase();

  if (LOCAL_HOSTNAMES.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    if (!policy.allowLocalhost) return { ok: false, reason: "local_host_blocked" };
  }
  // literal IPs: block private ranges
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (isPrivateIpv4(host) && !policy.allowLocalhost) return { ok: false, reason: "private_ipv4_blocked" };
  }
  if (host.includes(":") || u.hostname.startsWith("[")) {
    if (isPrivateIpv6(u.hostname) && !policy.allowLocalhost) return { ok: false, reason: "private_ipv6_blocked" };
  }
  if (!hostAllowed(host, policy.hostAllowlist)) return { ok: false, reason: "host_not_allowlisted" };

  // strip credentials & fragments; keep query for image CDNs
  u.username = "";
  u.password = "";
  u.hash = "";
  return { ok: true, normalized: u.toString() };
}

/** Guard to call AFTER DNS resolution with the resolved IP(s). */
export function assertResolvedIpAllowed(ip: string, policy: UrlPolicy = DEFAULT_REMOTE_POLICY): ValidationResult {
  if (policy.allowLocalhost) return { ok: true };
  if (ip.includes(".") && isPrivateIpv4(ip)) return { ok: false, reason: "resolved_private_ipv4" };
  if (ip.includes(":") && isPrivateIpv6(ip)) return { ok: false, reason: "resolved_private_ipv6" };
  return { ok: true };
}
