import { prisma } from "@/lib/prisma";
import { PromotionsManager } from "@/components/admin/promotions-manager";
import { formatVehicleWithDetails } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PromotionsPage() {
  const [promotions, vehicles] = await Promise.all([
    prisma.promotion.findMany({ include: { vehicle: true }, orderBy: { startDate: "desc" } }),
    prisma.vehicle.findMany({ orderBy: { vehicleId: "asc" } }),
  ]);

  const now = new Date();

  return (
    <PromotionsManager
      initialPromotions={promotions.map((p) => ({
        promotionId: p.promotionId,
        code: p.code,
        vehicleCategory: p.vehicleCategory,
        discountPercent: Number(p.discountPercent),
        startDate: p.startDate.toISOString().split("T")[0],
        expiryDate: p.expiryDate.toISOString().split("T")[0],
        vehicleId: p.vehicleId,
        vehicleLabel: p.vehicle ? formatVehicleWithDetails(p.vehicle) : null,
        isActive: p.startDate <= now && p.expiryDate >= now,
      }))}
      vehicles={vehicles.map((v) => ({ vehicleId: v.vehicleId, label: formatVehicleWithDetails(v) }))}
    />
  );
}
