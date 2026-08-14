# Company Brain OS - Step-by-Step Build Task List

## Project Goal

Build a national-level 20-hour hackathon MVP of **Company Brain OS**: a self-healing enterprise knowledge and workflow system that detects outdated company knowledge, explains the conflict with evidence, lets a human approve the fix, and triggers simulated company workflows.

## Winning Demo Story

The MVP should tell one strong story:

1. An official company document says the payment service uses JWT.
2. A newer Slack engineering decision says the team has moved to OAuth2.
3. Company Brain detects the contradiction.
4. It shows evidence, confidence, freshness, ownership, and business impact.
5. The user approves the AI-generated documentation update.
6. The system simulates follow-up actions across Jira, Slack, GitHub, and audit logs.

## Phase 0 - Setup Decisions

- [ ] Confirm project name: `Company Brain OS`.
- [ ] Confirm MVP scope: synthetic enterprise data only.
- [ ] Confirm demo focus: self-healing knowledge plus agentic workflow.
- [ ] Confirm no real OAuth integrations for the 20-hour version.
- [ ] Confirm local development stack:
  - Frontend: Next.js, TypeScript, Tailwind CSS.
  - Backend: FastAPI, Python.
  - Data: JSON and Markdown fixtures.
  - Storage for MVP: in-memory or local JSON files.
  - Optional AI: LLM API if available, deterministic fallback if not.

## Phase 1 - Repository Bootstrap

- [ ] Install or verify required tools:
  - Node.js LTS.
  - Python 3.11+.
  - Git.
  - VS Code or preferred editor.
- [ ] Create monorepo structure:
  - `frontend/`
  - `backend/`
  - `data/`
  - `docs/`
  - `scripts/`
- [ ] Add root documentation:
  - `README.md`
  - `TASK_LIST.md`
  - `.env.example`
- [ ] Add root commands to run the project locally.
- [ ] Initialize Git repository.
- [ ] Create first commit after scaffolding.

## Phase 2 - Synthetic Enterprise Dataset

- [ ] Create synthetic official documents:
  - Payment service architecture doc.
  - Authentication policy.
  - Customer onboarding SOP.
  - Deployment checklist.
- [ ] Create synthetic communication events:
  - Slack message announcing JWT to OAuth2 migration.
  - Engineering meeting note confirming OAuth2 timeline.
  - Product manager message about customer impact.
- [ ] Create synthetic development records:
  - GitHub PR summary mentioning OAuth middleware.
  - Jira ticket for auth migration.
- [ ] Add metadata to every item:
  - `id`
  - `source`
  - `title`
  - `content`
  - `author`
  - `owner`
  - `timestamp`
  - `authority_score`
  - `freshness_score`
  - `tags`
- [ ] Add at least three demo conflicts:
  - JWT vs OAuth2.
  - Deployment frequency mismatch.
  - Customer onboarding owner mismatch.
- [ ] Add at least one clean non-conflicting example.

## Phase 3 - Backend Foundation

- [ ] Create FastAPI app.
- [ ] Add health endpoint:
  - `GET /health`
- [ ] Add dataset endpoints:
  - `GET /sources`
  - `GET /documents`
  - `GET /events`
- [ ] Add knowledge dashboard endpoint:
  - `GET /knowledge/health`
- [ ] Add conflict endpoints:
  - `GET /conflicts`
  - `GET /conflicts/{conflict_id}`
- [ ] Add approval endpoints:
  - `POST /conflicts/{conflict_id}/approve`
  - `POST /conflicts/{conflict_id}/reject`
- [ ] Add workflow endpoint:
  - `GET /workflows`
- [ ] Add audit endpoint:
  - `GET /audit-logs`
- [ ] Ensure API returns stable JSON for the frontend demo.

## Phase 4 - Knowledge and Conflict Engine

- [ ] Implement fixture loader.
- [ ] Normalize documents and events into a shared internal model.
- [ ] Implement conflict detection for the demo:
  - Match related items by tags and business domain.
  - Detect contradiction using explicit conflict pairs for demo reliability.
  - Generate confidence score from recency, authority, and source agreement.
- [ ] Implement knowledge health metrics:
  - Total documents.
  - Total events.
  - Open conflicts.
  - Resolved conflicts.
  - Average freshness score.
  - High-risk outdated documents.
