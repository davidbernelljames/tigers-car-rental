import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/staff-auth";
import { AdminShell } from "@/components/admin/admin-shell";

// Wraps every /admin/* page except /admin/login (that page renders its own
// full-screen layout with no sidebar, since there's no session yet to show
// staff name/role for).
//
// middleware.ts already redirects unauthenticated or wrong-role requests
// before they reach here, so the redirect below is a defensive fallback
// (e.g. a session that expired between the middleware check and the page
// render), not the primary enforcement.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getStaffSession();

  if (!session) {
    redirect("/admin/login");
  }

  return (
    <AdminShell
      role={session.role}
      staffName={`${session.user.firstName} ${session.user.lastName}`.trim()}
    >
      {children}
    </AdminShell>
  );
}
