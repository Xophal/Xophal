import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies the Razorpay checkout handshake signature:
 *   expected = HMAC_SHA256(`${orderId}|${paymentId}`, key_secret)
 * Comparison is constant-time and length-checked.
 */
export function isValidRazorpaySignature(orderId: string, paymentId: string, signature: string, secret: string) {
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return timingSafeEqualHex(expected, signature);
}

/** Verifies a Razorpay webhook body against the configured webhook secret. */
export function isValidRazorpayWebhookSignature(rawBody: string, signature: string, secret: string) {
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeEqualHex(expected, signature);
}

export function isCapturedRazorpayPayment(
  payment: { id?: string; order_id?: string; status?: string; amount?: number | string; currency?: string },
  expected: { paymentId: string; orderId: string; amountMinor: number; currency: string },
) {
  return payment.id === expected.paymentId
    && payment.order_id === expected.orderId
    && payment.status === "captured"
    && Number(payment.amount) === expected.amountMinor
    && payment.currency?.toUpperCase() === expected.currency.toUpperCase();
}

function timingSafeEqualHex(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(received, "utf8");
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}
