-- AlterTable
ALTER TABLE "Album" ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "ArtistEarning" ADD COLUMN     "transferStartedAt" TIMESTAMP(3);
