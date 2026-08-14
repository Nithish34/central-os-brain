import { Module } from '@nestjs/common';
import { GmailApiService } from './gmail-api.service';

@Module({
  providers: [GmailApiService],
  exports: [GmailApiService],
})
export class GmailModule {}
