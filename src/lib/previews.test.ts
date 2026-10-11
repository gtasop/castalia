import { describe, expect, it } from "vitest";
import { genreFromSlug, genreSlug, GENRES } from "./genres";
import { latestStart, resolvePreview } from "./previews";

const track = (id: string, number: number, durationSec: number, status = "READY") => ({
  id,
  number,
  title: id,
  durationSec,
  status,
  files: [{ quality: "LOSSLESS", key: `tracks/${id}/lossless.flac`, bytes: 1000 }],
});
const album = (tracks: ReturnType<typeof track>[], previewTrackId: string | null = null, previewStartSec = 0) => ({
  id: "a",
  previewTrackId,
  previewStartSec,
  previewKey: null,
  previewFingerprint: null,
  tracks,
});

describe("resolvePreview", () => {
  it("defaults to the first track from 0:30", () => {
    const p = resolvePreview(album([track("t2", 2, 200), track("t1", 1, 200)]))!;
    expect(p.track.id).toBe("t1");
    expect(p.startSec).toBe(30);
    expect(p.chosenByArtist).toBe(false);
  });

  it("uses the artist's track and start", () => {
    const p = resolvePreview(album([track("t1", 1, 200), track("t2", 2, 200)], "t2", 65))!;
    expect(p.track.id).toBe("t2");
    expect(p.startSec).toBe(65);
    expect(p.chosenByArtist).toBe(true);
  });

  it("keeps the clip inside the track", () => {
    expect(resolvePreview(album([track("t1", 1, 40)]))!.startSec).toBe(25);
    expect(resolvePreview(album([track("t1", 1, 10)]))!.startSec).toBe(0);
    expect(latestStart(45)).toBe(30);
  });

  it("falls back when the chosen track is gone or not ready", () => {
    expect(resolvePreview(album([track("t1", 1, 200)], "deleted", 5))!.track.id).toBe("t1");
    expect(resolvePreview(album([track("t1", 1, 200, "PROCESSING"), track("t2", 2, 200)], "t1"))!.track.id).toBe("t2");
    expect(resolvePreview(album([]))).toBeNull();
  });

  it("changes the fingerprint when the choice changes", () => {
    const a = resolvePreview(album([track("t1", 1, 200)], "t1", 10))!;
    const b = resolvePreview(album([track("t1", 1, 200)], "t1", 11))!;
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });
});

describe("genre slugs", () => {
  it("round-trip for every genre", () => {
    for (const g of GENRES) expect(genreFromSlug(genreSlug(g))).toBe(g);
    expect(genreSlug("R&B and soul")).toBe("rb-and-soul");
    expect(genreFromSlug("nope")).toBeNull();
  });
});
