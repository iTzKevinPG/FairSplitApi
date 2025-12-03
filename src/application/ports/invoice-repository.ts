import { Invoice } from '../../domain/invoice/invoice';

export interface InvoiceRepository {
  create(invoice: Invoice): Promise<Invoice>;
  findByEvent(eventId: string): Promise<Invoice[]>;
  findById(id: string): Promise<Invoice | null>;
}
