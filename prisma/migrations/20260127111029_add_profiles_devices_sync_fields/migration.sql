/*
  Warnings:

  - A unique constraint covering the columns `[name,user_id]` on the table `coinx_category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,location,user_id]` on the table `coinx_store` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "coinx_category_color_key";

-- DropIndex
DROP INDEX "coinx_category_icon_key";

-- DropIndex
DROP INDEX "coinx_category_name_key";

-- DropIndex
DROP INDEX "coinx_store_name_key";

-- DropIndex
DROP INDEX "coinx_store_name_location_key";

-- AlterTable
ALTER TABLE "coinx_category" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "sync_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "user_id" UUID;

-- AlterTable
ALTER TABLE "coinx_product" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "sync_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_at" TIMESTAMP(3),
ADD COLUMN     "user_id" UUID;

-- AlterTable
ALTER TABLE "coinx_product_listing" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "sync_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "user_id" UUID;

-- AlterTable
ALTER TABLE "coinx_product_listing_history" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "sync_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_at" TIMESTAMP(3),
ADD COLUMN     "user_id" UUID;

-- AlterTable
ALTER TABLE "coinx_store" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "sync_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "user_id" UUID;

-- AlterTable
ALTER TABLE "coinx_transaction" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "sync_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "user_id" UUID;

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_name" TEXT,
    "platform" TEXT,
    "app_version" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE INDEX "devices_user_id_idx" ON "devices"("user_id");

-- CreateIndex
CREATE INDEX "coinx_category_user_id_idx" ON "coinx_category"("user_id");

-- CreateIndex
CREATE INDEX "coinx_category_updated_at_idx" ON "coinx_category"("updated_at");

-- CreateIndex
CREATE INDEX "coinx_category_deleted_at_idx" ON "coinx_category"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "coinx_category_name_user_id_key" ON "coinx_category"("name", "user_id");

-- CreateIndex
CREATE INDEX "coinx_product_user_id_idx" ON "coinx_product"("user_id");

-- CreateIndex
CREATE INDEX "coinx_product_updated_at_idx" ON "coinx_product"("updated_at");

-- CreateIndex
CREATE INDEX "coinx_product_deleted_at_idx" ON "coinx_product"("deleted_at");

-- CreateIndex
CREATE INDEX "coinx_product_listing_user_id_idx" ON "coinx_product_listing"("user_id");

-- CreateIndex
CREATE INDEX "coinx_product_listing_updated_at_idx" ON "coinx_product_listing"("updated_at");

-- CreateIndex
CREATE INDEX "coinx_product_listing_deleted_at_idx" ON "coinx_product_listing"("deleted_at");

-- CreateIndex
CREATE INDEX "coinx_product_listing_history_user_id_idx" ON "coinx_product_listing_history"("user_id");

-- CreateIndex
CREATE INDEX "coinx_product_listing_history_updated_at_idx" ON "coinx_product_listing_history"("updated_at");

-- CreateIndex
CREATE INDEX "coinx_product_listing_history_deleted_at_idx" ON "coinx_product_listing_history"("deleted_at");

-- CreateIndex
CREATE INDEX "coinx_store_user_id_idx" ON "coinx_store"("user_id");

-- CreateIndex
CREATE INDEX "coinx_store_updated_at_idx" ON "coinx_store"("updated_at");

-- CreateIndex
CREATE INDEX "coinx_store_deleted_at_idx" ON "coinx_store"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "coinx_store_name_location_user_id_key" ON "coinx_store"("name", "location", "user_id");

-- CreateIndex
CREATE INDEX "coinx_transaction_user_id_idx" ON "coinx_transaction"("user_id");

-- CreateIndex
CREATE INDEX "coinx_transaction_updated_at_idx" ON "coinx_transaction"("updated_at");

-- CreateIndex
CREATE INDEX "coinx_transaction_deleted_at_idx" ON "coinx_transaction"("deleted_at");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coinx_transaction" ADD CONSTRAINT "coinx_transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coinx_category" ADD CONSTRAINT "coinx_category_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coinx_product" ADD CONSTRAINT "coinx_product_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coinx_store" ADD CONSTRAINT "coinx_store_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coinx_product_listing" ADD CONSTRAINT "coinx_product_listing_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coinx_product_listing_history" ADD CONSTRAINT "coinx_product_listing_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
