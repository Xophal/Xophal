import Link from "next/link";
import BrandWordmark from "@/components/brand/BrandWordmark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <Link href="/" aria-label="Xophol home" className="absolute left-4 top-4 rounded-md p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:left-8 sm:top-6">
        <BrandWordmark />
      </Link>
      {children}
    </div>
  );
}
