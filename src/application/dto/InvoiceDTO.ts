export interface InvoiceParticipationDTO {
  personId: string;
  amount: number;
}

export type DivisionMethodDTO = 'equal' | 'consumption';

export interface InvoiceDTO {
  id: string;
  eventId: string;
  payerId: string;
  description: string;
  total: number;
  divisionMethod: DivisionMethodDTO;
  participations: InvoiceParticipationDTO[];
  tipAmount?: number;
  birthdayPersonId?: string;
}
