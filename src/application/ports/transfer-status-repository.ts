import { TransferStatus } from '../../domain/settlement/transfer-status';

export interface TransferStatusRepository {
  findByEvent(eventId: string): Promise<TransferStatus[]>;
  upsertStatus(input: {
    eventId: string;
    fromParticipantId: string;
    toParticipantId: string;
    isSettled: boolean;
  }): Promise<TransferStatus>;
}
