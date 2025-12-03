import { Invoice } from '../../domain/invoice/Invoice';

export interface InvoiceRepository {
  create(invoice: Invoice): Promise<Invoice>;
  findByEvent(eventId: string): Promise<Invoice[]>;
  findById(id: string): Promise<Invoice | null>;
}
