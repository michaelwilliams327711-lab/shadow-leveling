import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const items = [
  ["Manga/Anime Pass", "1 Hour of leisure time.", 1000, "Leisure", "BookOpen"],
  ["Tech Upgrade", "Budget for new development gear.", 5000, "Gear", "Cpu"],
  ["Cheat Meal", "High-calorie reward for a heavy gym week.", 2500, "Indulgence", "UtensilsCrossed"],
];

try {
  for (const [name, description, cost, category, icon] of items) {
    const exists = await pool.query("SELECT id FROM shop_items WHERE name = $1 LIMIT 1", [name]);
    if (exists.rowCount && exists.rowCount > 0) {
      console.log(`= exists: ${name}`);
      continue;
    }
    await pool.query(
      "INSERT INTO shop_items (name, description, cost, category, icon) VALUES ($1, $2, $3, $4, $5)",
      [name, description, cost, category, icon],
    );
    console.log(`+ inserted: ${name}`);
  }
} finally {
  await pool.end();
}
