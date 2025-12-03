export class Balance {
  constructor(
    public readonly personId: string,
    public totalPaid: number,
    public totalOwed: number,
    public netBalance: number,
  ) {}
}
