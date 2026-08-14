import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { SourceHttpRequest } from './source-adapter.interface';
import { firstHeader } from '../common/http/header';

export function requestBodyString(request: SourceHttpRequest) {
  if (request.rawBody) {
    return request.rawBody.toString('utf8');
  }

  return JSON.stringify(request.body ?? {});
}

export function organizationIdFromRequest(request: SourceHttpRequest, payloadOrgId?: string) {
  const headerOrgId = firstHeader(request.headers['x-company-organization-id']);
  const queryOrgId = typeof request.query.organizationId === 'string' ? request.query.organizationId : undefined;
  const organizationId = headerOrgId ?? queryOrgId ?? payloadOrgId;

  if (!organizationId) {
    throw new BadRequestException('Missing organization mapping. Provide x-company-organization-id or organizationId query parameter.');
  }

  return organizationId;
}

export function newCorrelationId(request: SourceHttpRequest) {
  return firstHeader(request.headers['x-correlation-id']) ?? randomUUID();
}

export function unixSecondsToDate(value: string | number | undefined) {
  if (value === undefined) {
    return new Date();
  }

  const numeric = typeof value === 'string' ? Number(value.split('.')[0]) : value;
  return Number.isFinite(numeric) ? new Date(numeric * 1000) : new Date();
}

export function parsePubSubMessageData(message: unknown) {
  if (typeof message !== 'object' || message === null) {
    throw new BadRequestException('Invalid Pub/Sub message envelope');
  }

  const data = (message as { data?: unknown }).data;
  if (typeof data !== 'string') {
    throw new BadRequestException('Missing Pub/Sub message data');
  }

  return JSON.parse(Buffer.from(data, 'base64').toString('utf8')) as Record<string, unknown>;
}
