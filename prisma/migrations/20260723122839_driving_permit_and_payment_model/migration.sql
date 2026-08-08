/*
  Warnings:

  - You are about to drop the column `deposit_paid` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `id_number` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `id_type` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `deposit_rate_percent` on the `system_settings` table. All the data in the column will be lost.
  - You are about to drop the column `late_fee_per_day` on the `system_settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "deposit_paid",
ADD COLUMN     "amount_paid" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "refund_due" DECIMAL(10,2),
ADD COLUMN     "refunded_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "id_number",
DROP COLUMN "id_type",
ADD COLUMN     "driving_permit_number" VARCHAR(50) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "system_settings" DROP COLUMN "deposit_rate_percent",
DROP COLUMN "late_fee_per_day",
ADD COLUMN     "late_return_grace_hours" INTEGER NOT NULL DEFAULT 2,
ALTER COLUMN "cancellation_fee_percent" SET DEFAULT 25;

-- DropEnum
DROP TYPE "id_type";
