"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, CircleDollarSign, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type PayoutAccount = {
  account_status: string;
  activation_status: string;
  settlement_verification_status: string;
  settlement_account_last4: string | null;
};

type AccountResponse = { enabled: boolean; account: PayoutAccount | null };

export default function EbookPayoutControls() {
  const [state, setState] = useState<AccountResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [settlementMethod, setSettlementMethod] = useState<"bank_account" | "upi">("bank_account");

  useEffect(() => {
    let active = true;
    fetch("/api/ebooks/payout-account", { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || "Could not load payout account status.");
        return json.data as AccountResponse;
      })
      .then((result) => { if (active) setState(result); })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "Could not load payout account status."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function submitOnboarding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmitting(true);
    setError("");
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const method = String(formData.get("settlementMethod"));
    const settlementAccount = method === "upi"
      ? {
          method,
          vpa: String(formData.get("vpa") ?? "").trim(),
          beneficiaryName: String(formData.get("beneficiaryName") ?? "").trim(),
        }
      : {
          method: "bank_account",
          accountNumber: String(formData.get("accountNumber") ?? "").trim(),
          beneficiaryName: String(formData.get("beneficiaryName") ?? "").trim(),
          ifsc: String(formData.get("ifsc") ?? "").trim(),
        };

    try {
      const response = await fetch("/api/ebooks/payout-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalBusinessName: String(formData.get("legalBusinessName") ?? "").trim(),
          businessType: "individual",
          pan: String(formData.get("pan") ?? "").trim(),
          phone: String(formData.get("phone") ?? "").trim(),
          tncAccepted: formData.get("tncAccepted") === "on",
          settlementAccount,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Payout onboarding could not be submitted.");
      setState((current) => ({
        enabled: current?.enabled ?? true,
        account: {
          account_status: json.data.account.accountStatus,
          activation_status: json.data.account.activationStatus,
          settlement_verification_status: json.data.account.settlementVerificationStatus,
          settlement_account_last4: json.data.account.settlementAccountLast4 || null,
        },
      }));
      setMessage("Your payout details were sent securely to Razorpay. The original bank or UPI details are not stored by Xophol.");
      form.reset();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Payout onboarding could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  async function requestPayout() {
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/ebooks/payouts/request", { method: "POST" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Payout could not be requested.");
      setMessage(json.data.status === "TRANSFERRED"
        ? `Transferred to your Razorpay linked account; bank settlement follows Razorpay's schedule. Reference: ${json.data.providerReference}`
        : `Payout processing. Reference: ${json.data.providerReference}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Payout could not be requested.");
    } finally {
      setSubmitting(false);
    }
  }

  const account = state?.account;
  const accountReady = account?.activation_status === "activated"
    && account.settlement_verification_status === "verified";

  return (
    <section className="border-y border-border py-5" aria-labelledby="ebook-payout-heading">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id="ebook-payout-heading" className="font-semibold text-foreground">Seller payouts</h2>
          {loading ? <p role="status" className="mt-2 text-sm text-muted-foreground">Checking payout setup…</p> : null}
          {!loading && !state?.enabled ? <p className="mt-2 text-sm text-muted-foreground">Razorpay Route onboarding is not enabled for this marketplace yet.</p> : null}

          {!loading && state?.enabled && !account ? (
            <form onSubmit={submitOnboarding} className="mt-4 grid gap-4 sm:grid-cols-2">
              <p className="text-sm leading-6 text-muted-foreground sm:col-span-2">
                Individual seller onboarding is handled by Razorpay Route. PAN and bank or UPI details are sent to Razorpay for verification; Xophol does not retain those original details.
              </p>
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                Legal name <input name="legalBusinessName" required minLength={4} maxLength={200} autoComplete="name" className="h-10 rounded-md border border-input bg-background px-3 font-normal" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                Phone <input name="phone" type="tel" required autoComplete="tel" placeholder="+919876543210" className="h-10 rounded-md border border-input bg-background px-3 font-normal" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-foreground sm:col-span-2">
                PAN <input name="pan" required maxLength={10} autoComplete="off" className="h-10 uppercase rounded-md border border-input bg-background px-3 font-normal" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                Settlement method
                <select name="settlementMethod" value={settlementMethod} onChange={(event) => setSettlementMethod(event.target.value as "bank_account" | "upi")} className="h-10 rounded-md border border-input bg-background px-3 font-normal">
                  <option value="bank_account">Bank account</option>
                  <option value="upi">UPI</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                Beneficiary name <input name="beneficiaryName" required minLength={2} maxLength={160} autoComplete="name" className="h-10 rounded-md border border-input bg-background px-3 font-normal" />
              </label>
              {settlementMethod === "bank_account" ? <>
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  Bank account number <input name="accountNumber" inputMode="numeric" pattern="[0-9]{5,20}" required className="h-10 rounded-md border border-input bg-background px-3 font-normal" />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  IFSC <input name="ifsc" maxLength={11} autoCapitalize="characters" required className="h-10 uppercase rounded-md border border-input bg-background px-3 font-normal" />
                </label>
              </> : <label className="grid gap-1.5 text-sm font-medium text-foreground sm:col-span-2">
                UPI VPA <input name="vpa" required placeholder="name@bank" className="h-10 rounded-md border border-input bg-background px-3 font-normal" />
              </label>}
              <label className="flex items-start gap-2 text-sm text-muted-foreground sm:col-span-2">
                <input name="tncAccepted" type="checkbox" required className="mt-1" />
                <span>I accept Razorpay&apos;s terms for linked-account onboarding and confirm these settlement details are mine.</span>
              </label>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
                  Submit payout details
                </Button>
              </div>
            </form>
          ) : null}

          {!loading && state?.enabled && account ? (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-foreground">
                  Account review: <span className="font-semibold">{account.activation_status.replaceAll("_", " ")}</span>
                  {account.settlement_account_last4 ? ` · ending ${account.settlement_account_last4}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Settlement verification: {account.settlement_verification_status.replaceAll("_", " ")}</p>
              </div>
              <Button type="button" variant="outline" disabled={!accountReady || submitting} onClick={requestPayout}>
                {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CircleDollarSign aria-hidden="true" />}
                Request available payout
              </Button>
            </div>
          ) : null}

          {error ? <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}</p> : null}
          {message ? <p role="status" className="mt-3 flex items-start gap-2 text-sm text-emerald-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{message}</p> : null}
        </div>
      </div>
    </section>
  );
}