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
              baseAmount: p.baseAmount,
              tipShare: p.tipShare,
              finalAmount: p.finalAmount,
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
      participations.map(
        (p) =>
          new Participation(
            p.personId,
            Number(p.baseAmount),
            Number(p.tipShare),
            Number(p.finalAmount),
          ),
      ),
      created.tipAmount ? Number(created.tipAmount) : 0,
      created.birthdayPersonId ?? undefined,
      (created as { consumptions?: Record<string, number> }).consumptions,
    );
  }

  async update(invoice: Invoice): Promise<Invoice> {
    const updated = await this._prisma.$transaction(async (tx) => {
      await tx.participation.deleteMany({ where: { invoiceId: invoice.id } });
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
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
                baseAmount: p.baseAmount,
                tipShare: p.tipShare,
                finalAmount: p.finalAmount,
              })),
            },
          },
        },
      });

      const participations = await tx.participation.findMany({
        where: { invoiceId: updatedInvoice.id },
      });

      return { updatedInvoice, participations };
    });

    return new Invoice(
      updated.updatedInvoice.id,
      updated.updatedInvoice.eventId,
      updated.updatedInvoice.payerId,
      updated.updatedInvoice.description,
      Number(updated.updatedInvoice.amount),
      updated.updatedInvoice.divisionMethod as 'equal' | 'consumption',
      updated.participations.map(
        (p) =>
          new Participation(
            p.personId,
            Number(p.baseAmount),
            Number(p.tipShare),
            Number(p.finalAmount),
          ),
      ),
      updated.updatedInvoice.tipAmount ? Number(updated.updatedInvoice.tipAmount) : 0,
      updated.updatedInvoice.birthdayPersonId ?? undefined,
      (updated.updatedInvoice as { consumptions?: Record<string, number> }).consumptions,
    );
  }

  async findByEvent(eventId: string): Promise<Invoice[]> {
    const invoices = await this._prisma.invoice.findMany({
      where: { eventId },
      include: {
        participations: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return invoices.map(
      (inv) =>
        new Invoice(
          inv.id,
          inv.eventId,
          inv.payerId,
          inv.description,
          Number(inv.amount),
          inv.divisionMethod as 'equal' | 'consumption',
          inv.participations.map(
            (p) =>
              new Participation(
                p.personId,
                Number(p.baseAmount),
                Number(p.tipShare),
                Number(p.finalAmount),
              ),
          ),
          inv.tipAmount ? Number(inv.tipAmount) : 0,
          inv.birthdayPersonId ?? undefined,
          (inv as { consumptions?: Record<string, number> }).consumptions,
        ),
    );
  }

  async findById(id: string): Promise<Invoice | null> {
    const inv = await this._prisma.invoice.findUnique({
      where: { id },
      include: {
        participations: true,
      },
    });
    if (!inv) return null;

    return new Invoice(
      inv.id,
      inv.eventId,
      inv.payerId,
      inv.description,
      Number(inv.amount),
      inv.divisionMethod as 'equal' | 'consumption',
      inv.participations.map(
        (p) =>
          new Participation(
            p.personId,
            Number(p.baseAmount),
            Number(p.tipShare),
            Number(p.finalAmount),
          ),
      ),
      inv.tipAmount ? Number(inv.tipAmount) : 0,
      inv.birthdayPersonId ?? undefined,
      (inv as { consumptions?: Record<string, number> }).consumptions,
    );
  }
}
