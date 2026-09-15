-- CreateTable
CREATE TABLE "MaterialReceipt" (
    "id" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "receivedDate" TEXT,
    "supplier" TEXT,
    "supplierNote" TEXT,
    "invoiceNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRoll" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "rollNo" INTEGER NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "issueDate" TEXT,
    "issuer" TEXT,
    "productCode" TEXT,
    "lotNo" TEXT,
    "goodQty" TEXT,
    "defectQty" TEXT,
    "diecutQty" TEXT,
    "diecutReceiveDate" TEXT,
    "packQty" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialRoll_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MaterialRoll" ADD CONSTRAINT "MaterialRoll_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "MaterialReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
