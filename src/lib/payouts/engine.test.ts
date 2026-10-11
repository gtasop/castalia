import { describe, expect, it } from "vitest";
import { calculateRun, splitCents } from "./engine";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("splitCents", () => {
  it("always adds up to the total", () => {
    expect(splitCents(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(sum(splitCents(1001, [3, 7, 11, 13]))).toBe(1001);
    expect(splitCents(0, [1, 2])).toEqual([0, 0]);
  });
});

describe("calculateRun", () => {
  it("pays artists only from their own listeners (user-centric)", () => {
    const r = calculateRun({
      hostingCostCents: 0,
      fallbackArtistIds: [],
      payments: [
        { paymentId: "p1", userId: "u1", netCents: 1000, plays: { a: 1 } },
        { paymentId: "p2", userId: "u2", netCents: 1000, plays: { b: 999 } },
      ],
    });
    // A pro-rata pool would give artist a almost nothing; here u1's money is all a's.
    expect(r.artists.a.subscriptionCents).toBe(1000);
    expect(r.artists.b.subscriptionCents).toBe(1000);
  });

  it("splits a subscriber's money by their play share", () => {
    const r = calculateRun({
      hostingCostCents: 0,
      fallbackArtistIds: [],
      payments: [{ paymentId: "p1", userId: "u1", netCents: 900, plays: { a: 2, b: 1 } }],
    });
    expect(r.artists.a.subscriptionCents).toBe(600);
    expect(r.artists.b.subscriptionCents).toBe(300);
  });

  it("takes hosting equally and never more than 20%", () => {
    const r = calculateRun({
      hostingCostCents: 300,
      fallbackArtistIds: [],
      payments: [
        { paymentId: "p1", userId: "u1", netCents: 1000, plays: { a: 1 } },
        { paymentId: "p2", userId: "u2", netCents: 400, plays: { a: 1 } },
      ],
    });
    // Equal share is 150 each; p2's cap is 80, the 70 gap comes from the reserve.
    expect(r.hostingCoveredCents).toBe(230);
    expect(r.reserveDrawCents).toBe(70);
    expect(r.artists.a.subscriptionCents).toBe(850 + 320);
  });

  it("artists get everything when hosting is cheap", () => {
    const r = calculateRun({
      hostingCostCents: 10,
      fallbackArtistIds: [],
      payments: [{ paymentId: "p1", userId: "u1", netCents: 500, plays: { a: 1 } }],
    });
    expect(r.artists.a.subscriptionCents).toBe(490);
    expect(r.reserveDrawCents).toBe(0);
  });

  it("sends silent subscribers' money to the shared fund by global plays", () => {
    const r = calculateRun({
      hostingCostCents: 0,
      fallbackArtistIds: ["a", "b", "c"],
      payments: [
        { paymentId: "p1", userId: "u1", netCents: 1000, plays: { a: 3, b: 1 } },
        { paymentId: "p2", userId: "u2", netCents: 400, plays: {} },
      ],
    });
    expect(r.artists.a.sharedFundCents).toBe(300);
    expect(r.artists.b.sharedFundCents).toBe(100);
    expect(r.artists.c).toBeUndefined();
  });

  it("splits the shared fund equally when nobody listened", () => {
    const r = calculateRun({
      hostingCostCents: 0,
      fallbackArtistIds: ["a", "b"],
      payments: [{ paymentId: "p1", userId: "u1", netCents: 401, plays: {} }],
    });
    expect(r.artists.a.sharedFundCents + r.artists.b.sharedFundCents).toBe(401);
  });

  it("accounts for every cent", () => {
    const payments = Array.from({ length: 37 }, (_, i) => ({
      paymentId: `p${i}`,
      userId: `u${i}`,
      netCents: 397 + i * 13,
      plays: (i % 5 === 0 ? {} : { a: i, b: (i * 7) % 11, c: 1 }) as Record<string, number>,
    }));
    const r = calculateRun({ hostingCostCents: 2345, fallbackArtistIds: ["a"], payments });
    const net = sum(payments.map((p) => p.netCents));
    const toArtists = sum(Object.values(r.artists).map((a) => a.subscriptionCents + a.sharedFundCents));
    expect(toArtists + r.hostingCoveredCents + r.unallocatedCents).toBe(net);
    expect(toArtists / net).toBeGreaterThanOrEqual(0.8);
  });
});
