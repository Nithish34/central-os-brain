import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstHeader } from '../common/http/header';
import { GmailApiService } from '../connectors/gmail/gmail-api.service';
import { IntermediateEvent } from '../normalizer/intermediate-event';
import { newCorrelationId, organizationIdFromRequest, parsePubSubMessageData } from './adapter-utils';
import { SourceAdapter, SourceHttpRequest, ValidatedSourceRequest } from './source-adapter.interface';

@Injectable()
export class GmailAdapter implements SourceAdapter {
  readonly source = 'gmail' as const;

  constructor(
    private readonly config: ConfigService,
    private readonly gmail: GmailApiService,
  ) {}

  async validateRequest(request: SourceHttpRequest): Promise<ValidatedSourceRequest> {
    const secret = this.config.get<string>('GOOGLE_PUBSUB_VERIFICATION_SECRET');
    const providedSecret =
      firstHeader(request.headers['x-goog-channel-token']) ??
      firstHeader(request.headers['x-company-pubsub-token']) ??
      (typeof request.query.token === 'string' ? request.query.token : undefined);

    if (secret && providedSecret !== secret) {
      throw new UnauthorizedException('Invalid Gmail Pub/Sub verification token');
    }

    const body = request.body as PubSubPushEnvelope;
    if (!body.message) {
      throw new BadRequestException('Missing Pub/Sub message');
    }

    const data = parsePubSubMessageData(body.message);
    const emailAddress = typeof data.emailAddress === 'string' ? data.emailAddress : undefined;
    const historyId = typeof data.historyId === 'string' ? data.historyId : undefined;

    if (!emailAddress || !historyId) {
      throw new BadRequestException('Gmail Pub/Sub data is missing emailAddress or historyId');
    }

    return {
      source: this.source,
      organizationId: organizationIdFromRequest(request),
      correlationId: newCorrelationId(request),
      receivedAt: new Date(),
      sourceEventId: `${emailAddress}:${historyId}`,
      rawPayload: {
        envelope: request.body,
        gmail: data,
      },
      headers: request.headers,
    };
  }

  async toIntermediateEvents(input: ValidatedSourceRequest): Promise<IntermediateEvent[]> {
    const raw = input.rawPayload as { gmail: { emailAddress: string; historyId: string } };
    const messages = await this.gmail.listNewInboundMessages({
      organizationId: input.organizationId,
      emailAddress: raw.gmail.emailAddress,
      historyId: raw.gmail.historyId,
    });

    return messages.map((message) => ({
      organizationId: input.organizationId,
      source: this.source,
      sourceEventId: message.messageId ?? message.id,
      eventType: 'email.received',
      actor: {
        id: message.from ?? 'unknown-email-sender',
        displayName: message.from,
        email: extractEmail(message.from),
      },
      occurredAt: message.date,
      receivedAt: input.receivedAt,
      content: {
        title: message.subject,
        summary: message.snippet ?? undefined,
      },
      context: {
        emailMessageId: message.messageId ?? message.id,
        threadId: message.threadId ?? undefined,
      },
      visibility: {
        type: 'restricted',
        sourceNative: {
          to: message.to,
          cc: message.cc,
          watchedMailbox: raw.gmail.emailAddress,
        },
      },
      metadata: {
        gmailMessageId: message.id,
        gmailHistoryId: message.historyId,
      },
      correlationId: input.correlationId,
    }));
  }
}

function extractEmail(value?: string) {
  if (!value) {
    return undefined;
  }

  const match = value.match(/<([^>]+)>/);
  return match?.[1] ?? (value.includes('@') ? value : undefined);
}

type PubSubPushEnvelope = {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
};
