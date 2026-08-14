import { EventNormalizerService } from '../src/normalizer/event-normalizer.service';
import { IntermediateEvent } from '../src/normalizer/intermediate-event';

describe('EventNormalizerService', () => {
  it('creates a schema-valid CompanyEvent from an intermediate event', () => {
    const normalizer = new EventNormalizerService();
    const input: IntermediateEvent = {
      organizationId: 'org_123',
      source: 'slack',
      sourceEventId: 'evt_123',
      eventType: 'message.created',
      actor: { id: 'U123', displayName: 'Ada' },
      occurredAt: new Date('2026-08-14T10:00:00.000Z'),
      receivedAt: new Date('2026-08-14T10:00:01.000Z'),
      content: { text: 'Real workspace message' },
      context: { workspaceId: 'T123', channelId: 'C123', messageId: 'm1' },
      visibility: { type: 'restricted' },
      metadata: {},
      correlationId: 'corr_123',
    };

    const result = normalizer.normalize(input);

    expect(result.eventId).toEqual(expect.any(String));
    expect(result.source).toBe('slack');
    expect(result.eventType).toBe('message.created');
    expect(result.occurredAt).toBe('2026-08-14T10:00:00.000Z');
  });
});
