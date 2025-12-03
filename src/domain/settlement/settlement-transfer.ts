export class SettlementTransfer {
  constructor(
    public readonly fromPersonId: string,
    public readonly toPersonId: string,
    public readonly amount: number,
  ) {}
}
