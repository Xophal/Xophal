import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AdminMetrics from "@/components/admin/AdminMetrics";
import RecentActivity from "@/components/admin/RecentActivity";

const adminModules = [
  { title: "Create admin", description: "Create a private admin or content-manager account", href: "/admin/create-admin" },
  { title: "Boards", description: "Add and manage boards like CBSE and SEBA", href: "/admin/boards" },
  { title: "Classes", description: "Manage classes and board-specific grade track", href: "/admin/classes" },
  { title: "Subjects", description: "Organize the subject tree for each class", href: "/admin/subjects" },
  { title: "Notes", description: "Publish revision notes and study guides", href: "/admin/notes" },
  { title: "Mock tests", description: "Create and manage timed practice exams", href: "/admin/mock-tests" },
  { title: "Content imports", description: "Validate bulk CSV imports before publishing", href: "/admin/content/imports" },
  { title: "Content hub", description: "Manage posts, lessons, and content drafts", href: "/admin/content" },
  { title: "Users", description: "Review accounts, roles, and account activity", href: "/admin/users" },
  { title: "Admin requests", description: "Approve or reject new administrator signups", href: "/admin/admin-requests" },
  { title: "Analytics", description: "Track platform usage and test performance", href: "/admin/analytics" },
  { title: "Settings", description: "Review your administrator account and access", href: "/admin/settings" },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Admin dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">A compact control center for the implemented platform operations.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {adminModules.map((module) => (
          <Card key={module.title}>
            <CardHeader>
              <CardTitle>{module.title}</CardTitle>
              <CardDescription>{module.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={module.href} className="text-sm font-medium text-primary">
                Open module →
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-2xl font-semibold">Overview</h2>
        <div className="mt-4">
          {/* metrics */}
          <AdminMetrics />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <RecentActivity />
        </div>
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold">Quick actions</h3>
            <div className="mt-3 flex flex-col gap-3">
              <Link href="/admin/boards" className="rounded-md border px-3 py-2 text-sm text-primary hover:bg-primary/5">Create board</Link>
              <Link href="/admin/classes" className="rounded-md border px-3 py-2 text-sm text-primary hover:bg-primary/5">Create class</Link>
              <Link href="/admin/content/imports" className="rounded-md border px-3 py-2 text-sm text-primary hover:bg-primary/5">Upload import</Link>
              <Link href="/admin/content" className="rounded-md border px-3 py-2 text-sm text-primary hover:bg-primary/5">Create content</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
