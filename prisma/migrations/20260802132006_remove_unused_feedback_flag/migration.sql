/*
  Warnings:

  - You are about to drop the column `feedback_request_enabled` on the `system_settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "system_settings" DROP COLUMN "feedback_request_enabled";
