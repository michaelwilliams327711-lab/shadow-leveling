import { db, bossesTable } from "@workspace/db";

async function seed() {
  await db.insert(bossesTable).values({
    name: "The Shifting Pallet",
    description: "A Rank-D logistical nightmare. An unstable mountain of inventory that regenerates as fast as you scan it.",
    rank: "D",
    xpThreshold: 0,
    challenge: "Complete quests to deal damage. Endurance stats provide a 1.5x damage multiplier.",
    maxHp: 1000,
    currentHp: 1000,
  }).onConflictDoNothing();
  console.log("Boss Seeded: The Shifting Pallet is waiting in the Arena.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
