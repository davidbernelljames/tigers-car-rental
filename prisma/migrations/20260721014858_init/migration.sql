-- CreateEnum
CREATE TYPE "id_type" AS ENUM ('NATIONAL_ID', 'PASSPORT', 'DRIVERS_PERMIT');

-- CreateEnum
CREATE TYPE "vehicle_category" AS ENUM ('ECONOMY', 'SEDAN', 'SUV', 'PICKUP');

-- CreateEnum
CREATE TYPE "vehicle_status" AS ENUM ('AVAILABLE', 'ON_RENTAL', 'IN_MAINTENANCE');

-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('PENDING', 'CONFIRMED', 'ON_RENTAL', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "transaction_status" AS ENUM ('AUTHORISED', 'DECLINED', 'TIMEOUT', 'RETRY_AUTHORISED', 'RETRY_DECLINED');

-- CreateEnum
CREATE TYPE "maintenance_status" AS ENUM ('SCHEDULED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "agreement_status" AS ENUM ('GENERATED', 'PENDING_RETRY');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('OWNER_ADMIN', 'STAFF_AGENT', 'MAINTENANCE_PROVIDER');

-- CreateTable
CREATE TABLE "customers" (
    "customer_id" SERIAL NOT NULL,
    "first_name" VARCHAR(50) NOT NULL,
    "last_name" VARCHAR(50) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "id_type" "id_type" NOT NULL,
    "id_number" VARCHAR(30) NOT NULL,
    "auth_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "vehicle_id" SERIAL NOT NULL,
    "make" VARCHAR(50) NOT NULL,
    "model" VARCHAR(50) NOT NULL,
    "year" SMALLINT NOT NULL,
    "daily_rate" DECIMAL(8,2) NOT NULL,
    "category" "vehicle_category" NOT NULL,
    "status" "vehicle_status" NOT NULL DEFAULT 'AVAILABLE',
    "photo_url" VARCHAR(255),

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("vehicle_id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "booking_id" SERIAL NOT NULL,
    "booking_ref" VARCHAR(20) NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "vehicle_id" INTEGER NOT NULL,
    "pickup_date" DATE NOT NULL,
    "return_date" DATE NOT NULL,
    "total_cost" DECIMAL(10,2) NOT NULL,
    "deposit_paid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "booking_status" "booking_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("booking_id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "transaction_id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "gateway_ref" VARCHAR(100) NOT NULL,
    "status" "transaction_status" NOT NULL,
    "transaction_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "promotion_id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "vehicle_category" "vehicle_category" NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "start_date" DATE NOT NULL,
    "expiry_date" DATE NOT NULL,
    "vehicle_id" INTEGER,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("promotion_id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "maintenance_id" SERIAL NOT NULL,
    "vehicle_id" INTEGER NOT NULL,
    "service_type" VARCHAR(100) NOT NULL,
    "service_date" DATE NOT NULL,
    "status" "maintenance_status" NOT NULL DEFAULT 'SCHEDULED',
    "provider" VARCHAR(100) NOT NULL,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("maintenance_id")
);

-- CreateTable
CREATE TABLE "rental_agreements" (
    "agreement_id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "file_path" VARCHAR(255) NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "agreement_status" NOT NULL DEFAULT 'GENERATED',

    CONSTRAINT "rental_agreements_pkey" PRIMARY KEY ("agreement_id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "review_id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("review_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" SERIAL NOT NULL,
    "auth_user_id" UUID NOT NULL,
    "first_name" VARCHAR(50) NOT NULL,
    "last_name" VARCHAR(50) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "role" "user_role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "settings_id" SERIAL NOT NULL,
    "business_name" VARCHAR(100) NOT NULL,
    "business_phone" VARCHAR(20) NOT NULL,
    "business_email" VARCHAR(100) NOT NULL,
    "business_address" VARCHAR(255) NOT NULL,
    "full_refund_window_hours" INTEGER NOT NULL DEFAULT 48,
    "cancellation_fee_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "deposit_rate_percent" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "reminder_notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "feedback_request_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("settings_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_auth_user_id_key" ON "customers"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_booking_ref_key" ON "bookings"("booking_ref");

-- CreateIndex
CREATE INDEX "bookings_vehicle_id_pickup_date_return_date_idx" ON "bookings"("vehicle_id", "pickup_date", "return_date");

-- CreateIndex
CREATE INDEX "bookings_booking_status_pickup_date_idx" ON "bookings"("booking_status", "pickup_date");

-- CreateIndex
CREATE UNIQUE INDEX "promotions_code_key" ON "promotions"("code");

-- CreateIndex
CREATE INDEX "promotions_vehicle_category_start_date_expiry_date_idx" ON "promotions"("vehicle_category", "start_date", "expiry_date");

-- CreateIndex
CREATE INDEX "maintenance_records_vehicle_id_service_date_idx" ON "maintenance_records"("vehicle_id", "service_date");

-- CreateIndex
CREATE UNIQUE INDEX "rental_agreements_booking_id_key" ON "rental_agreements"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_booking_id_key" ON "reviews"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_user_id_key" ON "users"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("vehicle_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("booking_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("vehicle_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("vehicle_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_agreements" ADD CONSTRAINT "rental_agreements_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("booking_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("booking_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;
