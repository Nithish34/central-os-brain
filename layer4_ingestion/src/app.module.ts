import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health.controller';
import { CryptoModule } from './common/crypto/crypto.module';
import { validateConfig } from './config/env.validation';
import { IngestionModule } from './ingestion/ingestion.module';
import { NormalizerModule } from './normalizer/normalizer.module';
import { PersistenceModule } from './persistence/persistence.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateConfig,
    }),
    ScheduleModule.forRoot(),
    CryptoModule,
    PersistenceModule,
    NormalizerModule,
    IngestionModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
