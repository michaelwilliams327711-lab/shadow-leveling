import { Router } from "express";
import webpush from "web-push";
import { db } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const VAPID_PUBLIC_KEY = process.env["VAPID_PUBLIC_KEY"] ?? "";
const VAPID_PRIVATE_KEY = process.env["VAPID_PRIVATE_KEY"] ?? "";
const VAPID_SUBJECT = process.env["VAPID_SUBJECT"] ?? "mailto:admin@shadow-leveling.app";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  reminderHour: z.number().int().min(0).max(23).default(9),
  reminderMinute: z.number().int().min(0).max(59).default(0),
  reminderEnabled: z.boolean().default(true),
});

router.get("/push/vapid-public-key", (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

router.post("/push/subscribe", async (req, res) => {
  try {
    const body = SubscribeSchema.parse(req.body);
    await db
      .insert(pushSubscriptionsTable)
      .values({
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        reminderHour: body.reminderHour,
        reminderMinute: body.reminderMinute,
        reminderEnabled: body.reminderEnabled,
      })
      .onConflictDoUpdate({
        target: pushSubscriptionsTable.endpoint,
        set: {
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,
          reminderHour: body.reminderHour,
          reminderMinute: body.reminderMinute,
          reminderEnabled: body.reminderEnabled,
        },
      });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error saving push subscription");
    res.status(400).json({ error: "Invalid subscription data" });
  }
});

router.delete("/push/subscribe", async (req, res) => {
  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) return res.status(400).json({ error: "endpoint required" });
  try {
    await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, endpoint));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting push subscription");
    res.status(500).json({ error: "Failed to unsubscribe" });
  }
});

router.post("/push/test", async (req, res) => {
  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) return res.status(400).json({ error: "endpoint required" });
  try {
    const [sub] = await db
      .select()
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.endpoint, endpoint))
      .limit(1);
    if (!sub) return res.status(404).json({ error: "Subscription not found" });

    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({
        title: "⚔️ Shadow System",
        body: "Test notification — the System is watching.",
        url: "/quests",
      })
    );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error sending test push");
    res.status(500).json({ error: "Failed to send test notification" });
  }
});

export async function sendDailyQuestReminders(log: { info: (msg: string) => void; error: (obj: object, msg: string) => void }) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  try {
    const subs = await db
      .select()
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.reminderEnabled, true));

    for (const sub of subs) {
      if (sub.reminderHour !== currentHour || sub.reminderMinute !== currentMinute) continue;

      const payload = JSON.stringify({
        title: "⚔️ Quest Awaits, Hunter",
        body: "The System demands action. Complete your daily quests before the rift closes.",
        url: "/quests",
      });

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        log.info(`Sent quest reminder to subscription ${sub.id}`);
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, sub.id));
          log.info(`Removed expired subscription ${sub.id}`);
        } else {
          log.error({ err }, `Failed to send push to subscription ${sub.id}`);
        }
      }
    }
  } catch (err) {
    log.error({ err }, "Error in sendDailyQuestReminders");
  }
}

export default router;
