import { Injectable } from '@nestjs/common';
import { InvoiceRepository } from '../ports/InvoiceRepository';

@Injectable()
export class CreateInvoiceUseCase {
  constructor(private readonly _invoiceRepository: InvoiceRepository) {}

  // TODO: implement use case
  async execute(): Promise<void> {
    throw new Error('Not implemented');
  }
}
