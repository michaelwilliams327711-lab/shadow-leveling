import { Router } from "express";
import webpush from "web-push";
import { db } from "@workspace/db";
import { pushSubscriptionsTable, questsTable } from "@workspace/db/schema";
import { eq, and, sql, isNull, gte, lte } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const VAPID_PUBLIC_KEY = process.env["VAPID_PUBLIC_KEY"] ?? "";
const VAPID_PRIVATE_KEY = process.env["VAPID_PRIVATE_KEY"] ?? "";
const VAPID_SUBJECT = process.env["VAPID_SUBJECT"] ?? "mailto:admin@shadow-leveling.app";

const vapidConfigured = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (vapidConfigured) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const SubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  reminderHour: z.number().int().min(0).max(23).default(9),
  reminderMinute: z.number().int().min(0).max(59).default(0),
  reminderEnabled: z.boolean().default(true),
  timezoneOffset: z.number().int().min(-720).max(840).default(0),
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
        timezoneOffset: body.timezoneOffset,
      })
      .onConflictDoUpdate({
        target: pushSubscriptionsTable.endpoint,
        set: {
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,
          reminderHour: body.reminderHour,
          reminderMinute: body.reminderMinute,
          reminderEnabled: body.reminderEnabled,
          timezoneOffset: body.timezoneOffset,
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
  if (!vapidConfigured) {
    return res.status(503).json({ error: "Push notifications are not configured on this server." });
  }
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

export async function sendOverseerPenaltyNotification(log: { info: (msg: string) => void; error: (obj: object, msg: string) => void }) {
  if (!vapidConfigured) return;

  try {
    const subs = await db.select().from(pushSubscriptionsTable);

    const payload = JSON.stringify({
      title: "[ SYSTEM ALERT ]",
      body: 'Penalty Quest initiated: "Trial of the Unworthy." Prepare for extraction.',
      url: "/penalty-zone",
      type: "PENALTY_QUEST",
      severity: "CRITICAL",
      vibrate: [100, 50, 100, 50, 100, 50, 300, 50, 300, 50, 300, 50, 100, 50, 100, 50, 100],
    });

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        log.info(`Sent overseer penalty alert to subscription ${sub.id}`);
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, sub.id));
          log.info(`Removed expired subscription ${sub.id}`);
        } else {
          log.error({ err }, `Failed to send overseer push to subscription ${sub.id}`);
        }
      }
    }
  } catch (err) {
    log.error({ err }, "Error in sendOverseerPenaltyNotification");
  }
}

export async function sendDailyQuestReminders(log: { info: (msg: string) => void; error: (obj: object, msg: string) => void }) {
  if (!vapidConfigured) return;

  const now = new Date();
  const currentUtcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  try {
    const subs = await db
      .select()
      .from(pushSubscriptionsTable)
      .where(
        and(
          eq(pushSubscriptionsTable.reminderEnabled, true),
          sql`MOD(${pushSubscriptionsTable.reminderHour} * 60 + ${pushSubscriptionsTable.reminderMinute} - ${pushSubscriptionsTable.timezoneOffset} + 1440, 1440) = ${currentUtcMinutes}`
        )
      );

    for (const sub of subs) {
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

// In-memory tracking to avoid sending duplicate 30-min warnings per quest per day.
const _warnedQuestIds = new Set<number>();
let _warnedDate = new Date().toISOString().split("T")[0];

export async function sendDeadlineWarningNotifications(log: { info: (msg: string) => void; error: (obj: object, msg: string) => void }) {
  if (!vapidConfigured) return;

  // Reset the tracking set daily (UTC midnight).
  const todayUtc = new Date().toISOString().split("T")[0];
  if (todayUtc !== _warnedDate) {
    _warnedQuestIds.clear();
    _warnedDate = todayUtc;
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + 25 * 60 * 1000);
  const windowEnd   = new Date(now.getTime() + 35 * 60 * 1000);

  try {
    const approachingQuests = await db
      .select({ id: questsTable.id, name: questsTable.name })
      .from(questsTable)
      .where(
        and(
          eq(questsTable.status, "active"),
          isNull(questsTable.deletedAt),
          gte(questsTable.deadline, windowStart),
          lte(questsTable.deadline, windowEnd),
        )
      );

    const newQuests = approachingQuests.filter(q => !_warnedQuestIds.has(q.id));
    if (newQuests.length === 0) return;

    const subs = await db.select().from(pushSubscriptionsTable);
    if (subs.length === 0) return;

    for (const quest of newQuests) {
      _warnedQuestIds.add(quest.id);

      const payload = JSON.stringify({
        title: "[ MISSION WARNING ]",
        body: `30 minutes until failure: "${quest.name}"`,
        url: "/quests",
        type: "MISSION_WARNING",
        questId: quest.id,
      });

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          log.info(`Sent 30-min deadline warning for quest ${quest.id} to subscription ${sub.id}`);
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 410 || status === 404) {
            await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, sub.id));
            log.info(`Removed expired subscription ${sub.id}`);
          } else {
            log.error({ err }, `Failed to send warning push to subscription ${sub.id}`);
          }
        }
      }
    }
  } catch (err) {
    log.error({ err }, "Error in sendDeadlineWarningNotifications");
  }
}

export default router;
