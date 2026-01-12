import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DivisionMethod, Invoice, InvoiceItem } from '../../domain/invoice/invoice';
import { Participation } from '../../domain/invoice/participation';
import { EventRepository } from '../ports/event-repository';
import { InvoiceRepository } from '../ports/invoice-repository';
import { ParticipantRepository } from '../ports/participant-repository';

type CreateInvoiceInput = {
  eventId: string;
  description: string;
  totalAmount: number;
  payerId: string;
  participantIds: string[];
  divisionMethod: DivisionMethod;
  consumptions?: Record<string, number>;
  items?: Array<{
    name: string;
    unitPrice: number;
    quantity: number;
    participantIds: string[];
  }>;
  tipAmount?: number;
  birthdayPersonId?: string;
  userId: string;
};

const TOLERANCE = 0.01;

@Injectable()
export class CreateInvoiceUseCase {
  constructor(
    @Inject('InvoiceRepository') private readonly _invoiceRepository: InvoiceRepository,
    @Inject('EventRepository') private readonly _eventRepository: EventRepository,
    @Inject('ParticipantRepository') private readonly _participantRepository: ParticipantRepository,
  ) {}

  async execute(input: CreateInvoiceInput): Promise<Invoice> {
    const description = input.description?.trim();
    const totalAmount = Number(input.totalAmount);
    const tipAmount = Number(input.tipAmount ?? 0);
    if (!description) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid invoice data',
        fieldErrors: { description: 'Description is required' },
      });
    }
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid invoice data',
        fieldErrors: { totalAmount: 'Total amount must be greater than 0' },
      });
    }
    if (!Number.isFinite(tipAmount) || tipAmount < 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid invoice data',
        fieldErrors: { tipAmount: 'Tip amount must be >= 0' },
      });
    }
    const divisionMethod = input.divisionMethod;
    if (!['equal', 'consumption'].includes(divisionMethod)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid invoice data',
        fieldErrors: { divisionMethod: 'Division method must be equal or consumption' },
      });
    }

    const event = await this._eventRepository.findByIdForUser(input.eventId, input.userId);
    if (!event) {
      throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
    }

    // Participants validation
    const participantSet = new Set(input.participantIds);
    if (!participantSet.size) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid invoice data',
        fieldErrors: { participantIds: 'At least one participant is required' },
      });
    }
    participantSet.add(input.payerId); // ensure payer is a participant
    const participantIds = Array.from(participantSet);

    const participants = await Promise.all(
      participantIds.map((id) => this._participantRepository.findById(event.id, id)),
    );
    const missing = participants
      .map((p, idx): string | null => (p ? null : participantIds[idx]))
      .filter((value): value is string => Boolean(value));
    if (missing.length > 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid participants',
        fieldErrors: { participantIds: `Missing participants: ${missing.join(', ')}` },
      });
    }

    if (input.birthdayPersonId && !participantSet.has(input.birthdayPersonId)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Birthday person must be among participants',
        fieldErrors: { birthdayPersonId: 'Birthday person must be a participant' },
      });
    }

    const itemResult = this.normalizeItems({
      divisionMethod,
      items: input.items,
      participantIds,
      totalAmount,
    });

    const baseShares = this.calculateBaseShares({
      divisionMethod,
      participantIds,
      totalAmount,
      consumptions: itemResult.consumptions ?? input.consumptions,
      birthdayPersonId: input.birthdayPersonId,
    });

    const tipShares = this.calculateTipShares(tipAmount, participantIds);
    const participations = this.mergeShares(
      participantIds,
      baseShares,
      tipShares,
      totalAmount,
      tipAmount,
    );

    const invoice = new Invoice(
      randomUUID(),
      event.id,
      input.payerId,
      description,
      totalAmount,
      divisionMethod,
      participations,
      tipAmount,
      input.birthdayPersonId,
      divisionMethod === 'consumption'
        ? itemResult.consumptions ?? input.consumptions
        : undefined,
      itemResult.items,
    );

    return this._invoiceRepository.create(invoice);
  }

  private calculateBaseShares(params: {
    divisionMethod: DivisionMethod;
    participantIds: string[];
    totalAmount: number;
    consumptions?: Record<string, number>;
    birthdayPersonId?: string;
  }): Record<string, number> {
    const { divisionMethod, participantIds, totalAmount, consumptions, birthdayPersonId } = params;
    const shares: Record<string, number> = {};

    if (divisionMethod === 'equal') {
      const n = participantIds.length;
      const base = this.round2(totalAmount / n);
      let allocated = 0;
      for (let i = 0; i < n; i++) {
        if (i === n - 1) {
          shares[participantIds[i]] = this.round2(totalAmount - allocated);
        } else {
          shares[participantIds[i]] = base;
          allocated += base;
        }
      }
    } else {
      const consumptionsMap: Record<string, number> = {};
      if (!consumptions) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Invalid invoice data',
          fieldErrors: { consumptions: 'Consumptions are required for consumption method' },
        });
      }
      let totalConsumption = 0;
      participantIds.forEach((id) => {
        const value = this.round2(Number(consumptions[id] ?? 0));
        consumptionsMap[id] = value;
        totalConsumption += value;
      });
      const hasPositive = Object.values(consumptionsMap).some((v) => v > 0);
      if (!hasPositive || totalConsumption <= 0) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Invalid invoice data',
          fieldErrors: { consumptions: 'At least one consumption > 0 is required' },
        });
      }
      const diff = totalAmount - totalConsumption;
      if (Math.abs(diff) > TOLERANCE) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `Sum of consumptions (${totalConsumption.toFixed(
            2,
          )}) does not match total (${totalAmount.toFixed(2)})`,
          fieldErrors: { consumptions: 'Consumptions must match total within +/-0.01' },
        });
      }
      // Adjust last participant to match total exactly
      let allocated = 0;
      for (let i = 0; i < participantIds.length; i++) {
        const id = participantIds[i];
        if (i === participantIds.length - 1) {
          shares[id] = this.round2(totalAmount - allocated);
        } else {
          shares[id] = consumptionsMap[id];
          allocated += consumptionsMap[id];
        }
      }
    }

    if (birthdayPersonId) {
      if (!participantIds.includes(birthdayPersonId)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Birthday person must be among participants',
          fieldErrors: { birthdayPersonId: 'Birthday person must be a participant' },
        });
      }
      const others = participantIds.filter((id) => id !== birthdayPersonId);
      const giftAmount = shares[birthdayPersonId] ?? 0;
      shares[birthdayPersonId] = 0;
      if (others.length > 0 && giftAmount !== 0) {
        const base = this.round2(giftAmount / others.length);
        let allocated = 0;
        for (let i = 0; i < others.length; i++) {
          const id = others[i];
          if (i === others.length - 1) {
            shares[id] = this.round2((shares[id] ?? 0) + (giftAmount - allocated));
          } else {
            shares[id] = this.round2((shares[id] ?? 0) + base);
            allocated += base;
          }
        }
      }
    }

    return shares;
  }

  private normalizeItems(params: {
    divisionMethod: DivisionMethod;
    items?: Array<{
      name: string;
      unitPrice: number;
      quantity: number;
      participantIds: string[];
    }>;
    participantIds: string[];
    totalAmount: number;
  }): { items?: InvoiceItem[]; consumptions?: Record<string, number> } {
    const { divisionMethod, items, participantIds, totalAmount } = params;
    if (!items || items.length === 0) {
      return {};
    }

    if (divisionMethod !== 'consumption') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid invoice data',
        fieldErrors: { items: 'Items are only supported for consumption method' },
      });
    }

    const participantSet = new Set(participantIds);
    const normalizedItems: InvoiceItem[] = items.map((item) => {
      const name = item.name?.trim();
      const unitPrice = this.round2(Number(item.unitPrice));
      const quantity = Math.floor(Number(item.quantity));
      if (!name) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Invalid invoice data',
          fieldErrors: { items: 'Each item must have a name' },
        });
      }
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Invalid invoice data',
          fieldErrors: { items: 'Each item must have unitPrice > 0' },
        });
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Invalid invoice data',
          fieldErrors: { items: 'Each item must have quantity >= 1' },
        });
      }
      const uniqueParticipants = Array.from(new Set(item.participantIds ?? []));
      if (uniqueParticipants.length === 0) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Invalid invoice data',
          fieldErrors: { items: 'Each item must have at least one participant' },
        });
      }
      const invalid = uniqueParticipants.filter((id) => !participantSet.has(id));
      if (invalid.length > 0) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Invalid invoice data',
          fieldErrors: { items: `Invalid participants in items: ${invalid.join(', ')}` },
        });
      }

      const total = this.round2(unitPrice * quantity);
      const assignments = this.splitItem(total, uniqueParticipants);
      return {
        id: randomUUID(),
        name,
        unitPrice,
        quantity,
        total,
        assignments,
      };
    });

    const totalItems = normalizedItems.reduce((acc, item) => acc + item.total, 0);
    if (!Number.isFinite(totalItems) || totalItems <= 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid invoice data',
        fieldErrors: { items: 'Items total must be greater than 0' },
      });
    }
    const diff = Math.abs(this.round2(totalAmount - totalItems));
    if (diff > TOLERANCE) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Items total (${totalItems.toFixed(2)}) does not match total (${totalAmount.toFixed(2)})`,
        fieldErrors: { items: 'Items total must match total within +/-0.01' },
      });
    }

    const consumptions = participantIds.reduce<Record<string, number>>((acc, id) => {
      acc[id] = 0;
      return acc;
    }, {});
    normalizedItems.forEach((item) => {
      item.assignments.forEach((assignment) => {
        consumptions[assignment.personId] = this.round2(
          (consumptions[assignment.personId] ?? 0) + assignment.amount,
        );
      });
    });

    return { items: normalizedItems, consumptions };
  }

  private splitItem(total: number, participants: string[]) {
    const n = participants.length;
    if (n === 0) return [];
    const per = this.round2(total / n);
    let allocated = 0;
    return participants.map((personId, index) => {
      if (index === n - 1) {
        return {
          personId,
          amount: this.round2(total - allocated),
        };
      }
      allocated = this.round2(allocated + per);
      return { personId, amount: per };
    });
  }

  private calculateTipShares(tipAmount: number, participantIds: string[]): Record<string, number> {
    const n = participantIds.length;
    if (tipAmount <= 0 || n === 0)
      return participantIds.reduce((acc, id) => ({ ...acc, [id]: 0 }), {});

    const tipPer = this.round2(tipAmount / n);
    const shares: Record<string, number> = {};
    let allocated = 0;
    for (let i = 0; i < n; i++) {
      if (i === n - 1) {
        shares[participantIds[i]] = this.round2(tipAmount - allocated);
      } else {
        shares[participantIds[i]] = tipPer;
        allocated += tipPer;
      }
    }
    return shares;
  }

  private mergeShares(
    participantIds: string[],
    baseShares: Record<string, number>,
    tipShares: Record<string, number>,
    totalAmount: number,
    tipAmount: number,
  ): Participation[] {
    const participations: Participation[] = [];
    let allocated = 0;
    participantIds.forEach((id, index) => {
      const base = this.round2(baseShares[id] ?? 0);
      let tip = this.round2(tipShares[id] ?? 0);
      let finalAmount = this.round2(base + tip);

      if (index === participantIds.length - 1) {
        const expectedTotal = this.round2(totalAmount + tipAmount);
        const diff = this.round2(expectedTotal - (allocated + finalAmount));
        tip = this.round2(tip + diff);
        finalAmount = this.round2(base + tip);
      }

      allocated = this.round2(allocated + finalAmount);
      participations.push(new Participation(id, base, tip, finalAmount));
    });
    return participations;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
