/*
  Warnings:

  - You are about to drop the column `provider` on the `maintenance_records` table. All the data in the column will be lost.
  - Added the required column `provider_id` to the `maintenance_records` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "maintenance_provider_type" AS ENUM ('MECHANIC', 'AUTO_DETAILER', 'BODY_TECHNICIAN', 'WINDOW_TINTING', 'OTHER');

-- AlterTable
ALTER TABLE "maintenance_records" DROP COLUMN "provider",
ADD COLUMN     "provider_id" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "maintenance_providers" (
    "provider_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "service_type" "maintenance_provider_type" NOT NULL,
    "phone" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_providers_pkey" PRIMARY KEY ("provider_id")
);

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "maintenance_providers"("provider_id") ON DELETE RESTRICT ON UPDATE CASCADE;
