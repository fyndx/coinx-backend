-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('Income', 'Expense');

-- CreateTable
CREATE TABLE "coinx_transaction" (
    "id" TEXT NOT NULL,
    "transaction_time" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "transaction_type" "TransactionType" NOT NULL,
    "category_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "coinx_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coinx_category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "coinx_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coinx_product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "notes" TEXT,
    "default_unit_category" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coinx_product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coinx_store" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "coinx_store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coinx_product_listing" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "url" TEXT,
    "price" DECIMAL(65,30) NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "coinx_product_listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coinx_product_listing_history" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_listing_id" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coinx_product_listing_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coinx_category_name_key" ON "coinx_category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "coinx_category_icon_key" ON "coinx_category"("icon");

-- CreateIndex
CREATE UNIQUE INDEX "coinx_category_color_key" ON "coinx_category"("color");

-- CreateIndex
CREATE UNIQUE INDEX "coinx_store_name_key" ON "coinx_store"("name");

-- CreateIndex
CREATE UNIQUE INDEX "coinx_store_name_location_key" ON "coinx_store"("name", "location");

-- CreateIndex
CREATE INDEX "coinx_product_listing_product_id_idx" ON "coinx_product_listing"("product_id");

-- CreateIndex
CREATE INDEX "coinx_product_listing_store_id_idx" ON "coinx_product_listing"("store_id");

-- CreateIndex
CREATE INDEX "coinx_product_listing_history_product_id_idx" ON "coinx_product_listing_history"("product_id");

-- CreateIndex
CREATE INDEX "coinx_product_listing_history_product_listing_id_idx" ON "coinx_product_listing_history"("product_listing_id");

-- CreateIndex
CREATE INDEX "coinx_product_listing_history_recorded_at_idx" ON "coinx_product_listing_history"("recorded_at");

-- AddForeignKey
ALTER TABLE "coinx_transaction" ADD CONSTRAINT "coinx_transaction_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "coinx_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coinx_product_listing" ADD CONSTRAINT "coinx_product_listing_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "coinx_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coinx_product_listing" ADD CONSTRAINT "coinx_product_listing_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "coinx_store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coinx_product_listing_history" ADD CONSTRAINT "coinx_product_listing_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "coinx_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coinx_product_listing_history" ADD CONSTRAINT "coinx_product_listing_history_product_listing_id_fkey" FOREIGN KEY ("product_listing_id") REFERENCES "coinx_product_listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
