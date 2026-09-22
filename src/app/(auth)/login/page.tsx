import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthFooter } from "@/components/auth/auth-footer";

export const metadata = { title: "Sign In" };

export default function LoginPage() {
  return (
    <div className="student-auth-shell flex min-h-screen flex-col">
      <div className="flex-1">
        <Suspense fallback={<Skeleton className="h-96 w-full max-w-md" />}>
          <LoginForm />
        </Suspense>
      </div>
      <AuthFooter />
    </div>
  );
}
