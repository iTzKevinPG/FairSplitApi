export class Participation {
  constructor(
    public readonly personId: string,
    public readonly baseAmount: number,
    public readonly tipShare: number,
    public readonly finalAmount: number,
  ) {}

  get amount(): number {
    return this.finalAmount;
  }
}
