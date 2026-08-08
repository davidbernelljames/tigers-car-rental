/*
  Warnings:

  - You are about to drop the column `pending_extension_cost` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `pending_extension_return_date` on the `bookings` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "extension_status" AS ENUM ('NONE', 'PENDING_REVIEW', 'APPROVED_AWAITING_PAYMENT', 'DECLINED');

-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "pending_extension_cost",
DROP COLUMN "pending_extension_return_date",
ADD COLUMN     "extension_cost" DECIMAL(10,2),
ADD COLUMN     "extension_decline_reason" VARCHAR(255),
ADD COLUMN     "extension_requested_return_date" TIMESTAMP(3),
ADD COLUMN     "extension_status" "extension_status" NOT NULL DEFAULT 'NONE';
