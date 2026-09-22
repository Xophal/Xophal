import { Suspense } from "react";
import { RegisterFlow } from "@/components/auth/register-flow";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthFooter } from "@/components/auth/auth-footer";

export const metadata = { title: "Create Account" };

export default function RegisterPage() {
  return (
    <div className="student-auth-shell flex min-h-screen flex-col">
      <div className="flex-1">
        <Suspense fallback={<Skeleton className="h-96 w-full max-w-xl" />}>
          <RegisterFlow />
        </Suspense>
      </div>
      <AuthFooter />
    </div>
  );
}
