import { Participation } from './participation';

export type DivisionMethod = 'equal' | 'consumption';

export type InvoiceItemAssignment = {
  personId: string;
  amount: number;
};

export type InvoiceItem = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  total: number;
  assignments: InvoiceItemAssignment[];
};

export class Invoice {
  constructor(
    public readonly id: string,
    public readonly eventId: string,
    public readonly payerId: string,
    public readonly description: string,
    public readonly amount: number,
    public readonly divisionMethod: DivisionMethod,
    public readonly participations: Participation[],
    public readonly tipAmount: number,
    public readonly birthdayPersonId?: string,
    public readonly consumptions?: Record<string, number>,
    public readonly items?: InvoiceItem[],
  ) {}
}
