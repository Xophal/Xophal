import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import ProfileForm from "@/components/profile/ProfileForm";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await requireAuth();

  if (!session?.profile) {
    return <div className="p-8 text-sm text-muted-foreground">Please sign in to view your profile.</div>;
  }

  const profile = session.profile;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your personal learning profile and account overview.</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{profile.full_name || "Student"}</CardTitle>
            <CardDescription>{profile.email || "No email available"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Level</span>
              <strong>{profile.level || 1}</strong>
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Total XP</span>
              <strong>{profile.total_xp || 0}</strong>
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Current streak</span>
              <strong>{profile.current_streak || 0} days</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Role</span>
              <strong>{profile.role_id ? "Student" : "Learner"}</strong>
            </div>
          </CardContent>
        </Card>

        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Edit profile</CardTitle>
            <CardDescription>Update fields you're allowed to change.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm initial={profile} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
