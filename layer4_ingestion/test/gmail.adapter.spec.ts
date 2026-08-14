import { ConfigService } from '@nestjs/config';
import { GmailAdapter } from '../src/adapters/gmail.adapter';

describe('GmailAdapter', () => {
  it('validates Pub/Sub push data and maps fetched Gmail messages', async () => {
    const gmail = {
      listNewInboundMessages: jest.fn().mockResolvedValue([
        {
          id: 'gmail_123',
          threadId: 'thread_123',
          historyId: 'history_123',
          from: 'Ada Lovelace <ada@example.com>',
          to: 'team@example.com',
          subject: 'Architecture update',
          messageId: '<msg_123@example.com>',
          date: new Date('2026-08-14T10:00:00.000Z'),
          snippet: 'We approved the ingestion boundary.',
        },
      ]),
    };
    const adapter = new GmailAdapter(
      { get: jest.fn((key: string) => (key === 'GOOGLE_PUBSUB_VERIFICATION_SECRET' ? 'token' : undefined)) } as unknown as ConfigService,
      gmail as never,
    );
    const body = {
      message: {
        data: Buffer.from(JSON.stringify({ emailAddress: 'team@example.com', historyId: 'history_123' })).toString('base64'),
      },
    };

    const validated = await adapter.validateRequest({
      headers: {},
      body,
      query: { organizationId: 'org_123', token: 'token' },
    });
    const events = await adapter.toIntermediateEvents(validated);

    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('email.received');
    expect(events[0].actor.email).toBe('ada@example.com');
    expect(gmail.listNewInboundMessages).toHaveBeenCalledWith({
      organizationId: 'org_123',
      emailAddress: 'team@example.com',
      historyId: 'history_123',
    });
  });
});
