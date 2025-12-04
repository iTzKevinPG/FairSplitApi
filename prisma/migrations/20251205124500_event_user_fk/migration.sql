-- Add userId to Event for ownership
ALTER TABLE "Event" ADD COLUMN "userId" TEXT;
ALTER TABLE "Event"
ADD CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Event_userId_idx" ON "Event"("userId");
