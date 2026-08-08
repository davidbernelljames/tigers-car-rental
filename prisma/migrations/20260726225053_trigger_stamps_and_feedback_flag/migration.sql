-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "feedback_request_sent_at" TIMESTAMP(3),
ADD COLUMN     "reminder_24_sent_at" TIMESTAMP(3),
ADD COLUMN     "reminder_48_sent_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "feedback_notifications_enabled" BOOLEAN NOT NULL DEFAULT true;
