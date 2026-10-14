-- Direct sales: albums are bought straight from the artist, and the
-- subscription pool, payout runs, hosting bills and donation reserve go.

-- DropForeignKey
ALTER TABLE "Allocation" DROP CONSTRAINT "Allocation_artistId_fkey";

-- DropForeignKey
ALTER TABLE "Allocation" DROP CONSTRAINT "Allocation_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "Allocation" DROP CONSTRAINT "Allocation_payoutRunId_fkey";

-- DropForeignKey
ALTER TABLE "Allocation" DROP CONSTRAINT "Allocation_userId_fkey";

-- DropForeignKey
ALTER TABLE "ArtistEarning" DROP CONSTRAINT "ArtistEarning_artistId_fkey";

-- DropForeignKey
ALTER TABLE "ArtistEarning" DROP CONSTRAINT "ArtistEarning_payoutRunId_fkey";

-- DropForeignKey
ALTER TABLE "Donation" DROP CONSTRAINT "Donation_userId_fkey";

-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_payoutRunId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_userId_fkey";

-- DropForeignKey
ALTER TABLE "SubscriptionPayment" DROP CONSTRAINT "SubscriptionPayment_payoutRunId_fkey";

-- DropForeignKey
ALTER TABLE "SubscriptionPayment" DROP CONSTRAINT "SubscriptionPayment_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "SubscriptionPayment" DROP CONSTRAINT "SubscriptionPayment_userId_fkey";

-- Payout accounts become payment accounts (buyers now pay the artist directly).
ALTER TABLE "Artist" RENAME COLUMN "payoutsEnabled" TO "paymentsEnabled";

-- Keep existing purchases (buyers keep their albums): the gross amount becomes amountCents.
ALTER TABLE "Purchase" ADD COLUMN "amountCents" INTEGER,
ADD COLUMN     "stripeAccountId" TEXT,
ADD COLUMN     "stripePaymentIntentId" TEXT;
UPDATE "Purchase" SET "amountCents" = "grossCents";
ALTER TABLE "Purchase" ALTER COLUMN "amountCents" SET NOT NULL,
DROP COLUMN "feeCents",
DROP COLUMN "grossCents",
DROP COLUMN "netCents",
DROP COLUMN "payoutRunId",
DROP COLUMN "taxCents";

-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "open" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "Allocation";

-- DropTable
DROP TABLE "ArtistEarning";

-- DropTable
DROP TABLE "Donation";

-- DropTable
DROP TABLE "HostingCost";

-- DropTable
DROP TABLE "PayoutRun";

-- DropTable
DROP TABLE "ReserveEntry";

-- DropTable
DROP TABLE "Subscription";

-- DropTable
DROP TABLE "SubscriptionPayment";

-- DropEnum
DROP TYPE "AllocationKind";

-- DropEnum
DROP TYPE "PayoutRunStatus";

-- DropEnum
DROP TYPE "ReserveKind";

-- DropEnum
DROP TYPE "SubscriptionStatus";

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_stripePaymentIntentId_key" ON "Purchase"("stripePaymentIntentId");

