-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "pending_extension_cost" DECIMAL(10,2),
ADD COLUMN     "pending_extension_return_date" TIMESTAMP(3);
