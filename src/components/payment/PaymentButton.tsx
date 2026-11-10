"use client";

import ManualUpiPurchase from "@/components/payment/ManualUpiPurchase";

export function PaymentButton({ amount, testId }: { amount: number; testId: string }) {
  return (
    <ManualUpiPurchase
      resourceType="mock_test"
      resourceId={testId}
      buttonLabel={`Unlock test for ₹${Number(amount).toFixed(2)} with UPI QR`}
    />
  );
}
