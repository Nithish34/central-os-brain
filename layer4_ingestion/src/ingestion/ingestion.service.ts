import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SourceAdapter, SourceHttpRequest } from '../adapters/source-adapter.interface';
import { EventNormalizerService } from '../normalizer/event-normalizer.service';
import { Source } from '../normalizer/company-event.schema';
import { PrismaService } from '../persistence/prisma/prisma.service';
import { IdempotencyService } from './idempotency.service';
import { SlackAdapter } from '../adapters/slack.adapter';
import { TeamsAdapter } from '../adapters/teams.adapter';
import { GitHubAdapter } from '../adapters/github.adapter';
import { GmailAdapter } from '../adapters/gmail.adapter';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly adapters: Map<Source, SourceAdapter>;

  constructor(
    slack: SlackAdapter,
    teams: TeamsAdapter,
    github: GitHubAdapter,
    gmail: GmailAdapter,
    private readonly normalizer: EventNormalizerService,
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {
    this.adapters = new Map<Source, SourceAdapter>([
      ['slack', slack],
      ['teams', teams],
      ['github', github],
      ['gmail', gmail],
    ]);
  }

  async process(source: Source, request: SourceHttpRequest) {
    const adapter = this.adapters.get(source);
    if (!adapter) {
      throw new BadRequestException(`Unsupported source: ${source}`);
    }

    const startedAt = Date.now();

    try {
      const validated = await adapter.validateRequest(request);

      await this.prisma.rawEvent.create({
        data: {
          organizationId: validated.organizationId,
          source: validated.source,
          sourceEventId: validated.sourceEventId,
          correlationId: validated.correlationId,
          status: 'validated',
          payload: toPrismaJson(sanitizePayload(validated.rawPayload)),
          receivedAt: validated.receivedAt,
        },
      });

      const intermediateEvents = await adapter.toIntermediateEvents(validated);
      const results = [];

      for (const event of intermediateEvents) {
        const key = this.idempotency.buildKey({
          organizationId: event.organizationId,
          source: event.source,
          sourceEventId: event.sourceEventId,
          eventType: event.eventType,
        });
        const reserved = await this.idempotency.reserve(key, event.correlationId);

        if (!reserved) {
          results.push({
            sourceEventId: event.sourceEventId,
            eventType: event.eventType,
            status: 'duplicate',
          });
          continue;
        }

        const companyEvent = this.normalizer.normalize(event);

        await this.prisma.normalizedEvent.create({
          data: {
            eventId: companyEvent.eventId,
            organizationId: companyEvent.organizationId,
            source: companyEvent.source,
            sourceEventId: companyEvent.sourceEventId,
            eventType: companyEvent.eventType,
            correlationId: companyEvent.correlationId,
            payload: toPrismaJson(companyEvent),
            occurredAt: new Date(companyEvent.occurredAt),
            receivedAt: new Date(companyEvent.receivedAt),
          },
        });

        results.push({
          eventId: companyEvent.eventId,
          sourceEventId: event.sourceEventId,
          eventType: event.eventType,
          status: 'normalized',
        });
      }

      this.logger.log({
        source,
        correlationId: validated.correlationId,
        durationMs: Date.now() - startedAt,
        count: results.length,
      });

      return {
        correlationId: validated.correlationId,
        source,
        results,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown ingestion error';
      this.logger.warn({ source, message, durationMs: Date.now() - startedAt });

      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(message);
    }
  }
}

function sanitizePayload(payload: unknown) {
  if (typeof payload !== 'object' || payload === null) {
    return payload;
  }

  const serialized = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  delete serialized.token;
  delete serialized.authorization;
  delete serialized.access_token;
  delete serialized.refresh_token;

  return serialized;
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
