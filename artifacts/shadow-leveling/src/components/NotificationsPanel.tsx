import { useState } from "react";
import { Bell, BellOff, BellRing, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Switch } from "@/components/ui/switch";

function pad(n: number) { return String(n).padStart(2, "0"); }

function formatTime(hour: number, minute: number) {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${h}:${pad(minute)} ${ampm}`;
}

export function NotificationsPanel() {
  const { status, loading, settings, subscribe, unsubscribe, updateSettings, sendTest } = usePushNotifications();
  const [testSent, setTestSent] = useState(false);
  const [localHour, setLocalHour] = useState(settings.reminderHour);
  const [localMinute, setLocalMinute] = useState(settings.reminderMinute);

  const isSubscribed = status === "subscribed";
  const isUnsupported = status === "unsupported";
  const isDenied = status === "denied";

  async function handleToggle() {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe({ reminderHour: localHour, reminderMinute: localMinute, reminderEnabled: true });
    }
    setTestSent(false);
  }

  async function handleTimeChange(hour: number, minute: number) {
    setLocalHour(hour);
    setLocalMinute(minute);
    if (isSubscribed) {
      await updateSettings({ reminderHour: hour, reminderMinute: minute });
    }
  }

  async function handleTest() {
    await sendTest();
    setTestSent(true);
    setTimeout(() => setTestSent(false), 4000);
  }

  if (isUnsupported) {
    return (
      <div className="flex items-start gap-3 text-xs text-muted-foreground/60 bg-white/3 rounded-lg p-3 border border-white/5">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500/60" />
        <p>Push notifications are not supported in this browser. For locked-screen alerts, install the app to your home screen using Chrome (Android) or Safari (iOS 16.4+).</p>
      </div>
    );
  }

  if (isDenied) {
    return (
      <div className="flex items-start gap-3 text-xs text-muted-foreground/60 bg-white/3 rounded-lg p-3 border border-white/5">
        <BellOff className="w-4 h-4 shrink-0 mt-0.5 text-red-500/60" />
        <p>Notifications are blocked. Open your browser settings and allow notifications for this site, then reload.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isSubscribed
            ? <BellRing className="w-4 h-4 text-primary" />
            : <Bell className="w-4 h-4 text-muted-foreground" />
          }
          <span className="font-display text-xs tracking-[0.3em] uppercase text-white/80">
            Quest Reminders
          </span>
        </div>
        {loading
          ? <Loader2 className="w-4 h-4 animate-spin text-primary" />
          : <Switch checked={isSubscribed} onCheckedChange={handleToggle} />
        }
      </div>

      {!isSubscribed && (
        <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
          Enable to receive a daily notification on your phone reminding you to complete your quests. Tap the notification to open the quest list directly.
        </p>
      )}

      {isSubscribed && (
        <div className="space-y-4 pt-1">
          <div className="space-y-2">
            <label className="font-display text-[10px] tracking-[0.3em] uppercase text-primary/70 block">
              Daily Reminder Time
            </label>
            <div className="flex items-center gap-2">
              <select
                value={localHour}
                onChange={(e) => handleTimeChange(Number(e.target.value), localMinute)}
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-stat text-white focus:outline-none focus:border-primary/50"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`}
                  </option>
                ))}
              </select>
              <span className="text-muted-foreground font-stat">:</span>
              <select
                value={localMinute}
                onChange={(e) => handleTimeChange(localHour, Number(e.target.value))}
                className="w-20 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-stat text-white focus:outline-none focus:border-primary/50"
              >
                {[0, 15, 30, 45].map((m) => (
                  <option key={m} value={m}>{pad(m)}</option>
                ))}
              </select>
            </div>
            <p className="text-[10px] text-muted-foreground/40 font-stat">
              Set to {formatTime(localHour, localMinute)} — reminder fires daily at this time.
            </p>
          </div>

          <button
            onClick={handleTest}
            disabled={testSent}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-display tracking-[0.2em] uppercase text-primary hover:bg-primary/20 transition-all duration-200 disabled:opacity-60"
          >
            {testSent
              ? <><CheckCircle2 className="w-3.5 h-3.5" /> Notification Sent</>
              : <><BellRing className="w-3.5 h-3.5" /> Send Test Notification</>
            }
          </button>
          <p className="text-[10px] text-muted-foreground/40 text-center leading-relaxed">
            For locked-screen alerts, add this app to your home screen via your browser menu.
          </p>
        </div>
      )}
    </div>
  );
}
