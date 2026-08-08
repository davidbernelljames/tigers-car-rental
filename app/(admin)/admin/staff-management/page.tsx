import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/staff-auth";
import { StaffManager } from "@/components/admin/staff-manager";

export const dynamic = "force-dynamic";

export default async function StaffManagementPage() {
  const [staff, session] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    getStaffSession(),
  ]);

  return (
    <StaffManager
      initialStaff={staff}
      currentUserId={session?.user.userId ?? -1}
    />
  );
}
