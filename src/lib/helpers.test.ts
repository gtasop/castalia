import { describe, expect, it } from "vitest";
import { contentDisposition, parseRange, safeFileName } from "./http";
import { checkAmount, parseEuroInput } from "./money";
import { safeNext } from "./redirect";
import { albumSearchText, escapeLike, searchKey } from "./search";
import { charCount, cleanBlock, cleanLine, firstGrapheme, sliceChars } from "./text";

describe("parseEuroInput", () => {
  it("accepts plain amounts with . or , decimals", () => {
    expect(parseEuroInput("7")).toBe(700);
    expect(parseEuroInput("7.5")).toBe(750);
    expect(parseEuroInput("7,50")).toBe(750);
    expect(parseEuroInput(" € 7.50 ")).toBe(750);
    expect(parseEuroInput("0")).toBe(0);
  });
  it("refuses anything ambiguous or exotic", () => {
    for (const v of ["1,000", "1.000,50", "1e3", "0x10", "0b101", "4.995", "-5", "abc", "", "٧", "７", "Infinity", "12345678"]) {
      expect(parseEuroInput(v), v).toBeNull();
    }
  });
  it("checkAmount explains each failure", () => {
    expect(checkAmount("4.99", 500, 10000, "amount").error).toMatch(/minimum/);
    expect(checkAmount("100.01", 500, 10000, "amount").error).toMatch(/maximum/);
    expect(checkAmount("x", 500, 10000, "amount").error).toMatch(/for example/);
    expect(checkAmount("8", 500, 10000).cents).toBe(800);
  });
});

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/studio")).toBe("/studio");
    expect(safeNext("/album/abc?x=1#d")).toBe("/album/abc?x=1#d");
  });
  it("blocks every way off the site", () => {
    for (const v of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "https://evil.com", "javascript:alert(1)", "evil.com", "", null, "/%09/evil.com/x"]) {
      const out = safeNext(v);
      expect(new URL(out, "http://castalia.invalid").origin, String(v)).toBe("http://castalia.invalid");
    }
    expect(safeNext("/\t/evil.com")).toBe("/");
  });
});

describe("parseRange", () => {
  const size = 1000;
  it("follows RFC 9110", () => {
    expect(parseRange("bytes=0-0", size)).toEqual({ start: 0, end: 0 });
    expect(parseRange("bytes=-1", size)).toEqual({ start: 999, end: 999 });
    expect(parseRange("bytes=-5000", size)).toEqual({ start: 0, end: 999 });
    expect(parseRange("bytes=990-5000", size)).toEqual({ start: 990, end: 999 });
    expect(parseRange("bytes=-0", size)).toBe("unsatisfiable");
    expect(parseRange("bytes=1000-", size)).toBe("unsatisfiable");
    expect(parseRange("bytes=5-2", size)).toBeNull();
    expect(parseRange("bytes=0-1,5-6", size)).toBeNull();
    expect(parseRange("garbage", size)).toBeNull();
    expect(parseRange(null, size)).toBeNull();
  });
});

describe("download names", () => {
  it("contentDisposition carries any script and stays header-safe", () => {
    const h = contentDisposition("01 Echo — Don’t Stop € Καστάλια 音乐.flac");
    expect(h).toMatch(/^attachment; filename="[\x20-\x7E]+"; filename\*=UTF-8''[A-Za-z0-9%._~!-]+$/);
    expect(decodeURIComponent(h.split("UTF-8''")[1])).toBe("01 Echo — Don’t Stop € Καστάλια 音乐.flac");
    expect(() => new Headers({ "Content-Disposition": h })).not.toThrow();
  });
  it("safeFileName is valid everywhere", () => {
    expect(safeFileName("Tab\u0007Bell")).toBe("TabBell");
    expect(safeFileName('a/b\\c:*?"<>|d')).toBe("abcd");
    expect(safeFileName("name. ")).toBe("name");
    expect(safeFileName("CON")).toBe("_CON");
    expect(safeFileName("👩🏽‍🎤".repeat(200)).length).toBeGreaterThan(0);
    expect(safeFileName("   ")).toBe("track");
  });
});

describe("text cleaning", () => {
  it("removes control and spoofing characters but keeps real text", () => {
    expect(cleanLine("  Hello\u0000 ‮world​ ", 100)).toBe("Hello world");
    expect(cleanLine("Καστάλια 音乐 👩🏽‍🎤 מוזיקה", 100)).toBe("Καστάλια 音乐 👩🏽‍🎤 מוזיקה");
    expect(cleanLine("a\nb\tc", 100)).toBe("a b c");
    expect(cleanBlock("a\r\n\n\n\nb", 100)).toBe("a\n\nb");
    expect(cleanLine("é", 10)).toBe("é");
  });
  it("never splits a character", () => {
    expect(sliceChars("👩🏽‍🎤👩🏽‍🎤", 1)).toBe("👩🏽‍🎤");
    expect(charCount("🇬🇷é")).toBe(2);
    expect(firstGrapheme(" ​🇬🇷 Greece")).toBe("🇬🇷");
    expect(firstGrapheme("İstanbul")).toBe("İ");
    expect(firstGrapheme("...")).toBe("");
  });
});

describe("search", () => {
  it("ignores case and accents", () => {
    expect(searchKey("Café")).toBe(searchKey("CAFE"));
    expect(searchKey("Straße")).toBe("strasse");
    expect(searchKey("ΚΑΣΤΑΛΙΑΣ")).toBe(searchKey("Καστάλιας"));
    expect(albumSearchText("Ωδή", "Échő")).toBe("ωδη echo");
  });
  it("escapes LIKE wildcards", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});
