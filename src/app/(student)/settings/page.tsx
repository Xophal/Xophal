import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import ProfileForm from "@/components/profile/ProfileForm";
import ProfileSettingsForm from "@/components/profile/ProfileSettingsForm";
import LogoutButton from "@/components/auth/LogoutButton";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireAuth();

  if (!session?.profile) {
    return <div className="p-8 text-sm text-muted-foreground">Please sign in to manage your settings.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Manage your account preferences and learning experience.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Basic account details and preferences.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Name:</span> {session.profile.full_name || "Student"}</p>
            <p><span className="text-muted-foreground">Email:</span> {session.profile.email || "Not provided"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Learning Preferences</CardTitle>
            <CardDescription>Student setup and personalization.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Board:</span> {session.profile.board_id ? "Configured" : "Not set"}</p>
            <p><span className="text-muted-foreground">Class:</span> {session.profile.class_id ? "Configured" : "Not set"}</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Academic profile</CardTitle>
            <CardDescription>Change your board, class, and personal learning details.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm initial={session.profile} />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Learning preferences</CardTitle>
            <CardDescription>Personalize your study pace and notifications.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileSettingsForm initial={session.profile} />
          </CardContent>
        </Card>

        <Card className="md:col-span-2 border-destructive/20">
          <CardHeader>
            <CardTitle>Session and account</CardTitle>
            <CardDescription>Sign out of this device when you are finished studying.</CardDescription>
          </CardHeader>
          <CardContent>
            <LogoutButton />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
