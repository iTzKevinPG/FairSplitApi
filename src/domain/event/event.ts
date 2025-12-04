export class Event {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly currency: string,
    public readonly createdAt: Date,
  ) {}
}
