import { z } from 'zod';

export const sourceSchema = z.enum(['slack', 'teams', 'github', 'gmail']);

export const eventTypeSchema = z.enum([
  'message.created',
  'message.updated',
  'pull_request.opened',
  'pull_request.updated',
  'pull_request.merged',
  'issue.opened',
  'issue.updated',
  'issue_comment.created',
  'push.created',
  'email.received',
]);

export const companyEventSchema = z.object({
  eventId: z.string().uuid(),
  organizationId: z.string().min(1),
  source: sourceSchema,
  sourceEventId: z.string().min(1),
  eventType: eventTypeSchema,
  actor: z.object({
    id: z.string().min(1),
    displayName: z.string().optional(),
    email: z.string().email().optional(),
  }),
  occurredAt: z.string().datetime(),
  receivedAt: z.string().datetime(),
  content: z.object({
    title: z.string().optional(),
    text: z.string().optional(),
    html: z.string().optional(),
    summary: z.string().optional(),
  }),
  context: z.object({
    workspaceId: z.string().optional(),
    channelId: z.string().optional(),
    teamId: z.string().optional(),
    repositoryId: z.string().optional(),
    repositoryName: z.string().optional(),
    threadId: z.string().optional(),
    messageId: z.string().optional(),
    emailMessageId: z.string().optional(),
  }),
  sourceUrl: z.string().url().optional(),
  visibility: z.object({
    type: z.enum(['public', 'private', 'restricted', 'unknown']),
    sourceNative: z.unknown().optional(),
  }),
  metadata: z.record(z.unknown()),
  correlationId: z.string().min(1),
});

export type Source = z.infer<typeof sourceSchema>;
export type CompanyEventType = z.infer<typeof eventTypeSchema>;
export type CompanyEvent = z.infer<typeof companyEventSchema>;
