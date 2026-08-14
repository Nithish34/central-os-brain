import { Body, Controller, Headers, HttpCode, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { Source } from '../normalizer/company-event.schema';
import { IngestionService } from './ingestion.service';

@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestion: IngestionService) {}

  @Post('slack/events')
  @HttpCode(200)
  async slackEvents(@Req() req: Request, @Body() body: unknown, @Headers() headers: Record<string, string>, @Query() query: Record<string, unknown>) {
    if (isSlackUrlVerification(body)) {
      return { challenge: body.challenge };
    }

    return this.process('slack', req, body, headers, query);
  }

  @Post('teams/notifications')
  @HttpCode(202)
  async teamsNotifications(@Req() req: Request, @Body() body: unknown, @Headers() headers: Record<string, string>, @Query() query: Record<string, unknown>) {
    if (typeof query.validationToken === 'string') {
      return query.validationToken;
    }

    return this.process('teams', req, body, headers, query);
  }

  @Post('teams/lifecycle')
  @HttpCode(202)
  async teamsLifecycle(@Req() req: Request, @Body() body: unknown, @Headers() headers: Record<string, string>, @Query() query: Record<string, unknown>) {
    if (typeof query.validationToken === 'string') {
      return query.validationToken;
    }

    return this.process('teams', req, body, headers, query);
  }

  @Post('github/webhooks')
  @HttpCode(202)
  async githubWebhooks(@Req() req: Request, @Body() body: unknown, @Headers() headers: Record<string, string>, @Query() query: Record<string, unknown>) {
    return this.process('github', req, body, headers, query);
  }

  @Post('gmail/pubsub')
  @HttpCode(202)
  async gmailPubSub(@Req() req: Request, @Body() body: unknown, @Headers() headers: Record<string, string>, @Query() query: Record<string, unknown>) {
    return this.process('gmail', req, body, headers, query);
  }

  private process(source: Source, req: Request, body: unknown, headers: Record<string, string>, query: Record<string, unknown>) {
    return this.ingestion.process(source, {
      headers,
      body,
      rawBody: (req as Request & { rawBody?: Buffer }).rawBody,
      query,
    });
  }
}

function isSlackUrlVerification(body: unknown): body is { type: string; challenge: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { type?: unknown }).type === 'url_verification' &&
    typeof (body as { challenge?: unknown }).challenge === 'string'
  );
}
