import VerifyEmailForm from "./VerifyEmailForm";
import { Suspense } from "react";

export const metadata = { title: "Verify your email" };

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}