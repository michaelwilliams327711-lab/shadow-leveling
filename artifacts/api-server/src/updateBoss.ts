import { db, bossesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function update() {
  await db.update(bossesTable)
    .set({ 
      name: "The Iron-Clad Specter", 
      description: "A hollow colossus of ancient armor, fueled by a flickering blue flame. It guards the gateway to the Monarch's true power.",
      challenge: "Endurance and Intellect are your keys to victory. Every quest completed deals mana damage to its core."
    })
    .where(eq(bossesTable.name, "The Shifting Pallet"));
  console.log("Identity Purge Complete: The Iron-Clad Specter has materialized.");
}
update();
