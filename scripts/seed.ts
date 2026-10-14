// Seeds a local database with demo accounts and albums made of
// synthesized audio (including a 24-bit/96kHz hi-res album).
//
// Demo accounts (password for all: castalia-demo):
//   listener@castalia.test  listener
//   echo@castalia.test      artist "Echo & the Nymphs"
//   pan@castalia.test       artist "Pan's Pipes"
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";
import ffmpegPath from "ffmpeg-static";
import { processTrack } from "../src/lib/audio";
import { db } from "../src/lib/db";

const PASSWORD = "castalia-demo";

type DemoAlbum = { title: string; description: string; priceCents: number; genres: string[]; hiRes: boolean; tracks: [string, number[]][] };
const ARTISTS: { email: string; name: string; bio: string; albums: DemoAlbum[] }[] = [
  {
    email: "echo@castalia.test",
    name: "Echo & the Nymphs",
    bio: "Ambient drones recorded at the spring.",
    albums: [
      {
        title: "Castalian Spring",
        description: "A hi-res demo album, 24-bit / 96 kHz.",
        priceCents: 900,
        genres: ["Ambient", "Electronic"],
        hiRes: true,
        tracks: [["Morning at Delphi", [220, 277.18, 329.63]], ["Laurel", [196, 246.94, 293.66]], ["Water Over Stone", [174.61, 220, 261.63]]],
      },
    ],
  },
  {
    email: "pan@castalia.test",
    name: "Pan's Pipes",
    bio: "Minimal tones for long evenings.",
    albums: [
      {
        title: "Arcadia",
        description: "A CD-quality demo album, 16-bit / 44.1 kHz.",
        priceCents: 700,
        genres: ["Ambient", "Experimental"],
        hiRes: false,
        tracks: [["Syrinx", [261.63, 329.63, 392]], ["Shepherd's Hour", [293.66, 349.23, 440]]],
      },
    ],
  },
];

function synth(file: string, freqs: number[], hiRes: boolean) {
  const sr = hiRes ? 96000 : 44100;
  // A soft chord with a slow tremolo, 45 seconds long (long enough to pass the 30s play rule).
  const expr = freqs.map((f) => `sin(2*PI*${f}*t)`).join("+");
  const args = [
    "-y", "-v", "error",
    "-f", "lavfi", "-i", `aevalsrc=0.2*(${expr})/${freqs.length}*(0.75+0.25*sin(2*PI*0.2*t))|0.2*(${expr})/${freqs.length}*(0.75+0.25*cos(2*PI*0.2*t)):s=${sr}:d=45`,
    "-af", "afade=t=in:d=2,afade=t=out:st=42:d=3",
    "-c:a", "flac",
    ...(hiRes ? ["-sample_fmt", "s32", "-bits_per_raw_sample", "24"] : ["-sample_fmt", "s16"]),
    file,
  ];
  execFileSync(ffmpegPath as string, args);
}

async function user(email: string, name: string, role: "LISTENER" | "ARTIST") {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return db.user.upsert({ where: { email }, create: { email, name, role, passwordHash }, update: {} });
}

async function main() {
  await user("listener@castalia.test", "Demo Listener", "LISTENER");

  const tmp = mkdtempSync(path.join(os.tmpdir(), "castalia-seed-"));
  try {
    for (const a of ARTISTS) {
      const u = await user(a.email, a.name, "ARTIST");
      const artist = await db.artist.upsert({ where: { userId: u.id }, create: { userId: u.id, name: a.name, bio: a.bio }, update: {} });
      for (const al of a.albums) {
        if (await db.album.findFirst({ where: { artistId: artist.id, title: al.title } })) continue;
        const album = await db.album.create({
          data: { artistId: artist.id, title: al.title, description: al.description, priceCents: al.priceCents, genres: al.genres, published: true, releasedAt: new Date() },
        });
        for (const [i, [title, freqs]] of al.tracks.entries()) {
          const track = await db.track.create({ data: { albumId: album.id, number: i + 1, title, open: i === 0 } });
          const file = path.join(tmp, `${track.id}.flac`);
          synth(file, freqs, al.hiRes);
          await processTrack(track.id, file);
          const t = await db.track.findUniqueOrThrow({ where: { id: track.id }, include: { files: true } });
          console.log(`  ${a.name} / ${al.title} / ${title}: ${t.status} ${t.error ?? ""} [${t.files.map((f) => f.quality).join(", ")}]`);
        }
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`Seeded. Log in with any @castalia.test account, password "${PASSWORD}".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
