/*
  Warnings:

  - The values [SUV,PICKUP] on the enum `vehicle_category` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "vehicle_category_new" AS ENUM ('ECONOMY', 'SEDAN', 'WAGON');
ALTER TABLE "vehicles" ALTER COLUMN "category" TYPE "vehicle_category_new" USING ("category"::text::"vehicle_category_new");
ALTER TABLE "promotions" ALTER COLUMN "vehicle_category" TYPE "vehicle_category_new" USING ("vehicle_category"::text::"vehicle_category_new");
ALTER TYPE "vehicle_category" RENAME TO "vehicle_category_old";
ALTER TYPE "vehicle_category_new" RENAME TO "vehicle_category";
DROP TYPE "vehicle_category_old";
COMMIT;
