export class TransferStatus {
  constructor(
    public readonly eventId: string,
    public readonly fromParticipantId: string,
    public readonly toParticipantId: string,
    public readonly isSettled: boolean,
    public readonly settledAt?: Date | null,
  ) {}
}
