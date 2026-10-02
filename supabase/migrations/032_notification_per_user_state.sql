CREATE TABLE public.notification_receipts (
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX idx_notification_receipts_user ON public.notification_receipts(user_id, notification_id);

ALTER TABLE public.notification_receipts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.notification_receipts TO authenticated;

CREATE POLICY notification_receipts_own ON public.notification_receipts
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.notifications AS notification
      WHERE notification.id = notification_id
        AND notification.is_global = true
        AND notification.user_id IS NULL
    )
  );

CREATE POLICY notifications_delete_own ON public.notifications
  FOR DELETE
  USING (user_id = auth.uid());

GRANT DELETE ON public.notifications TO authenticated;