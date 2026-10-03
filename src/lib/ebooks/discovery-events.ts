import { createAdminClient } from "@/lib/supabase/admin";

type DiscoveryEventName =
  | "ebook_mock_test_started"
  | "ebook_mock_test_completed"
  | "mock_test_ebook_external_click"
  | "mock_test_started"
  | "mock_test_completed";

export async function recordLearningDiscoveryEvent(input: {
  eventName: DiscoveryEventName;
  userId?: string | null;
  mockTestId: string;
  ebookId?: string | null;
  attemptId?: string | null;
  source: string;
}) {
  const { error } = await createAdminClient().from("ebook_events").insert({
    event_name: input.eventName,
    user_id: input.userId ?? null,
    mock_test_id: input.mockTestId,
    ebook_id: input.ebookId ?? null,
    attempt_id: input.attemptId ?? null,
    source: input.source,
  });
  if (error) console.error("Could not record learning discovery event", error);
}
