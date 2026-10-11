/*
  Warnings:

  - The primary key for the `WishlistItem` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `variantId` on the `WishlistItem` table. All the data in the column will be lost.
  - Added the required column `productId` to the `WishlistItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "WishlistItem" DROP CONSTRAINT "WishlistItem_variantId_fkey";

-- AlterTable
ALTER TABLE "WishlistItem" DROP CONSTRAINT "WishlistItem_pkey",
DROP COLUMN "variantId",
ADD COLUMN     "productId" TEXT NOT NULL,
ADD CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("userId", "productId");

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
