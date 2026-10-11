-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "masterKey" TEXT;

-- CreateTable
CREATE TABLE "AlbumZip" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "bytes" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlbumZip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlbumZip_albumId_format_key" ON "AlbumZip"("albumId", "format");

-- AddForeignKey
ALTER TABLE "AlbumZip" ADD CONSTRAINT "AlbumZip_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
