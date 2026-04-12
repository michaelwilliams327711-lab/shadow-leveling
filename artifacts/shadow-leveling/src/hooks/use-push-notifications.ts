import { useState, useEffect, useCallback } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

async function getVapidPublicKey(): Promise<string> {
  const res = await fetch(`${BASE}/api/push/vapid-public-key`);
  const data = await res.json() as { publicKey: string };
  return data.publicKey;
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0))).buffer as ArrayBuffer;
}

export type NotificationStatus = "unsupported" | "denied" | "default" | "granted" | "subscribed";

export interface PushSettings {
  reminderHour: number;
  reminderMinute: number;
  reminderEnabled: boolean;
}

export function usePushNotifications() {
  const [status, setStatus] = useState<NotificationStatus>("default");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<PushSettings>({
    reminderHour: 9,
    reminderMinute: 0,
    reminderEnabled: true,
  });

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    const perm = Notification.permission;
    if (perm === "denied") { setStatus("denied"); return; }

    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) {
          setSubscription(sub);
          setStatus("subscribed");
          const saved = localStorage.getItem("push-settings");
          if (saved) {
            try { setSettings(JSON.parse(saved) as PushSettings); } catch { /* ignore */ }
          }
        } else {
          setStatus(perm === "granted" ? "granted" : "default");
        }
      });
    });
  }, []);

  const subscribe = useCallback(async (newSettings?: Partial<PushSettings>) => {
    setLoading(true);
    try {
      const merged = { ...settings, ...newSettings };
      const publicKey = await getVapidPublicKey();
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await fetch(`${BASE}/api/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("p256dh")!))),
            auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("auth")!))),
          },
          ...merged,
        }),
      });

      localStorage.setItem("push-settings", JSON.stringify(merged));
      setSubscription(sub);
      setSettings(merged);
      setStatus("subscribed");
    } catch {
      setStatus(Notification.permission === "denied" ? "denied" : "default");
    } finally {
      setLoading(false);
    }
  }, [settings]);

  const unsubscribe = useCallback(async () => {
    if (!subscription) return;
    setLoading(true);
    try {
      await fetch(`${BASE}/api/push/subscribe`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
      localStorage.removeItem("push-settings");
      setSubscription(null);
      setStatus("granted");
    } finally {
      setLoading(false);
    }
  }, [subscription]);

  const updateSettings = useCallback(async (newSettings: Partial<PushSettings>) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    if (subscription) {
      await fetch(`${BASE}/api/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("p256dh")!))),
            auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("auth")!))),
          },
          ...merged,
        }),
      });
      localStorage.setItem("push-settings", JSON.stringify(merged));
    }
  }, [settings, subscription]);

  const sendTest = useCallback(async () => {
    if (!subscription) return;
    await fetch(`${BASE}/api/push/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  }, [subscription]);

  return { status, subscription, loading, settings, subscribe, unsubscribe, updateSettings, sendTest };
}
