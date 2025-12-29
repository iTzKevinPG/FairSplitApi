import { Injectable } from '@nestjs/common';
import { TransferStatusRepository } from '../../application/ports/transfer-status-repository';
import { TransferStatus } from '../../domain/settlement/transfer-status';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaTransferStatusRepository implements TransferStatusRepository {
  constructor(private readonly _prisma: PrismaService) {}

  async findByEvent(eventId: string): Promise<TransferStatus[]> {
    const rows = await this._prisma.transferStatus.findMany({
      where: { eventId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(
      (row) =>
        new TransferStatus(
          row.eventId,
          row.fromParticipantId,
          row.toParticipantId,
          row.isSettled,
          row.settledAt,
        ),
    );
  }

  async upsertStatus(input: {
    eventId: string;
    fromParticipantId: string;
    toParticipantId: string;
    isSettled: boolean;
  }): Promise<TransferStatus> {
    const settledAt = input.isSettled ? new Date() : null;
    const row = await this._prisma.transferStatus.upsert({
      where: {
        eventId_fromParticipantId_toParticipantId: {
          eventId: input.eventId,
          fromParticipantId: input.fromParticipantId,
          toParticipantId: input.toParticipantId,
        },
      },
      update: {
        isSettled: input.isSettled,
        settledAt,
      },
      create: {
        eventId: input.eventId,
        fromParticipantId: input.fromParticipantId,
        toParticipantId: input.toParticipantId,
        isSettled: input.isSettled,
        settledAt,
      },
    });
    return new TransferStatus(
      row.eventId,
      row.fromParticipantId,
      row.toParticipantId,
      row.isSettled,
      row.settledAt,
    );
  }
}
