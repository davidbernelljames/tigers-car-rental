import { prisma } from "@/lib/prisma";
import { FleetManager } from "@/components/admin/fleet-manager";

export const dynamic = "force-dynamic";

export default async function FleetPage() {
  const vehicles = await prisma.vehicle.findMany({ orderBy: { vehicleId: "asc" } });

  return (
    <FleetManager
      initialVehicles={vehicles.map((v) => ({
        ...v,
        dailyRate: Number(v.dailyRate),
      }))}
    />
  );
}
