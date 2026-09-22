"use client";

import Script from "next/script";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayOptions = { key: string; amount: number; currency: string; name: string; description: string; order_id: string; handler: (response: RazorpayResponse) => void; modal: { ondismiss: () => void } };
type RazorpayInstance = { open: () => void };
type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window { Razorpay?: RazorpayConstructor }
}

export function PaymentButton({ amount, testId }: { amount: number; testId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function startPayment() {
    setLoading(true);
    setMessage(null);
    try {
      if (!window.Razorpay) throw new Error("Payment checkout is still loading. Please try again.");
      const orderResponse = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, testId }),
      });
      const orderResult = await orderResponse.json().catch(() => ({}));
      if (!orderResponse.ok || !orderResult.success) throw new Error(orderResult.error || "Unable to start payment.");

      const checkout = new window.Razorpay({
        key: orderResult.data.keyId,
        amount: orderResult.data.order.amount,
        currency: orderResult.data.order.currency,
        name: "Xophal",
        description: "Mock test access",
        order_id: orderResult.data.order.id,
        handler: async (response) => {
          const verifyResponse = await fetch("/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...response, testId }),
          });
          const verifyResult = await verifyResponse.json().catch(() => ({}));
          if (!verifyResponse.ok || !verifyResult.success || !verifyResult.data?.success) throw new Error(verifyResult.error || "Payment could not be verified.");
          setMessage("Payment successful. This mock test is unlocked.");
          setLoading(false);
        },
        modal: { ondismiss: () => setLoading(false) },
      });
      checkout.open();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment failed. Please try again.");
      setLoading(false);
    }
  }

  return <div className="space-y-2"><Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" /><Button type="button" onClick={startPayment} disabled={loading} className="w-full">{loading ? "Processing..." : `Unlock test for ₹${amount}`}</Button>{message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}</div>;
}