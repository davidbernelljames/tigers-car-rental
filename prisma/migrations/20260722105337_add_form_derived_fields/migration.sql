-- CreateEnum
CREATE TYPE "fuel_level" AS ENUM ('FULL', 'THREE_QUARTER', 'HALF', 'QUARTER', 'EMPTY');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "fuel_level_at_pickup" "fuel_level",
ADD COLUMN     "mileage_at_pickup" INTEGER;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "address" VARCHAR(255) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "late_fee_per_day" DECIMAL(8,2) NOT NULL DEFAULT 50;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "registration_number" VARCHAR(20);
