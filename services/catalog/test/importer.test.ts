import { describe, it, expect } from "vitest";
import { parseCsv } from "../src/csv";
import { parseFeed, validateAndNormalize } from "../src/importer";
import { normalizeCategory, parseSizes, normalizeAvailability } from "../src/mappers";

const CSV = `source_id,title,category,product_url,image,color,sizes,price_inr
A1,"Red, A-line Dress",dresses,https://e.com/a1,https://img.co/a1,red,S|M,1500
A2,Blue Top,top,https://e.com/a2,https://img.co/a2,blue,M,700
A3,Bad Item,sarong,https://e.com/a3,https://img.co/a3,pink,S,500
A4,No Image,top,https://e.com/a4,,white,S,400
A1,Dup,dresses,https://e.com/a1,https://img.co/dup,red,S,1500`;

describe("parseCsv", () => {
  it("handles quoted commas", () => {
    const rows = parseCsv(CSV);
    expect(rows).toHaveLength(5);
    expect(rows[0]!.title).toBe("Red, A-line Dress");
  });
});

describe("normalizeCategory", () => {
  it("maps synonyms and rejects unknowns", () => {
    expect(normalizeCategory("dresses")).toBe("dress");
    expect(normalizeCategory("denim")).toBe("jeans");
    expect(normalizeCategory("Co-ord Set")).toBe("co_ord_set");
    expect(normalizeCategory("sarong")).toBeNull();
  });
});

describe("validateAndNormalize", () => {
  const rows = parseFeed(CSV, "csv");
  const res = validateAndNormalize(rows, "feedbrand");

  it("accepts valid rows and normalizes category", () => {
    expect(res.products.map((p) => p.source_id)).toEqual(["A1", "A2"]);
    expect(res.products[0]!.category).toBe("dress");
    expect(res.products[0]!.sizes).toEqual(["S", "M"]);
  });
  it("rejects unmappable category and missing image with reasons", () => {
    const reasons = res.errors.map((e) => `${e.source_id}:${e.reason}`);
    expect(reasons.some((r) => r.startsWith("A3:") && r.includes("category"))).toBe(true);
    expect(reasons.some((r) => r.startsWith("A4:") && r.includes("image"))).toBe(true);
  });
  it("counts duplicates (same source_id)", () => {
    expect(res.duplicates).toBe(1);
    expect(res.total).toBe(5);
  });
});

describe("parseFeed json", () => {
  it("reads a JSON array and arrays join to pipes", () => {
    const json = JSON.stringify([{ source_id: "J1", title: "T", category: "top",
      product_url: "https://e.com/j1", image: "https://img.co/j1", sizes: ["S", "M"] }]);
    const rows = parseFeed(json, "json");
    const res = validateAndNormalize(rows, "m");
    expect(res.products[0]!.sizes).toEqual(["S", "M"]);
  });
});

describe("helpers", () => {
  it("parseSizes splits on common delimiters", () => expect(parseSizes("S | M/L;XL")).toEqual(["S", "M", "L", "XL"]));
  it("normalizeAvailability maps variants", () => {
    expect(normalizeAvailability("in stock")).toBe("in_stock");
    expect(normalizeAvailability("OOS")).toBe("out_of_stock");
    expect(normalizeAvailability("")).toBe("unverified");
  });
});
