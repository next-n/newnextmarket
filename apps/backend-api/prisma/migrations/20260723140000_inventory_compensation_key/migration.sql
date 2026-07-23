ALTER TABLE "InventoryLog"
ADD COLUMN "eventKey" TEXT;

CREATE UNIQUE INDEX "InventoryLog_eventKey_key"
ON "InventoryLog"("eventKey");
