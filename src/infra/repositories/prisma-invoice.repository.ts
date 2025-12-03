import { Injectable } from '@nestjs/common';
import { InvoiceRepository } from '../../application/ports/invoice-repository';
import { Invoice } from '../../domain/invoice/invoice';
import { Participation } from '../../domain/invoice/participation';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(private readonly _prisma: PrismaService) {}

  async create(invoice: Invoice): Promise<Invoice> {
    const created = await this._prisma.invoice.create({
      data: {
        id: invoice.id,
        description: invoice.description,
        amount: invoice.amount,
        divisionMethod: invoice.divisionMethod,
        tipAmount: invoice.tipAmount,
        birthdayPersonId: invoice.birthdayPersonId,
        consumptions: invoice.consumptions ?? undefined,
        eventId: invoice.eventId,
        payerId: invoice.payerId,
        participations: {
          createMany: {
            data: invoice.participations.map((p) => ({
              personId: p.personId,
              amount: p.amount,
            })),
          },
        },
      },
    });

    const participations = await this._prisma.participation.findMany({
      where: { invoiceId: created.id },
    });

    return new Invoice(
      created.id,
      created.eventId,
      created.payerId,
      created.description,
      Number(created.amount),
      created.divisionMethod as 'equal' | 'consumption',
      participations.map((p) => new Participation(p.personId, Number(p.amount))),
      created.tipAmount ? Number(created.tipAmount) : 0,
      created.birthdayPersonId ?? undefined,
      (created as { consumptions?: Record<string, number> }).consumptions,
    );
  }

  async findByEvent(_eventId: string): Promise<Invoice[]> {
    throw new Error('Method not implemented.');
  }

  async findById(_id: string): Promise<Invoice | null> {
    throw new Error('Method not implemented.');
  }
}
