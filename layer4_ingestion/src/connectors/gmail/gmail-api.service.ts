import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, gmail_v1 } from 'googleapis';
import { CryptoService } from '../../common/crypto/crypto.service';
import { PrismaService } from '../../persistence/prisma/prisma.service';

@Injectable()
export class GmailApiService {
  private readonly logger = new Logger(GmailApiService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async listNewInboundMessages(input: {
    organizationId: string;
    emailAddress: string;
    historyId: string;
  }): Promise<GmailInboundMessage[]> {
    const account = await this.prisma.connectorAccount.findFirst({
      where: {
        organizationId: input.organizationId,
        source: 'gmail',
        externalAccountId: input.emailAddress,
      },
      include: { oauthToken: true },
    });

    if (!account?.oauthToken) {
      this.logger.warn({
        organizationId: input.organizationId,
        emailAddress: input.emailAddress,
        message: 'No Gmail OAuth token found for Pub/Sub notification',
      });
      return [];
    }

    const client = this.oauthClient();
    client.setCredentials({
      access_token: this.crypto.decrypt(account.oauthToken.accessToken),
      refresh_token: account.oauthToken.refreshToken ? this.crypto.decrypt(account.oauthToken.refreshToken) : undefined,
      expiry_date: account.oauthToken.expiresAt?.getTime(),
    });

    const gmail = google.gmail({ version: 'v1', auth: client });
    const startHistoryId = account.lastHistoryId ?? input.historyId;
    const history = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded'],
    });

    const messages = history.data.history?.flatMap((item) => item.messagesAdded ?? []) ?? [];
    const inbound: GmailInboundMessage[] = [];

    for (const item of messages) {
      const messageId = item.message?.id;
      if (!messageId) {
        continue;
      }

      const message = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'Date', 'Message-ID'],
      });
      inbound.push(toInboundMessage(message.data));
    }

    await this.prisma.connectorAccount.update({
      where: { id: account.id },
      data: { lastHistoryId: history.data.historyId ?? input.historyId },
    });

    return inbound;
  }

  async watchMailbox(input: { organizationId: string; emailAddress: string }) {
    const topicName = this.config.get<string>('GOOGLE_PUBSUB_TOPIC');
    if (!topicName) {
      throw new Error('GOOGLE_PUBSUB_TOPIC is required to watch Gmail mailboxes');
    }

    const account = await this.prisma.connectorAccount.findFirstOrThrow({
      where: {
        organizationId: input.organizationId,
        source: 'gmail',
        externalAccountId: input.emailAddress,
      },
      include: { oauthToken: true },
    });

    if (!account.oauthToken) {
      throw new Error('Gmail OAuth token is required before creating a Gmail watch');
    }

    const client = this.oauthClient();
    client.setCredentials({
      access_token: this.crypto.decrypt(account.oauthToken.accessToken),
      refresh_token: account.oauthToken.refreshToken ? this.crypto.decrypt(account.oauthToken.refreshToken) : undefined,
      expiry_date: account.oauthToken.expiresAt?.getTime(),
    });

    const gmail = google.gmail({ version: 'v1', auth: client });
    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName,
        labelIds: ['INBOX'],
        labelFilterBehavior: 'INCLUDE',
      },
    });

    await this.prisma.connectorAccount.update({
      where: { id: account.id },
      data: {
        lastHistoryId: response.data.historyId,
        watchExpiresAt: response.data.expiration ? new Date(Number(response.data.expiration)) : undefined,
      },
    });

    return response.data;
  }

  private oauthClient() {
    return new google.auth.OAuth2(
      this.config.get<string>('GOOGLE_CLIENT_ID'),
      this.config.get<string>('GOOGLE_CLIENT_SECRET'),
      `${this.config.get<string>('APP_BASE_URL')}/oauth/google/callback`,
    );
  }
}

function toInboundMessage(message: gmail_v1.Schema$Message): GmailInboundMessage {
  const headers = new Map((message.payload?.headers ?? []).map((header) => [header.name?.toLowerCase(), header.value]));

  return {
    id: message.id ?? 'unknown-gmail-message',
    threadId: message.threadId,
    historyId: message.historyId,
    from: headerValue(headers, 'from'),
    to: headerValue(headers, 'to'),
    cc: headerValue(headers, 'cc'),
    subject: headerValue(headers, 'subject'),
    messageId: headerValue(headers, 'message-id'),
    date: headers.get('date') ? new Date(headers.get('date') as string) : new Date(Number(message.internalDate ?? Date.now())),
    snippet: message.snippet,
  };
}

function headerValue(headers: Map<string | undefined, string | null | undefined>, name: string) {
  return headers.get(name) ?? undefined;
}

export type GmailInboundMessage = {
  id: string;
  threadId?: string | null;
  historyId?: string | null;
  from?: string;
  to?: string;
  cc?: string;
  subject?: string;
  messageId?: string;
  date: Date;
  snippet?: string | null;
};
