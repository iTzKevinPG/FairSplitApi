CREATE TABLE "TransferStatus" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "fromParticipantId" TEXT NOT NULL,
    "toParticipantId" TEXT NOT NULL,
    "isSettled" BOOLEAN NOT NULL DEFAULT false,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferStatus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransferStatus_eventId_fromParticipantId_toParticipantId_key" ON "TransferStatus"("eventId", "fromParticipantId", "toParticipantId");
CREATE INDEX "TransferStatus_eventId_idx" ON "TransferStatus"("eventId");

ALTER TABLE "TransferStatus" ADD CONSTRAINT "TransferStatus_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransferStatus" ADD CONSTRAINT "TransferStatus_fromParticipantId_fkey" FOREIGN KEY ("fromParticipantId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransferStatus" ADD CONSTRAINT "TransferStatus_toParticipantId_fkey" FOREIGN KEY ("toParticipantId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
