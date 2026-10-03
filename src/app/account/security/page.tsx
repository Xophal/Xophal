import { redirect } from "next/navigation";
import ChangePasswordForm from "@/components/auth/ChangePasswordForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";

export const metadata = { title: "Account security | Xophol" };

export default async function AccountSecurityPage() {
  const session = await requireAuth();
  if (!session) redirect("/login?redirect=%2Faccount%2Fsecurity");

  return (
    <main className="container mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Account security</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage the password used to sign in to your Xophol account.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            Confirm your current password before choosing a new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
