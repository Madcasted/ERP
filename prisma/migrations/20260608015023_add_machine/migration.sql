-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineLog" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "matCode" TEXT,
    "company" TEXT,
    "rollNo" INTEGER NOT NULL,
    "matWeight" DOUBLE PRECISION,
    "timeOpen" DOUBLE PRECISION,
    "timeClose" DOUBLE PRECISION,
    "goodPcs" INTEGER NOT NULL DEFAULT 0,
    "defectPcs" INTEGER NOT NULL DEFAULT 0,
    "operator1" TEXT,
    "operator2" TEXT,
    "returnedBy" TEXT,
    "returnedQty" INTEGER,
    "timerPrintDown" DOUBLE PRECISION,
    "timerPrintUp" DOUBLE PRECISION,
    "timerPrintTop" DOUBLE PRECISION,
    "timerOpenVac1" DOUBLE PRECISION,
    "timerCloseVac1" DOUBLE PRECISION,
    "timerOpenVac2" DOUBLE PRECISION,
    "timerCloseVac2" DOUBLE PRECISION,
    "timerOpenFan" DOUBLE PRECISION,
    "timerCloseFan" DOUBLE PRECISION,
    "timerOpenBlow" DOUBLE PRECISION,
    "timerCloseBlow" DOUBLE PRECISION,
    "timerOpenHeat" DOUBLE PRECISION,
    "timerHeat" DOUBLE PRECISION,
    "timerOpenShield" DOUBLE PRECISION,
    "unrollSpeed" DOUBLE PRECISION,
    "runSpeed" DOUBLE PRECISION,
    "runLength" DOUBLE PRECISION,
    "programNo" INTEGER,
    "heat" JSONB,
    "recordedBy" TEXT,
    "recordedAt" TIMESTAMP(3),
    "logDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MachineLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Machine_code_key" ON "Machine"("code");

-- AddForeignKey
ALTER TABLE "MachineLog" ADD CONSTRAINT "MachineLog_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
