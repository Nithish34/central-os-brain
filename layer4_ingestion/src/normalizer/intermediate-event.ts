import { CompanyEventType, Source } from './company-event.schema';

export type IntermediateEvent = {
  organizationId: string;
  source: Source;
  sourceEventId: string;
  eventType: CompanyEventType;
  actor: {
    id: string;
    displayName?: string;
    email?: string;
  };
  occurredAt: Date;
  receivedAt: Date;
  content: {
    title?: string;
    text?: string;
    html?: string;
    summary?: string;
  };
  context: {
    workspaceId?: string;
    channelId?: string;
    teamId?: string;
    repositoryId?: string;
    repositoryName?: string;
    threadId?: string;
    messageId?: string;
    emailMessageId?: string;
  };
  sourceUrl?: string;
  visibility: {
    type: 'public' | 'private' | 'restricted' | 'unknown';
    sourceNative?: unknown;
  };
  metadata: Record<string, unknown>;
  correlationId: string;
};
