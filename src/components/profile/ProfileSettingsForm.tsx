"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarDays, Mail, Moon, Save, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import type { Profile } from "@/types";

type Props = { initial?: Partial<Profile> };
type Preferences = NonNullable<Profile["settings"]>;

const defaults: Preferences = {
  email_notifications: true,
  weekly_digest: true,
  test_reminders: true,
  sound_effects: false,
};

export default function ProfileSettingsForm({ initial }: Props) {
  const router = useRouter();
  const [preferences, setPreferences] = useState<Preferences>({ ...defaults, ...(initial?.settings || {}) });
  const [dailyGoal, setDailyGoal] = useState(initial?.daily_goal_minutes || 60);
  const [saving, setSaving] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  function toggle(key: keyof Preferences) {
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  }

  async function setPushNotifications(enabled: boolean) {
    setPushBusy(true);
    try {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        throw new Error("Browser notifications are not supported here.");
      }

      if (enabled) {
        const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
        if (permission !== "granted") throw new Error("Allow notifications in your browser to enable push alerts.");
      }

      let subscription = await (await navigator.serviceWorker.getRegistration("/"))?.pushManager.getSubscription() || null;
      if (enabled) {
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey) throw new Error("Push notifications are not configured on this site.");
        const registration = await navigator.serviceWorker.register("/sw.js");
        subscription = subscription || await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeApplicationServerKey(publicKey),
        });
        const response = await fetch("/api/notifications/push-subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "Could not register this browser.");
      } else if (subscription) {
        const response = await fetch("/api/notifications/push-subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "Could not remove this browser.");
        await subscription.unsubscribe();
      }

      const nextPreferences = { ...preferences, push_notifications: enabled };
      const saveResponse = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: nextPreferences }),
      });
      const saveResult = await saveResponse.json().catch(() => ({}));
      if (!saveResponse.ok || !saveResult.success) throw new Error(saveResult.error || "Could not save notification preferences.");
      setPreferences(nextPreferences);
      toast({ title: enabled ? "Browser alerts enabled" : "Browser alerts disabled" });
      router.refresh();
    } catch (error) {
      toast({ title: "Push settings failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setPushBusy(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_goal_minutes: dailyGoal, settings: preferences }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to save settings.");
      toast({ title: "Settings saved", description: "Your learning preferences are up to date." });
      router.refresh();
    } catch (error) {
      toast({ title: "Save failed", description: error instanceof Error ? error.message : "Unable to save settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const items: { key: keyof Preferences; label: string; description: string; icon: typeof Mail }[] = [
    { key: "email_notifications", label: "Email notifications", description: "Important account and result updates", icon: Mail },
    { key: "weekly_digest", label: "Weekly progress digest", description: "A summary of your learning momentum", icon: CalendarDays },
    { key: "test_reminders", label: "Test reminders", description: "Reminders for unfinished practice sessions", icon: Bell },
    { key: "sound_effects", label: "Sound effects", description: "Use subtle sounds during practice", icon: Volume2 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold">Daily study goal</p><p className="text-xs text-muted-foreground">Choose a pace you can sustain.</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{dailyGoal} min</span></div>
        <input aria-label="Daily study goal in minutes" type="range" min="15" max="240" step="15" value={dailyGoal} onChange={(event) => setDailyGoal(Number(event.target.value))} className="w-full accent-primary" />
        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground"><span>15 min</span><span>4 hours</span></div>
      </div>
      <div className="space-y-2">
        {items.map(({ key, label, description, icon: ItemIcon }) => (
          <button key={key} type="button" onClick={() => toggle(key)} className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-background/50 p-3 text-left transition hover:border-primary/40">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><ItemIcon className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-muted-foreground">{description}</span></span>
            <span aria-hidden="true" className={`relative h-6 w-11 rounded-full transition ${preferences[key] ? "bg-primary" : "bg-muted"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${preferences[key] ? "left-6" : "left-1"}`} /></span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/50 p-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bell className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-medium">Browser push notifications</span><span className="block text-xs text-muted-foreground">Receive important updates when Xophol is closed.</span></span>
          <Button type="button" size="sm" variant="outline" disabled={pushBusy} onClick={() => void setPushNotifications(!preferences.push_notifications)}>
            {pushBusy ? "Updating..." : preferences.push_notifications ? "Disable" : "Enable"}
          </Button>
      </div>
      <Button type="button" onClick={save} disabled={saving} className="w-full sm:w-auto"><Save className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Save preferences"}</Button>
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><Moon className="h-3.5 w-3.5" /> Theme can be changed from the dashboard header.</p>
    </div>
  );
}

function decodeApplicationServerKey(value: string) {
  const padded = value + "=".repeat((4 - value.length % 4) % 4);
  const binary = window.atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}