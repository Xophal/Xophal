import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Replace this stub with the database write that grants a user access to a test.
 * The payment verification route calls it only after signature verification.
 */
export async function unlockTestForUser(userId: string, testId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("test_access_grants")
    .upsert({ user_id: userId, mock_test_id: testId, source: "razorpay" }, { onConflict: "user_id,mock_test_id" })
    .select("id, user_id, mock_test_id, granted_at")
    .single();
  if (error) throw error;
  return { ...data, unlocked: true };
}