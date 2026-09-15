-- AlterTable
UPDATE "Customer" SET "role" = 'EMPLOYEE' WHERE "role" = 'CUSTOMER';
ALTER TABLE "Customer" ALTER COLUMN "role" SET DEFAULT 'EMPLOYEE';
