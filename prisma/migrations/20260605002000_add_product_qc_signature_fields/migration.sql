-- AlterTable
ALTER TABLE "Product"
ADD COLUMN "labelQc1Mode" TEXT DEFAULT 'text',
ADD COLUMN "labelQc1Image" TEXT,
ADD COLUMN "labelQc2Mode" TEXT DEFAULT 'text',
ADD COLUMN "labelQc2Image" TEXT;