- [ ] Generate evidence for every conflict:
  - Official source.
  - Newer contradicting source.
  - Timestamp comparison.
  - Authority comparison.
  - Recommended owner.
- [ ] Generate recommended update text.
- [ ] Add deterministic fallback explanations so demo works without an LLM.
- [ ] Optional: add LLM-generated explanation behind an environment flag.

## Phase 5 - Human Approval and Workflow Simulation

- [ ] Store conflict status:
  - `open`
  - `approved`
  - `rejected`
  - `resolved`
- [ ] When a conflict is approved:
  - Mark conflict as approved/resolved.
  - Update the synthetic official document content or generated patch.
  - Create simulated Jira task.
  - Create simulated Slack notification.
  - Create simulated GitHub documentation PR.
  - Write audit log entry.
- [ ] When a conflict is rejected:
  - Mark conflict as rejected.
  - Store rejection reason if provided.
  - Write audit log entry.
- [ ] Add reset script or endpoint:
  - `POST /demo/reset`
- [ ] Make the workflow timeline deterministic and impressive for live judging.

## Phase 6 - Frontend Foundation

- [ ] Create Next.js app with TypeScript.
- [ ] Configure Tailwind CSS.
- [ ] Create application shell:
  - Left navigation.
  - Top status bar.
  - Main content area.
- [ ] Add routes or tabs:
  - Command Center.
  - Conflicts.
  - Conflict Detail.
  - Workflows.
  - Audit Logs.
- [ ] Create reusable UI components:
  - Metric tile.
  - Status badge.
  - Evidence panel.
  - Confidence meter.
  - Timeline item.
  - Source card.
  - Approval action bar.
- [ ] Connect frontend to backend API.
- [ ] Add loading and error states.

## Phase 7 - Frontend Demo Screens

- [ ] Build Command Center:
  - Knowledge health percentage.
  - Open conflicts count.
  - Stale documents count.
  - Automated workflows count.
  - Recent agent activity.
- [ ] Build Conflicts list:
  - Conflict title.
  - Severity.
  - Confidence.
  - Owner.
  - Affected system.
  - Status.
- [ ] Build Conflict Detail screen:
  - Old official document card.
  - New evidence card.
  - AI reasoning summary.
  - Confidence and freshness scores.
  - Recommended update preview.
  - Approve and reject controls.
- [ ] Build Workflow Timeline:
  - Documentation updated.
  - Jira task created.
  - Slack notification sent.
  - GitHub PR drafted.
  - Audit log recorded.
- [ ] Build Audit Logs:
  - Actor.
  - Action.
  - Timestamp.
  - Source evidence.
  - Approval status.
- [ ] Ensure the first screen immediately communicates the product.

## Phase 8 - Visual and UX Polish

- [ ] Use a serious enterprise dashboard style.
- [ ] Avoid making it look like a generic chatbot.
- [ ] Use compact cards only for repeated objects, not every section.
- [ ] Use icons for actions and source types.
- [ ] Make confidence and risk visually obvious.
- [ ] Make the approval flow feel like a real enterprise control system.
- [ ] Ensure all text fits on laptop and projector screens.
- [ ] Ensure the demo path requires minimal clicking.
- [ ] Add realistic timestamps and source names.
- [ ] Add empty states only where needed.

## Phase 9 - Testing and Verification

- [ ] Backend tests:
  - Health endpoint works.
  - Documents endpoint returns fixtures.
  - Conflicts endpoint returns demo conflicts.
  - Approval endpoint changes status.
  - Approval creates workflow events.
  - Audit log is created.
  - Demo reset restores initial state.
- [ ] Frontend checks:
  - Dashboard loads.
  - Conflict list loads.
  - Conflict detail loads.
  - Approve button triggers workflow timeline.
  - UI remains readable on common laptop resolution.
- [ ] End-to-end demo check:
  - Start backend.
  - Start frontend.
  - Open dashboard.
  - Review JWT vs OAuth2 conflict.
  - Approve recommended update.
  - Show workflow timeline.
  - Show audit log.
- [ ] Rehearse the full demo in under four minutes.

## Phase 10 - Pitch and Submission Assets

