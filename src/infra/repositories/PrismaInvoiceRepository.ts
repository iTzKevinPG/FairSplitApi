import { Injectable } from '@nestjs/common';
import { InvoiceRepository } from '../../application/ports/InvoiceRepository';
import { Invoice } from '../../domain/invoice/Invoice';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(private readonly _prisma: PrismaService) {}

  async create(_invoice: Invoice): Promise<Invoice> {
    throw new Error('Method not implemented.');
  }

  async findByEvent(_eventId: string): Promise<Invoice[]> {
    throw new Error('Method not implemented.');
  }

  async findById(_id: string): Promise<Invoice | null> {
    throw new Error('Method not implemented.');
  }
}
