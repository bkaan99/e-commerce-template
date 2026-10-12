-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "b2bNote" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "dueAt" TIMESTAMP(3);
