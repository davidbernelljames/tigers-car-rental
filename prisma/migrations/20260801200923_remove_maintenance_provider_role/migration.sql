/*
  Warnings:

  - The values [MAINTENANCE_PROVIDER] on the enum `user_role` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "user_role_new" AS ENUM ('OWNER_ADMIN', 'STAFF_AGENT');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "user_role_new" USING ("role"::text::"user_role_new");
ALTER TYPE "user_role" RENAME TO "user_role_old";
ALTER TYPE "user_role_new" RENAME TO "user_role";
DROP TYPE "user_role_old";
COMMIT;
