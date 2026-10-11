-- AlterTable
ALTER TABLE "Album" ADD COLUMN     "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "previewFingerprint" TEXT,
ADD COLUMN     "previewKey" TEXT,
ADD COLUMN     "previewStartSec" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "previewTrackId" TEXT;

-- CreateIndex
CREATE INDEX "Album_genres_idx" ON "Album" USING GIN ("genres");
