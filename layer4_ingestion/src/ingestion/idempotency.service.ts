import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma/prisma.service';
import { Source } from '../normalizer/company-event.schema';

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  buildKey(input: {
    organizationId: string;
    source: Source;
    sourceEventId: string;
    eventType: string;
  }) {
    return `${input.organizationId}:${input.source}:${input.sourceEventId}:${input.eventType}`;
  }

  async reserve(key: string, correlationId: string) {
    try {
      await this.prisma.idempotencyKey.create({
        data: {
          key,
          correlationId,
        },
      });

      return true;
    } catch {
      return false;
    }
  }
}
