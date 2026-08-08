import { prisma } from "@/lib/prisma";
import { SettingsManager } from "@/components/admin/settings-manager";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await prisma.systemSettings.findFirst();

  return (
    <SettingsManager
      initialSettings={
        settings
          ? {
              businessName: settings.businessName,
              businessPhone: settings.businessPhone,
              businessPhoneSecondary: settings.businessPhoneSecondary ?? "",
              businessEmail: settings.businessEmail,
              businessAddress: settings.businessAddress,
              fullRefundWindowHours: settings.fullRefundWindowHours,
              cancellationFeePercent: Number(settings.cancellationFeePercent),
              lateReturnGraceHours: settings.lateReturnGraceHours,
              lateFeeAmount: Number(settings.lateFeeAmount),
              reminderNotificationsEnabled: settings.reminderNotificationsEnabled,
              feedbackNotificationsEnabled: settings.feedbackNotificationsEnabled,
            }
          : null
      }
    />
  );
}
