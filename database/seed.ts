import { PrismaClient } from "@prisma/client";

// Idempotent seed. ONLY the 6 built-in sounds + default settings.
// NEVER seed fake users, videos, likes, followers, comments or activity —
// the platform starts empty.

const prisma = new PrismaClient();

const SOUNDS = [
  { file: "upbeat-pop.wav", title: "Upbeat Pop", durationSec: 8 },
  { file: "chill-lofi.wav", title: "Chill Lofi", durationSec: 10 },
  { file: "hip-hop-beat.wav", title: "Hip-Hop Beat", durationSec: 8 },
  { file: "electronic-dance.wav", title: "Electronic Dance", durationSec: 15 },
  { file: "acoustic-pluck.wav", title: "Acoustic Pluck", durationSec: 9.6 },
  { file: "cinematic.wav", title: "Cinematic", durationSec: 12 },
] as const;

const SETTINGS = [
  { key: "appName", value: "ALIZAIN TIKTOK" },
  { key: "maxVideoSeconds", value: "30" },
  { key: "registrationOpen", value: "true" },
  { key: "liveProvider", value: "none" },
] as const;

async function main() {
  for (const s of SOUNDS) {
    await prisma.sound.upsert({
      where: { id: s.file.replace(".wav", "") },
      update: {
        title: s.title,
        artist: "Alizain TikTok Originals",
        durationSec: s.durationSec,
        audioUrl: `/sounds/${s.file}`,
        filePath: `assets/sounds/${s.file}`,
      },
      create: {
        id: s.file.replace(".wav", ""),
        title: s.title,
        artist: "Alizain TikTok Originals",
        durationSec: s.durationSec,
        audioUrl: `/sounds/${s.file}`,
        filePath: `assets/sounds/${s.file}`,
      },
    });
    console.log(`sound: ${s.title} (${s.durationSec}s)`);
  }
  for (const s of SETTINGS) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: { key: s.key, value: s.value },
    });
    console.log(`setting: ${s.key}=${s.value}`);
  }
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
