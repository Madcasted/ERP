-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('PARTITION', 'TRAY', 'BOX_PP', 'BOX_TP', 'PAPER_BOX', 'WOOD_CORNER');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "category" "ProductCategory";
ALTER TABLE "Product" ADD COLUMN "customerCompany" TEXT;

-- AlterTable
ALTER TABLE "Machine" ADD COLUMN "note" TEXT;
