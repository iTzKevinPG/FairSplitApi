-- Add detailed amounts for participations
ALTER TABLE "Participation"
ADD COLUMN "baseAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "tipShare" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "finalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Backfill new columns from existing amount before dropping it
UPDATE "Participation"
SET "baseAmount" = "amount",
    "finalAmount" = "amount";

-- Drop old generic amount column
ALTER TABLE "Participation" DROP COLUMN "amount";

-- Recreate foreign key to participants with RESTRICT delete behavior
ALTER TABLE "Participation" DROP CONSTRAINT "Participation_personId_fkey";
ALTER TABLE "Participation"
ADD CONSTRAINT "Participation_personId_fkey"
FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add helpful indexes for lookups
CREATE INDEX "Participation_invoiceId_idx" ON "Participation"("invoiceId");
CREATE INDEX "Participation_personId_idx" ON "Participation"("personId");
