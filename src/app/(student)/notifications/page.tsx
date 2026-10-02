import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import NotificationListClient from "@/components/notifications/NotificationListClient";
import { applyNotificationReceipts } from "@/lib/notification-state";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const session = await requireAuth();

  if (!session?.profile) {
    return <div className="p-8 text-sm text-muted-foreground">Please sign in to view notifications.</div>;
  }

  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("id, title, message, type, link_url, is_read, is_global, created_at").or(`user_id.eq.${session.user.id},is_global.eq.true`).order("created_at", { ascending: false }).limit(50);
  const { data: receipts } = await supabase
    .from("notification_receipts")
    .select("notification_id, is_read, is_dismissed")
    .eq("user_id", session.user.id);
  const notifications = applyNotificationReceipts(data || [], receipts || []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Notifications</h1>
        <p className="mt-2 text-sm text-muted-foreground">Stay updated with reminders, results, and platform announcements.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent notifications</CardTitle>
          <CardDescription>Latest 50 notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationListClient initial={notifications} />
        </CardContent>
      </Card>
    </div>
  );
}
