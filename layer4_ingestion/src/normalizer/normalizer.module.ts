import { Module } from '@nestjs/common';
import { EventNormalizerService } from './event-normalizer.service';

@Module({
  providers: [EventNormalizerService],
  exports: [EventNormalizerService],
})
export class NormalizerModule {}
