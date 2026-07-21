ALTER TABLE "Banner" ADD COLUMN "collectionId" TEXT;

CREATE INDEX "Banner_collectionId_idx" ON "Banner"("collectionId");

ALTER TABLE "Banner" ADD CONSTRAINT "Banner_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
