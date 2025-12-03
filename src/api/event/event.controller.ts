import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CreateEventUseCase } from '../../application/use-cases/create-event.use-case';
import { GetEventUseCase } from '../../application/use-cases/get-event.use-case';
import { ListEventsUseCase } from '../../application/use-cases/list-events.use-case';
import { Event } from '../../domain/event/event';
import { CreateEventDto } from './dto/create-event.dto';

@Controller('events')
export class EventController {
  constructor(
    private readonly _createEvent: CreateEventUseCase,
    private readonly _listEvents: ListEventsUseCase,
    private readonly _getEvent: GetEventUseCase,
  ) {}

  @Get()
  async list(): Promise<Event[]> {
    return this._listEvents.execute();
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<Event> {
    return this._getEvent.execute(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: CreateEventDto): Promise<Event> {
    return this._createEvent.execute({
      name: body.name.trim(),
      currency: body.currency.trim().toUpperCase(),
    });
  }
}
