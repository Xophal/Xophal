import { z } from "zod";
import { apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});

const unsubscribeSchema = z.object({ endpoint: z.string().url().max(2048) });

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    if (!session) return new Response(null, { status: 401 });
    const subscription = await validateBody(subscriptionSchema, await request.json());
    const supabase = await createClient();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: session.user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );
    if (error) throw error;
    return apiSuccess({ saved: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth();
    if (!session) return new Response(null, { status: 401 });
    const { endpoint } = await validateBody(unsubscribeSchema, await request.json());
    const supabase = await createClient();
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", session.user.id)
      .eq("endpoint", endpoint);
    if (error) throw error;
    return apiSuccess({ removed: true });
  } catch (error) {
    return handleApiError(error);
  }
}