import { prisma } from "@/lib/prisma";
import { MaintenanceManager } from "@/components/admin/maintenance-manager";
import { formatVehicleWithDetails } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PROVIDER_TYPE_LABEL: Record<string, string> = {
  MECHANIC: "Mechanic",
  AUTO_DETAILER: "Auto Detailer",
  BODY_TECHNICIAN: "Body Technician",
  WINDOW_TINTING: "Window Tinting Specialist",
  OTHER: "Other",
};

export default async function MaintenancePage() {
  const [records, vehicles, providers] = await Promise.all([
    prisma.maintenanceRecord.findMany({
      include: { vehicle: true, provider: true },
      orderBy: { serviceDate: "desc" },
    }),
    prisma.vehicle.findMany({ orderBy: { vehicleId: "asc" } }),
    prisma.maintenanceProvider.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <MaintenanceManager
      initialRecords={records.map((r) => ({
        maintenanceId: r.maintenanceId,
        vehicleId: r.vehicleId,
        vehicleLabel: formatVehicleWithDetails(r.vehicle),
        serviceType: r.serviceType,
        serviceDate: r.serviceDate.toISOString(),
        providerId: r.providerId,
        providerLabel: `${r.provider.name} — ${PROVIDER_TYPE_LABEL[r.provider.serviceType] ?? r.provider.serviceType}`,
        status: r.status,
      }))}
      vehicles={vehicles.map((v) => ({
        vehicleId: v.vehicleId,
        label: formatVehicleWithDetails(v),
      }))}
      providers={providers.map((p) => ({
        providerId: p.providerId,
        name: p.name,
        serviceType: p.serviceType,
        label: `${p.name} — ${PROVIDER_TYPE_LABEL[p.serviceType] ?? p.serviceType}`,
      }))}
    />
  );
}
