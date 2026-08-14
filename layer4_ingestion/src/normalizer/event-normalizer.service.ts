import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { companyEventSchema, CompanyEvent } from './company-event.schema';
import { IntermediateEvent } from './intermediate-event';

@Injectable()
export class EventNormalizerService {
  normalize(event: IntermediateEvent): CompanyEvent {
    const normalized: CompanyEvent = {
      eventId: randomUUID(),
      organizationId: event.organizationId,
      source: event.source,
      sourceEventId: event.sourceEventId,
      eventType: event.eventType,
      actor: event.actor,
      occurredAt: event.occurredAt.toISOString(),
      receivedAt: event.receivedAt.toISOString(),
      content: event.content,
      context: event.context,
      sourceUrl: event.sourceUrl,
      visibility: event.visibility,
      metadata: event.metadata,
      correlationId: event.correlationId,
    };

    return companyEventSchema.parse(normalized);
  }
}
