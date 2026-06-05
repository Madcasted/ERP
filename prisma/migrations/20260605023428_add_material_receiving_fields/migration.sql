-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "invoiceNo" TEXT,
ADD COLUMN     "lotNumber" TEXT,
ADD COLUMN     "productCode" TEXT,
ADD COLUMN     "receivingDate" TIMESTAMP(3),
ADD COLUMN     "supplier" TEXT,
ADD COLUMN     "weight" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "MaterialReceiving" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "productCode" TEXT,
    "weight" DOUBLE PRECISION NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "receivingDate" TIMESTAMP(3) NOT NULL,
    "qcStatus" TEXT DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialReceiving_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MaterialReceiving" ADD CONSTRAINT "MaterialReceiving_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
