import type { Metadata } from "next";
import RoleInvitationResponse from "./RoleInvitationResponse";

export const metadata: Metadata = {
  title: "Role invitation",
  robots: { index: false, follow: false },
};

export default async function RoleInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const value = Array.isArray(token) ? token[0] ?? "" : token ?? "";
  return <RoleInvitationResponse token={value} />;
}
