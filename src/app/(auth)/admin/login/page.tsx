import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthFooter } from "@/components/auth/auth-footer";

export const metadata = { title: "Admin Sign In" };

export default function AdminLoginPage() {
  const allowSelfRegistration = process.env.ENABLE_ADMIN_SELF_REGISTER === "true";

  return (
    <div className="admin-auth-shell flex min-h-screen flex-col">
      <div className="flex-1">
        <Suspense fallback={<Skeleton className="h-96 w-full max-w-md" />}>
          <LoginForm mode="admin" allowSelfRegistration={allowSelfRegistration} />
        </Suspense>
      </div>
      <AuthFooter />
    </div>
  );
}
