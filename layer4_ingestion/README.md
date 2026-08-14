# Company Brain OS Phase 1

Greenfield NestJS backend for the Phase 1 boundary:

```text
Slack / Teams / GitHub / Gmail
        -> ingestion
        -> source adapters
        -> event normalizer
        -> CompanyEvent
        -> STOP
```

This project intentionally stops after canonical `CompanyEvent` creation. It does not include agents, Notion, Jira, RAG, knowledge graph, workflows, human approval, or action execution.

## Local Setup

1. Copy `.env.example` to `.env`.
2. Fill in the platform secrets you want to test.
3. Start PostgreSQL and set `DATABASE_URL`.
4. Install dependencies:

```bash
npm install
```

5. Generate Prisma and migrate:

```bash
npm run prisma:generate
npm run prisma:migrate
```

6. Start the API:

```bash
npm run start:dev
```

Health check:

```text
GET /health
```

## Webhook Endpoints

```text
POST /ingestion/slack/events
POST /ingestion/teams/notifications
POST /ingestion/teams/lifecycle
POST /ingestion/github/webhooks
POST /ingestion/gmail/pubsub
```

Every endpoint accepts `x-company-organization-id` or `?organizationId=` so real external accounts can be mapped to an internal organization during Phase 1.

## Real-Data Requirement

Unit tests may use fixtures, but the final acceptance test must use real events from:

- Slack Events API
- Microsoft Graph Teams change notifications
- GitHub App webhooks
- Gmail API push notifications through Google Cloud Pub/Sub

## Gmail Notes

Gmail Pub/Sub notifications do not contain full email content. They contain mailbox identity and `historyId`. This backend uses that notification to call Gmail API `history.list` and `messages.get`, then normalizes discovered inbound messages as `email.received`.

Before Gmail can normalize email, create a `connectorAccount` and encrypted `oauthToken` record for the mailbox, then call `GmailApiService.watchMailbox` from an admin/setup flow.
