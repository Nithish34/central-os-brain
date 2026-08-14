import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'company-brain-os-phase-1',
      phaseBoundary: 'connectors-ingestion-adapters-normalizer-company-event',
    };
  }
}
