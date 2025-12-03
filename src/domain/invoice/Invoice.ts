import { Participation } from './Participation';

export type DivisionMethod = 'equal' | 'consumption';

export class Invoice {
  constructor(
    public readonly id: string,
    public readonly eventId: string,
    public readonly payerId: string,
    public readonly amount: number,
    public readonly divisionMethod: DivisionMethod,
    public readonly participations: Participation[],
    public readonly tipAmount: number = 0,
    public readonly birthdayPersonId?: string,
  ) {}
}
