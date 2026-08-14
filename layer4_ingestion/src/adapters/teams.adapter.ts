import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntermediateEvent } from '../normalizer/intermediate-event';
import { newCorrelationId, organizationIdFromRequest } from './adapter-utils';
import { SourceAdapter, SourceHttpRequest, ValidatedSourceRequest } from './source-adapter.interface';

@Injectable()
export class TeamsAdapter implements SourceAdapter {
  readonly source = 'teams' as const;

  constructor(private readonly config: ConfigService) {}

  async validateRequest(request: SourceHttpRequest): Promise<ValidatedSourceRequest> {
    const expectedClientState = this.config.get<string>('MICROSOFT_CLIENT_STATE_SECRET');
    if (!expectedClientState) {
      throw new UnauthorizedException('Microsoft clientState secret is not configured');
    }

    const body = request.body as TeamsNotificationCollection;
    if (!Array.isArray(body.value) || body.value.length === 0) {
      throw new BadRequestException('Microsoft Graph notification payload has no value entries');
    }

    for (const item of body.value) {
      if (item.clientState !== expectedClientState) {
        throw new UnauthorizedException('Invalid Microsoft Graph clientState');
      }
    }

    return {
      source: this.source,
      organizationId: organizationIdFromRequest(request, body.value[0]?.tenantId),
      correlationId: newCorrelationId(request),
      receivedAt: new Date(),
      sourceEventId: body.value.map((item) => item.id ?? item.resourceData?.id ?? item.subscriptionId).join(','),
      rawPayload: request.body,
      headers: request.headers,
    };
  }

  async toIntermediateEvents(input: ValidatedSourceRequest): Promise<IntermediateEvent[]> {
    const body = input.rawPayload as TeamsNotificationCollection;

    return body.value
      .filter((item) => !item.lifecycleEvent)
      .map((item) => {
        const resourceData = item.resourceData ?? {};
        const sourceEventId = item.id ?? resourceData.id ?? `${item.subscriptionId}:${item.resource}`;
        const updated = item.changeType === 'updated';

        return {
          organizationId: input.organizationId,
          source: this.source,
          sourceEventId,
          eventType: updated ? 'message.updated' : 'message.created',
          actor: {
            id: resourceData.from?.user?.id ?? 'unknown-teams-user',
            displayName: resourceData.from?.user?.displayName,
          },
          occurredAt: resourceData.createdDateTime ? new Date(resourceData.createdDateTime) : input.receivedAt,
          receivedAt: input.receivedAt,
          content: {
            text: stripHtml(resourceData.body?.content),
            html: resourceData.body?.content,
          },
          context: {
            teamId: resourceData.teamId,
            channelId: resourceData.channelId,
            threadId: resourceData.replyToId,
            messageId: resourceData.id,
          },
          sourceUrl: resourceData.webUrl,
          visibility: {
            type: 'restricted',
            sourceNative: { resource: item.resource },
          },
          metadata: {
            subscriptionId: item.subscriptionId,
            changeType: item.changeType,
            tenantId: item.tenantId,
          },
          correlationId: input.correlationId,
        } satisfies IntermediateEvent;
      });
  }
}

function stripHtml(value?: string) {
  return value?.replace(/<[^>]*>/g, '').trim();
}

type TeamsNotificationCollection = {
  value: Array<{
    id?: string;
    subscriptionId: string;
    tenantId?: string;
    clientState?: string;
    changeType?: 'created' | 'updated' | 'deleted';
    resource?: string;
    lifecycleEvent?: string;
    resourceData?: {
      id?: string;
      teamId?: string;
      channelId?: string;
      replyToId?: string;
      webUrl?: string;
      createdDateTime?: string;
      body?: {
        content?: string;
      };
      from?: {
        user?: {
          id?: string;
          displayName?: string;
        };
      };
    };
  }>;
};
