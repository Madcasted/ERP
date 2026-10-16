CREATE TABLE "FilamentSpool" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "color" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "initialWeightGrams" DOUBLE PRECISION NOT NULL,
    "remainingWeightGrams" DOUBLE PRECISION NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FilamentSpool_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FilamentUsage" (
    "id" TEXT NOT NULL,
    "spoolId" TEXT NOT NULL,
    "printJob" TEXT NOT NULL,
    "amountGrams" DOUBLE PRECISION NOT NULL,
    "usedBy" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FilamentUsage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FilamentUsage_spoolId_idx" ON "FilamentUsage"("spoolId");
CREATE INDEX "FilamentUsage_usedAt_idx" ON "FilamentUsage"("usedAt");

ALTER TABLE "FilamentUsage" ADD CONSTRAINT "FilamentUsage_spoolId_fkey"
    FOREIGN KEY ("spoolId") REFERENCES "FilamentSpool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FilamentUsage" ADD CONSTRAINT "FilamentUsage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
