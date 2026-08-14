import { IdempotencyService } from '../src/ingestion/idempotency.service';

describe('IdempotencyService', () => {
  it('builds stable keys from organization, source, source event, and type', () => {
    const service = new IdempotencyService({} as never);

    expect(
      service.buildKey({
        organizationId: 'org_123',
        source: 'github',
        sourceEventId: 'delivery_123',
        eventType: 'pull_request.opened',
      }),
    ).toBe('org_123:github:delivery_123:pull_request.opened');
  });

  it('returns false when a duplicate reservation hits the unique constraint', async () => {
    const prisma = {
      idempotencyKey: {
        create: jest.fn().mockRejectedValue(new Error('Unique constraint failed')),
      },
    };
    const service = new IdempotencyService(prisma as never);

    await expect(service.reserve('duplicate-key', 'corr_123')).resolves.toBe(false);
  });
});
