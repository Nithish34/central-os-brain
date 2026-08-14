import { IntermediateEvent } from '../normalizer/intermediate-event';
import { Source } from '../normalizer/company-event.schema';

export type SourceHttpRequest = {
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  rawBody?: Buffer;
  query: Record<string, unknown>;
};

export type ValidatedSourceRequest = {
  source: Source;
  organizationId: string;
  correlationId: string;
  receivedAt: Date;
  sourceEventId: string;
  rawPayload: unknown;
  headers: Record<string, string | string[] | undefined>;
};

export interface SourceAdapter {
  readonly source: Source;
  validateRequest(request: SourceHttpRequest): Promise<ValidatedSourceRequest>;
  toIntermediateEvents(input: ValidatedSourceRequest): Promise<IntermediateEvent[]>;
}
