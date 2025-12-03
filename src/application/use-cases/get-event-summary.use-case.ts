import { Injectable } from '@nestjs/common';
import { InvoiceRepository } from '../ports/invoice-repository';

@Injectable()
export class GetEventSummaryUseCase {
  constructor(private readonly _invoiceRepository: InvoiceRepository) {}

  // TODO: implement use case
  async execute(): Promise<void> {
    throw new Error('Not implemented');
  }
}
