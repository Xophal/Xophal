import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import NotificationListClient from "@/components/notifications/NotificationListClient";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const session = await requireAuth();

  if (!session?.profile) {
    return <div className="p-8 text-sm text-muted-foreground">Please sign in to view notifications.</div>;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_user_notifications", {
    p_page: 1,
    p_limit: 50,
  });
  if (error) throw error;
  if (!data || typeof data !== "object" || !Array.isArray(data.items)) {
    throw new Error("Notification service returned an invalid response.");
  }

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
          <NotificationListClient initial={data.items} />
        </CardContent>
      </Card>
    </div>
  );
}
