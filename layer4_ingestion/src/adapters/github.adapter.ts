import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hmacSha256Hex, timingSafeStringEqual } from '../common/crypto/signature';
import { firstHeader } from '../common/http/header';
import { IntermediateEvent } from '../normalizer/intermediate-event';
import { newCorrelationId, organizationIdFromRequest, requestBodyString } from './adapter-utils';
import { SourceAdapter, SourceHttpRequest, ValidatedSourceRequest } from './source-adapter.interface';

@Injectable()
export class GitHubAdapter implements SourceAdapter {
  readonly source = 'github' as const;

  constructor(private readonly config: ConfigService) {}

  async validateRequest(request: SourceHttpRequest): Promise<ValidatedSourceRequest> {
    const secret = this.config.get<string>('GITHUB_WEBHOOK_SECRET');
    if (!secret) {
      throw new UnauthorizedException('GitHub webhook secret is not configured');
    }

    const signature = firstHeader(request.headers['x-hub-signature-256']);
    if (!signature) {
      throw new UnauthorizedException('Missing GitHub webhook signature');
    }

    const expected = `sha256=${hmacSha256Hex(secret, requestBodyString(request))}`;
    if (!timingSafeStringEqual(expected, signature)) {
      throw new UnauthorizedException('Invalid GitHub webhook signature');
    }

    const delivery = firstHeader(request.headers['x-github-delivery']);
    if (!delivery) {
      throw new BadRequestException('Missing GitHub delivery ID');
    }

    const payload = request.body as GitHubPayload;

    return {
      source: this.source,
      organizationId: organizationIdFromRequest(request, payload.organization?.id?.toString()),
      correlationId: newCorrelationId(request),
      receivedAt: new Date(),
      sourceEventId: delivery,
      rawPayload: request.body,
      headers: request.headers,
    };
  }

  async toIntermediateEvents(input: ValidatedSourceRequest): Promise<IntermediateEvent[]> {
    const payload = input.rawPayload as GitHubPayload;
    const githubEvent = firstHeader(input.headers['x-github-event']);
    const mapped = mapGitHubEvent(githubEvent, payload);
    if (!mapped) {
      return [];
    }

    return [
      {
        organizationId: input.organizationId,
        source: this.source,
        sourceEventId: input.sourceEventId,
        eventType: mapped.eventType,
        actor: {
          id: payload.sender?.id?.toString() ?? 'unknown-github-user',
          displayName: payload.sender?.login,
        },
        occurredAt: new Date(),
        receivedAt: input.receivedAt,
        content: mapped.content,
        context: {
          repositoryId: payload.repository?.id?.toString(),
          repositoryName: payload.repository?.full_name,
          threadId: mapped.threadId,
          messageId: mapped.messageId,
        },
        sourceUrl: mapped.sourceUrl,
        visibility: {
          type: payload.repository?.private ? 'private' : 'public',
          sourceNative: { private: payload.repository?.private },
        },
        metadata: {
          action: payload.action,
          githubEvent,
        },
        correlationId: input.correlationId,
      },
    ];
  }
}

function mapGitHubEvent(githubEvent: string | undefined, payload: GitHubPayload) {
  if (githubEvent === 'pull_request' && payload.pull_request) {
    const eventType =
      payload.action === 'closed' && payload.pull_request.merged
        ? 'pull_request.merged'
        : payload.action === 'opened'
          ? 'pull_request.opened'
          : 'pull_request.updated';

    return {
      eventType,
      content: {
        title: payload.pull_request.title,
        text: payload.pull_request.body,
        summary: `Pull request ${payload.action}: ${payload.pull_request.title}`,
      },
      sourceUrl: payload.pull_request.html_url,
      threadId: payload.pull_request.number?.toString(),
      messageId: payload.pull_request.id?.toString(),
    } as const;
  }

  if (githubEvent === 'issues' && payload.issue) {
    return {
      eventType: payload.action === 'opened' ? 'issue.opened' : 'issue.updated',
      content: {
        title: payload.issue.title,
        text: payload.issue.body,
        summary: `Issue ${payload.action}: ${payload.issue.title}`,
      },
      sourceUrl: payload.issue.html_url,
      threadId: payload.issue.number?.toString(),
      messageId: payload.issue.id?.toString(),
    } as const;
  }

  if (githubEvent === 'issue_comment' && payload.comment) {
    return {
      eventType: 'issue_comment.created',
      content: {
        text: payload.comment.body,
        summary: `Issue comment ${payload.action}`,
      },
      sourceUrl: payload.comment.html_url,
      threadId: payload.issue?.number?.toString(),
      messageId: payload.comment.id?.toString(),
    } as const;
  }

  if (githubEvent === 'push') {
    return {
      eventType: 'push.created',
      content: {
        title: payload.ref,
        summary: `Push to ${payload.ref}`,
      },
      sourceUrl: payload.compare,
      threadId: payload.ref,
      messageId: payload.after,
    } as const;
  }

  return undefined;
}

type GitHubPayload = {
  action?: string;
  ref?: string;
  after?: string;
  compare?: string;
  sender?: {
    id?: number;
    login?: string;
  };
  organization?: {
    id?: number;
  };
  repository?: {
    id?: number;
    full_name?: string;
    private?: boolean;
  };
  pull_request?: {
    id?: number;
    number?: number;
    title?: string;
    body?: string;
    html_url?: string;
    merged?: boolean;
  };
  issue?: {
    id?: number;
    number?: number;
    title?: string;
    body?: string;
    html_url?: string;
  };
  comment?: {
    id?: number;
    body?: string;
    html_url?: string;
  };
};
