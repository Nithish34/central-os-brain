import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hmacSha256Hex, timingSafeStringEqual } from '../common/crypto/signature';
import { firstHeader } from '../common/http/header';
import { IntermediateEvent } from '../normalizer/intermediate-event';
import { organizationIdFromRequest, newCorrelationId, requestBodyString, unixSecondsToDate } from './adapter-utils';
import { SourceAdapter, SourceHttpRequest, ValidatedSourceRequest } from './source-adapter.interface';

@Injectable()
export class SlackAdapter implements SourceAdapter {
  readonly source = 'slack' as const;

  constructor(private readonly config: ConfigService) {}

  async validateRequest(request: SourceHttpRequest): Promise<ValidatedSourceRequest> {
    const signingSecret = this.config.get<string>('SLACK_SIGNING_SECRET');
    if (!signingSecret) {
      throw new UnauthorizedException('Slack signing secret is not configured');
    }

    const timestamp = firstHeader(request.headers['x-slack-request-timestamp']);
    const signature = firstHeader(request.headers['x-slack-signature']);
    if (!timestamp || !signature) {
      throw new UnauthorizedException('Missing Slack signature headers');
    }

    const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(ageSeconds) || ageSeconds > 300) {
      throw new UnauthorizedException('Slack request timestamp is outside the allowed window');
    }

    const base = `v0:${timestamp}:${requestBodyString(request)}`;
    const expected = `v0=${hmacSha256Hex(signingSecret, base)}`;
    if (!timingSafeStringEqual(expected, signature)) {
      throw new UnauthorizedException('Invalid Slack signature');
    }

    const payload = request.body as SlackEventEnvelope;
    const sourceEventId = payload.event_id ?? payload.event?.client_msg_id ?? `${payload.team_id}:${payload.event?.ts}`;
    if (!sourceEventId) {
      throw new BadRequestException('Slack payload is missing a source event ID');
    }

    return {
      source: this.source,
      organizationId: organizationIdFromRequest(request, payload.team_id),
      correlationId: newCorrelationId(request),
      receivedAt: new Date(),
      sourceEventId,
      rawPayload: request.body,
      headers: request.headers,
    };
  }

  async toIntermediateEvents(input: ValidatedSourceRequest): Promise<IntermediateEvent[]> {
    const payload = input.rawPayload as SlackEventEnvelope;
    const event = payload.event;
    if (!event || event.type !== 'message') {
      return [];
    }

    const eventType = event.subtype === 'message_changed' ? 'message.updated' : 'message.created';
    const message = event.message ?? event;
    const messageId = message.client_msg_id ?? message.ts ?? input.sourceEventId;

    return [
      {
        organizationId: input.organizationId,
        source: this.source,
        sourceEventId: input.sourceEventId,
        eventType,
        actor: {
          id: message.user ?? event.user ?? 'unknown-slack-user',
        },
        occurredAt: unixSecondsToDate(message.ts ?? event.ts),
        receivedAt: input.receivedAt,
        content: {
          text: message.text,
        },
        context: {
          workspaceId: payload.team_id,
          channelId: event.channel,
          threadId: event.thread_ts,
          messageId,
        },
        visibility: {
          type: event.channel_type === 'channel' ? 'public' : 'restricted',
          sourceNative: { channelType: event.channel_type },
        },
        metadata: {
          slackSubtype: event.subtype,
          retryNum: firstHeader(input.headers['x-slack-retry-num']),
          retryReason: firstHeader(input.headers['x-slack-retry-reason']),
        },
        correlationId: input.correlationId,
      },
    ];
  }
}

type SlackEventEnvelope = {
  team_id?: string;
  event_id?: string;
  event?: {
    type?: string;
    subtype?: string;
    user?: string;
    channel?: string;
    channel_type?: string;
    ts?: string;
    thread_ts?: string;
    client_msg_id?: string;
    text?: string;
    message?: {
      user?: string;
      ts?: string;
      client_msg_id?: string;
      text?: string;
    };
  };
};
