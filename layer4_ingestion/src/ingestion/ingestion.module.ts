import { Module } from '@nestjs/common';
import { SlackAdapter } from '../adapters/slack.adapter';
import { TeamsAdapter } from '../adapters/teams.adapter';
import { GitHubAdapter } from '../adapters/github.adapter';
import { GmailAdapter } from '../adapters/gmail.adapter';
import { GmailModule } from '../connectors/gmail/gmail.module';
import { NormalizerModule } from '../normalizer/normalizer.module';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { IdempotencyService } from './idempotency.service';

@Module({
  imports: [NormalizerModule, GmailModule],
  controllers: [IngestionController],
  providers: [
    IngestionService,
    IdempotencyService,
    SlackAdapter,
    TeamsAdapter,
    GitHubAdapter,
    GmailAdapter,
  ],
})
export class IngestionModule {}