- [ ] Create `docs/PITCH.md` with:
  - Problem.
  - Solution.
  - Innovation.
  - Architecture.
  - Demo flow.
  - Impact.
  - Future scope.
- [ ] Create `docs/ARCHITECTURE.md` with:
  - System diagram.
  - Data flow.
  - Backend modules.
  - Frontend screens.
  - Future real integrations.
- [ ] Create final pitch line:
  - "Company Brain OS is a self-healing organizational memory that keeps enterprise knowledge accurate and turns approved decisions into action."
- [ ] Prepare judge-friendly metrics:
  - Reduces documentation rot.
  - Speeds onboarding.
  - Prevents outdated decisions.
  - Creates explainable automation.
- [ ] Prepare fallback demo:
  - Screenshots.
  - Local seed data.
  - Reset command.
  - Short recorded demo if time allows.

## 20-Hour Execution Schedule

### Hour 0-1: Setup

- [ ] Install tools.
- [ ] Create repo structure.
- [ ] Scaffold frontend and backend.
- [ ] Add initial docs.

### Hour 1-3: Data

- [ ] Create synthetic documents, events, and metadata.
- [ ] Add three conflicts and one clean example.
- [ ] Validate fixture shape.

### Hour 3-6: Backend Core

- [ ] Build FastAPI app.
- [ ] Implement fixture loading.
- [ ] Implement dashboard and conflict APIs.
- [ ] Implement deterministic conflict detection.

### Hour 6-8: Approval and Workflow

- [ ] Implement approve/reject endpoints.
- [ ] Implement simulated Jira, Slack, GitHub, and audit events.
- [ ] Add demo reset.

### Hour 8-12: Frontend Core

- [ ] Build app shell.
- [ ] Build command center.
- [ ] Build conflict list.
- [ ] Build conflict detail.

### Hour 12-15: Demo Flow

- [ ] Connect approval UI.
- [ ] Build workflow timeline.
- [ ] Build audit logs.
- [ ] Polish the main JWT to OAuth2 story.

### Hour 15-17: Reliability

- [ ] Fix UI bugs.
- [ ] Add loading/error states.
- [ ] Verify reset path.
- [ ] Rehearse full local demo.

### Hour 17-19: Pitch

- [ ] Finish architecture doc.
- [ ] Finish pitch content.
- [ ] Prepare final speaking points.
- [ ] Add screenshots if useful.

### Hour 19-20: Final Demo Prep

- [ ] Run through demo three times.
- [ ] Check all commands.
- [ ] Keep backup screenshots ready.
- [ ] Prepare concise answers for judges.

## Minimum Viable Demo Definition

The project is demo-ready only when all of these are true:

- [ ] Dashboard opens and shows knowledge health.
- [ ] Conflict list shows at least three realistic conflicts.
- [ ] JWT vs OAuth2 conflict has clear evidence.
- [ ] Approval generates visible workflow actions.
- [ ] Audit log records the decision.
- [ ] Demo reset works.
- [ ] Pitch clearly explains why this is not just a chatbot.

## Stretch Goals

- [ ] Add real LLM-generated reasoning.
- [ ] Add embeddings or vector search.
- [ ] Add upload flow for custom documents.
- [ ] Add role-based users: admin, owner, viewer.
- [ ] Add knowledge graph visualization.
- [ ] Add real GitHub issue or PR creation.
- [ ] Add real Slack webhook notification.
- [ ] Add risk prediction for stale documents.

## Do Not Build in the 20-Hour MVP

- [ ] Full OAuth integrations.
- [ ] Multi-tenant enterprise auth.
- [ ] Production database migrations.
- [ ] Real-time webhooks from external services.
- [ ] Complex autonomous agents that can fail unpredictably.
- [ ] A generic chatbot as the main experience.
- [ ] Overly broad use cases beyond the core demo story.

## Judge Questions to Prepare For

- [ ] How is this different from a RAG chatbot?
- [ ] How do you prevent wrong AI updates?
- [ ] Why is human approval necessary?
- [ ] How do you handle enterprise permissions?
- [ ] What happens when two sources conflict?
- [ ] How would this scale to real Slack, Jira, Notion, and GitHub?
- [ ] What is the business impact?
- [ ] What would you build next after the hackathon?

