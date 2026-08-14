import { ConfigService } from '@nestjs/config';
import { hmacSha256Hex } from '../src/common/crypto/signature';
import { GitHubAdapter } from '../src/adapters/github.adapter';

describe('GitHubAdapter', () => {
  it('validates GitHub signature and maps pull request opened events', async () => {
    const secret = 'github-secret';
    const adapter = new GitHubAdapter({
      get: jest.fn((key: string) => (key === 'GITHUB_WEBHOOK_SECRET' ? secret : undefined)),
    } as unknown as ConfigService);
    const payload = {
      action: 'opened',
      organization: { id: 123 },
      sender: { id: 456, login: 'octocat' },
      repository: { id: 789, full_name: 'acme/api', private: true },
      pull_request: {
        id: 10,
        number: 7,
        title: 'Add ingestion',
        body: 'Webhook path',
        html_url: 'https://github.com/acme/api/pull/7',
        merged: false,
      },
    };
    const raw = JSON.stringify(payload);
    const validated = await adapter.validateRequest({
      headers: {
        'x-hub-signature-256': `sha256=${hmacSha256Hex(secret, raw)}`,
        'x-github-delivery': 'delivery_123',
        'x-github-event': 'pull_request',
      },
      body: payload,
      rawBody: Buffer.from(raw),
      query: {},
    });

    const events = await adapter.toIntermediateEvents(validated);

    expect(validated.organizationId).toBe('123');
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('pull_request.opened');
    expect(events[0].context.repositoryName).toBe('acme/api');
  });
});
