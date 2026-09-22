import { redirect } from "next/navigation";
import { AdminRegisterForm } from "@/components/auth/admin-register-form";

export const metadata = { title: "Admin Create Account" };

export default function AdminRegisterPage() {
  // Allow self-service admin registration only when explicitly enabled via
  // the `ENABLE_ADMIN_SELF_REGISTER` environment variable. Otherwise,
  // redirect to admin login as privileged accounts must be provisioned
  // by an existing super administrator.
  const enabled = process.env.ENABLE_ADMIN_SELF_REGISTER === "true";
  if (!enabled) {
    redirect("/admin/login");
  }

  // Render client-side admin register form when enabled.
  return <div className="admin-auth-shell min-h-screen"><AdminRegisterForm /></div>;
}
