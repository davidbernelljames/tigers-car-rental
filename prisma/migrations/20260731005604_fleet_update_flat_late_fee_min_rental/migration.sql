/*
  Warnings:

  - The values [WAGON] on the enum `vehicle_category` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `year` on the `vehicles` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "vehicle_category_new" AS ENUM ('ECONOMY', 'SEDAN');
ALTER TABLE "vehicles" ALTER COLUMN "category" TYPE "vehicle_category_new" USING ("category"::text::"vehicle_category_new");
ALTER TABLE "promotions" ALTER COLUMN "vehicle_category" TYPE "vehicle_category_new" USING ("vehicle_category"::text::"vehicle_category_new");
ALTER TYPE "vehicle_category" RENAME TO "vehicle_category_old";
ALTER TYPE "vehicle_category_new" RENAME TO "vehicle_category";
DROP TYPE "vehicle_category_old";
COMMIT;

-- AlterEnum
ALTER TYPE "vehicle_status" ADD VALUE 'RETIRED';

-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "late_fee_amount" DECIMAL(8,2) NOT NULL DEFAULT 100,
ALTER COLUMN "late_return_grace_hours" SET DEFAULT 1;

-- AlterTable
ALTER TABLE "vehicles" DROP COLUMN "year";
