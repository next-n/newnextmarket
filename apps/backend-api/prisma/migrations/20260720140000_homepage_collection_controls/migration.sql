ALTER TABLE "Collection"
ADD COLUMN "showOnHomepage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "homepagePriority" INTEGER NOT NULL DEFAULT 0;

UPDATE "Collection"
SET "showOnHomepage" = true
WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL;
