import { Injectable } from '@nestjs/common';
import { InvoiceRepository } from '../../application/ports/invoice-repository';
import { Invoice, InvoiceItem } from '../../domain/invoice/invoice';
import { Participation } from '../../domain/invoice/participation';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(private readonly _prisma: PrismaService) {}

  async create(invoice: Invoice): Promise<Invoice> {
    const created = await this._prisma.$transaction(async (tx) => {
      const createdInvoice = await tx.invoice.create({
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

      if (invoice.items?.length) {
        for (const item of invoice.items) {
          await tx.invoiceItem.create({
            data: {
              id: item.id,
              name: item.name,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              total: item.total,
              invoiceId: createdInvoice.id,
              assignments: {
                createMany: {
                  data: item.assignments.map((assignment) => ({
                    personId: assignment.personId,
                    amount: assignment.amount,
                  })),
                },
              },
            },
          });
        }
      }

      const participations = await tx.participation.findMany({
        where: { invoiceId: createdInvoice.id },
      });
      const items = await tx.invoiceItem.findMany({
        where: { invoiceId: createdInvoice.id },
        include: { assignments: true },
      });
      return { createdInvoice, participations, items };
    });

    return this.mapInvoice(created.createdInvoice, created.participations, created.items);
  }

  async update(invoice: Invoice): Promise<Invoice> {
    const updated = await this._prisma.$transaction(async (tx) => {
      await tx.participation.deleteMany({ where: { invoiceId: invoice.id } });
      await tx.invoiceItemAssignment.deleteMany({
        where: { item: { invoiceId: invoice.id } },
      });
      await tx.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
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

      if (invoice.items?.length) {
        for (const item of invoice.items) {
          await tx.invoiceItem.create({
            data: {
              id: item.id,
              name: item.name,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              total: item.total,
              invoiceId: updatedInvoice.id,
              assignments: {
                createMany: {
                  data: item.assignments.map((assignment) => ({
                    personId: assignment.personId,
                    amount: assignment.amount,
                  })),
                },
              },
            },
          });
        }
      }

      const participations = await tx.participation.findMany({
        where: { invoiceId: updatedInvoice.id },
      });
      const items = await tx.invoiceItem.findMany({
        where: { invoiceId: updatedInvoice.id },
        include: { assignments: true },
      });

      return { updatedInvoice, participations, items };
    });

    return this.mapInvoice(updated.updatedInvoice, updated.participations, updated.items);
  }

  async findByEvent(eventId: string): Promise<Invoice[]> {
    const invoices = await this._prisma.invoice.findMany({
      where: { eventId },
      include: {
        participations: true,
        items: { include: { assignments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return invoices.map(
      (inv) => this.mapInvoice(inv, inv.participations, inv.items),
    );
  }

  async findById(id: string): Promise<Invoice | null> {
    const inv = await this._prisma.invoice.findUnique({
      where: { id },
      include: {
        participations: true,
        items: { include: { assignments: true } },
      },
    });
    if (!inv) return null;

    return this.mapInvoice(inv, inv.participations, inv.items);
  }

  async remove(id: string): Promise<void> {
    await this._prisma.invoice.delete({ where: { id } });
  }

  private mapInvoice(
    inv: {
      id: string;
      eventId: string;
      payerId: string;
      description: string;
      amount: unknown;
      divisionMethod: string;
      tipAmount: unknown | null;
      birthdayPersonId: string | null;
      consumptions?: Prisma.JsonValue | null;
    },
    participations: Array<{
      personId: string;
      baseAmount: unknown;
      tipShare: unknown;
      finalAmount: unknown;
    }>,
    items: Array<{
      id: string;
      name: string;
      unitPrice: unknown;
      quantity: number;
      total: unknown;
      assignments: Array<{ personId: string; amount: unknown }>;
    }>,
  ): Invoice {
    const consumptions =
      inv.consumptions && typeof inv.consumptions === 'object'
        ? (inv.consumptions as Record<string, number>)
        : undefined;
    const mappedItems: InvoiceItem[] | undefined =
      items && items.length > 0
        ? items.map((item) => ({
            id: item.id,
            name: item.name,
            unitPrice: Number(item.unitPrice),
            quantity: item.quantity,
            total: Number(item.total),
            assignments: item.assignments.map((assignment) => ({
              personId: assignment.personId,
              amount: Number(assignment.amount),
            })),
          }))
        : undefined;

    return new Invoice(
      inv.id,
      inv.eventId,
      inv.payerId,
      inv.description,
      Number(inv.amount),
      inv.divisionMethod as 'equal' | 'consumption',
      participations.map(
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
      consumptions,
      mappedItems,
    );
  }
}
