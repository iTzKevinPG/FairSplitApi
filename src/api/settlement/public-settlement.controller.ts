import { Controller, Get, Param } from '@nestjs/common';
import { GetPublicEventOverviewUseCase } from '../../application/use-cases/get-public-event-overview.use-case';

@Controller('public/events/:eventId')
export class PublicSettlementController {
  constructor(private readonly _getPublicOverview: GetPublicEventOverviewUseCase) {}

  @Get('overview')
  async getOverview(@Param('eventId') eventId: string) {
    return this._getPublicOverview.execute(eventId);
  }
}
