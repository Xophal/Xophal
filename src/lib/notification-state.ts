export type NotificationReceipt = {
  notification_id: string;
  is_read: boolean;
  is_dismissed: boolean;
};

export type NotificationWithState = {
  id: string;
  is_global?: boolean;
  is_read: boolean;
};

export function applyNotificationReceipts<T extends NotificationWithState>(
  notifications: T[],
  receipts: NotificationReceipt[]
): T[] {
  const receiptById = new Map(receipts.map((receipt) => [receipt.notification_id, receipt]));

  return notifications.flatMap((notification) => {
    if (!notification.is_global) return [notification];

    const receipt = receiptById.get(notification.id);
    if (receipt?.is_dismissed) return [];

    return [{ ...notification, is_read: receipt?.is_read ?? false }];
  });
}
