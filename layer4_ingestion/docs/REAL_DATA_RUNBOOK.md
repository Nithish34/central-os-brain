# Real-Data Integration Runbook

Use this runbook for Phase 1 acceptance. Do not use generated JSON as the end-to-end proof.

## Slack

1. Create a Slack app for a test workspace.
2. Configure the request URL:
   `POST {APP_BASE_URL}/ingestion/slack/events?organizationId={ORG_ID}`
3. Add Events API subscriptions for message events in selected channels.
4. Set `SLACK_SIGNING_SECRET`.
5. Send a real Slack message.
6. Confirm one `normalized_events` row with `source=slack` and `eventType=message.created`.

## Microsoft Teams

1. Register an app in Microsoft Entra.
2. Grant the minimum Microsoft Graph application permissions needed for Teams message change notifications.
3. Create Graph subscriptions for Teams channel/chat message changes.
4. Use:
   `POST {APP_BASE_URL}/ingestion/teams/notifications?organizationId={ORG_ID}`
5. Configure lifecycle notifications:
   `POST {APP_BASE_URL}/ingestion/teams/lifecycle?organizationId={ORG_ID}`
6. Set `MICROSOFT_CLIENT_STATE_SECRET` and use the same value in the Graph subscription.
7. Send a real Teams message.
8. Confirm one `normalized_events` row with `source=teams` and `eventType=message.created`.

## GitHub

1. Create a GitHub App.
2. Subscribe to `pull_request`, `issues`, `issue_comment`, and `push`.
3. Configure webhook URL:
   `POST {APP_BASE_URL}/ingestion/github/webhooks?organizationId={ORG_ID}`
4. Set `GITHUB_WEBHOOK_SECRET`.
5. Open or update a real pull request or issue.
6. Confirm one mapped `normalized_events` row.

## Gmail

1. Create a Google Cloud project and OAuth client.
2. Create a Cloud Pub/Sub topic and push subscription.
3. Grant publish permission to `gmail-api-push@system.gserviceaccount.com`.
4. Configure push endpoint:
   `POST {APP_BASE_URL}/ingestion/gmail/pubsub?organizationId={ORG_ID}&token={GOOGLE_PUBSUB_VERIFICATION_SECRET}`
5. Store a Gmail `connectorAccount` and encrypted OAuth token for the mailbox.
6. Call Gmail `watch` for the mailbox.
7. Send a real email to that mailbox.
8. Confirm one `normalized_events` row with `source=gmail` and `eventType=email.received`.

## Acceptance

Phase 1 is complete only when each source produces a canonical `CompanyEvent` from real platform activity.
