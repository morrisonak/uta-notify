# UTA Notify - Development Plan

> **Version**: 1.0.0
> **Created**: 2026-01-15
> **Status**: Active

---

## Executive Summary

This document outlines the phased development plan for UTA Notify, a transit incident communication platform. The plan is organized into 6 phases, each building on the previous, with clear deliverables and acceptance criteria.

**Estimated Timeline**: 16-20 weeks (depending on team size and parallel work)

---

## Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DEVELOPMENT PHASES                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Phase 1          Phase 2           Phase 3          Phase 4                │
│  ┌──────┐        ┌──────┐          ┌──────┐        ┌──────┐                │
│  │ Core │───────▶│Channel│─────────▶│ Auto │───────▶│ Adv  │               │
│  │Platfm│        │Integr │          │mation│        │Channel│               │
│  └──────┘        └──────┘          └──────┘        └──────┘                │
│   2-3 wks         3-4 wks           2-3 wks         3-4 wks                 │
│                                                                              │
│                     Phase 5           Phase 6                                │
│                    ┌──────┐          ┌──────┐                               │
│                    │Enterp│─────────▶│Optim │                               │
│                    │ rise │          │ize   │                               │
│                    └──────┘          └──────┘                               │
│                     3-4 wks           2-3 wks                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Core Platform Completion

**Goal**: Complete foundational features, ensure stability, establish patterns

**Duration**: 2-3 weeks

**Prerequisites**: Current codebase state

### 1.1 Audit Logging Foundation

**Priority**: High
**Effort**: 3-4 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 1.1.1 | Create audit_logs table migration | `db/migrations/004_audit_logs.sql` |
| 1.1.2 | Create AuditLog domain schema | `core/domain/audit/audit.schema.ts` |
| 1.1.3 | Implement audit logging service | `src/server/audit.ts` |
| 1.1.4 | Add audit middleware for server functions | `src/lib/audit-middleware.ts` |
| 1.1.5 | Instrument incident operations | `src/server/incidents.ts` |
| 1.1.6 | Instrument message operations | `src/server/messages.ts` |
| 1.1.7 | Instrument subscriber operations | `src/server/subscribers.ts` |
| 1.1.8 | Create audit log viewer UI | `src/routes/admin/audit.tsx` |

#### Schema

```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),

  -- Actor
  actor_type TEXT NOT NULL, -- 'user', 'automation', 'system'
  actor_id TEXT,
  actor_name TEXT,

  -- Action
  action TEXT NOT NULL,     -- 'incident.create', 'message.send', etc.
  resource_type TEXT NOT NULL,
  resource_id TEXT,

  -- Details
  changes TEXT,             -- JSON of field changes
  metadata TEXT,            -- Additional context

  -- Context
  ip_address TEXT,
  user_agent TEXT,
  request_id TEXT,

  -- Outcome
  success INTEGER NOT NULL DEFAULT 1,
  error_message TEXT
);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_type, actor_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
```

#### Acceptance Criteria

- [ ] All incident CRUD operations are logged
- [ ] All message operations are logged
- [ ] Audit logs are immutable (no UPDATE/DELETE)
- [ ] Audit viewer shows filterable, searchable logs
- [ ] Each log entry includes actor, action, timestamp, changes

---

### 1.2 Error Handling & Validation

**Priority**: High
**Effort**: 2-3 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 1.2.1 | Create error boundary component | `src/components/error-boundary.tsx` |
| 1.2.2 | Implement global error handler | `src/lib/error-handler.ts` |
| 1.2.3 | Add toast notification system | `src/components/toast.tsx` |
| 1.2.4 | Standardize API error responses | `src/lib/api-errors.ts` |
| 1.2.5 | Add form validation feedback | Update existing forms |
| 1.2.6 | Implement retry logic for failed operations | `src/lib/retry.ts` |

#### Error Response Format

```typescript
interface ApiError {
  code: string;           // 'VALIDATION_ERROR', 'NOT_FOUND', etc.
  message: string;        // Human-readable message
  details?: {
    field?: string;       // Field that caused error
    reason?: string;      // Specific reason
  }[];
  requestId: string;      // For support/debugging
}
```

#### Acceptance Criteria

- [ ] All server functions return consistent error format
- [ ] UI displays user-friendly error messages
- [ ] Form validation shows inline errors
- [ ] Network errors trigger retry with user feedback
- [ ] Unhandled errors are caught and logged

---

### 1.3 Incident Versioning

**Priority**: Medium
**Effort**: 2-3 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 1.3.1 | Implement version creation on incident update | `src/server/incidents.ts` |
| 1.3.2 | Create version history API endpoint | `src/server/incidents.ts` |
| 1.3.3 | Build version history UI component | `src/components/incident-history.tsx` |
| 1.3.4 | Add version diff view | `src/components/version-diff.tsx` |
| 1.3.5 | Add "revert to version" functionality | `src/server/incidents.ts` |

#### Acceptance Criteria

- [ ] Every incident update creates a new version
- [ ] Version history shows all changes with timestamps
- [ ] Users can view diff between versions
- [ ] Users can revert to previous version (creates new version)
- [ ] Version includes snapshot of full incident state

---

### 1.4 Settings & Configuration

**Priority**: Medium
**Effort**: 2 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 1.4.1 | Create settings table | `db/migrations/005_settings.sql` |
| 1.4.2 | Implement settings service | `src/server/settings.ts` |
| 1.4.3 | Build settings admin UI | `src/routes/admin/settings.tsx` |
| 1.4.4 | Add incident type configuration | Settings UI |
| 1.4.5 | Add severity configuration | Settings UI |
| 1.4.6 | Add transit mode configuration | Settings UI |

#### Configurable Settings

```typescript
interface SystemSettings {
  // Incident Settings
  incidentTypes: { id: string; label: string; defaultSeverity: string }[];
  severityLevels: { id: string; label: string; color: string; priority: number }[];
  transitModes: { id: string; label: string; color: string }[];

  // Message Settings
  defaultChannels: string[];
  requireApproval: boolean;

  // Subscriber Settings
  maxBouncesBeforeDisable: number;
  inactiveCleanupDays: number;

  // System Settings
  sessionTimeoutMinutes: number;
  maintenanceMode: boolean;
}
```

#### Acceptance Criteria

- [ ] Admins can configure incident types
- [ ] Admins can configure severity levels
- [ ] Admins can configure transit modes
- [ ] Settings changes are audit logged
- [ ] Settings are cached for performance

---

### 1.5 Testing Infrastructure

**Priority**: High
**Effort**: 2-3 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 1.5.1 | Set up Bun test configuration | `bunfig.toml` |
| 1.5.2 | Create test utilities and mocks | `tests/utils/` |
| 1.5.3 | Write incident service tests | `tests/server/incidents.test.ts` |
| 1.5.4 | Write message service tests | `tests/server/messages.test.ts` |
| 1.5.5 | Write subscriber service tests | `tests/server/subscribers.test.ts` |
| 1.5.6 | Add CI test runner | `.github/workflows/test.yml` |

#### Test Structure

```
tests/
├── utils/
│   ├── db.ts           # Test database setup/teardown
│   ├── mocks.ts        # Common mocks
│   └── fixtures.ts     # Test data fixtures
├── server/
│   ├── incidents.test.ts
│   ├── messages.test.ts
│   ├── subscribers.test.ts
│   └── templates.test.ts
└── integration/
    └── incident-flow.test.ts
```

#### Acceptance Criteria

- [ ] `bun test` runs all tests
- [ ] Test database is isolated from dev/prod
- [ ] Tests cover CRUD operations for all entities
- [ ] CI runs tests on every PR
- [ ] Code coverage report generated

---

### Phase 1 Deliverables

| Deliverable | Description |
|-------------|-------------|
| Audit system | Complete audit logging with viewer UI |
| Error handling | Standardized errors, user feedback |
| Versioning | Incident version history and diff |
| Settings | Admin-configurable system settings |
| Tests | Test suite with CI integration |

---

## Phase 2: Channel Integration

**Goal**: Enable automated message delivery to primary channels

**Duration**: 3-4 weeks

**Prerequisites**: Phase 1 complete

### 2.1 Channel Adapter Framework

**Priority**: Critical
**Effort**: 3-4 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 2.1.1 | Define channel adapter interface | `src/channels/types.ts` |
| 2.1.2 | Create channel manager singleton | `src/channels/manager.ts` |
| 2.1.3 | Implement base adapter class | `src/channels/base-adapter.ts` |
| 2.1.4 | Create mock adapter for testing | `src/channels/adapters/mock.ts` |
| 2.1.5 | Add channel health check system | `src/channels/health.ts` |
| 2.1.6 | Build channel status dashboard | `src/routes/admin/channels.tsx` |

#### Channel Adapter Interface

```typescript
// src/channels/types.ts

export interface ChannelAdapter {
  readonly type: ChannelType;
  readonly name: string;

  // Lifecycle
  initialize(config: ChannelConfig): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<HealthCheckResult>;

  // Message Processing
  formatMessage(message: Message, incident: Incident): Promise<FormattedMessage>;
  validateMessage(formatted: FormattedMessage): ValidationResult;

  // Delivery
  send(formatted: FormattedMessage): Promise<DeliveryResult>;

  // Metadata
  getConstraints(): ChannelConstraints;
  getStatus(): ChannelStatus;
}

export interface ChannelConfig {
  enabled: boolean;
  testMode: boolean;
  credentials: Record<string, string>;
  options: Record<string, unknown>;
}

export interface DeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retryable: boolean;
  metadata?: Record<string, unknown>;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  message?: string;
  lastChecked: string;
}
```

#### Acceptance Criteria

- [ ] Adapter interface supports all required operations
- [ ] Channel manager handles adapter lifecycle
- [ ] Mock adapter works for testing
- [ ] Health check system monitors all channels
- [ ] Dashboard shows channel status

---

### 2.2 Cloudflare Queues Integration

**Priority**: Critical
**Effort**: 3-4 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 2.2.1 | Configure Cloudflare Queues | `wrangler.toml` |
| 2.2.2 | Create message queue producer | `src/queues/producer.ts` |
| 2.2.3 | Create queue consumer worker | `src/queues/consumer.ts` |
| 2.2.4 | Implement delivery tracking updates | `src/queues/delivery-tracker.ts` |
| 2.2.5 | Add dead-letter queue handling | `src/queues/dlq.ts` |
| 2.2.6 | Build queue monitoring UI | `src/routes/admin/queues.tsx` |

#### Queue Message Schema

```typescript
interface QueuedDelivery {
  id: string;                    // Delivery ID
  messageId: string;             // Message ID
  channelId: string;             // Target channel
  channelType: ChannelType;

  // Content
  formattedContent: string;
  mediaAttachments?: string[];

  // Metadata
  incidentId: string;
  subscriberId?: string;         // For subscriber notifications

  // Retry info
  attempt: number;
  maxAttempts: number;
  lastError?: string;

  // Timestamps
  queuedAt: string;
  scheduledFor?: string;         // For delayed delivery
}
```

#### Retry Strategy

```typescript
const RETRY_CONFIG = {
  maxAttempts: 5,
  backoffMs: [1000, 2000, 4000, 8000, 16000], // Exponential backoff
  retryableErrors: [
    'RATE_LIMITED',
    'TIMEOUT',
    'TEMPORARY_FAILURE',
    'SERVICE_UNAVAILABLE'
  ]
};
```

#### Acceptance Criteria

- [ ] Messages are queued for async delivery
- [ ] Queue consumer processes messages
- [ ] Failed deliveries are retried with backoff
- [ ] Non-retryable failures go to DLQ
- [ ] Queue depth and status visible in UI

---

### 2.3 Email Adapter (SendGrid)

**Priority**: High
**Effort**: 3-4 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 2.3.1 | Create SendGrid adapter | `src/channels/adapters/sendgrid.ts` |
| 2.3.2 | Implement HTML email template | `src/channels/templates/email.html` |
| 2.3.3 | Add plain text fallback | `src/channels/adapters/sendgrid.ts` |
| 2.3.4 | Handle bounce webhooks | `src/routes/api/webhooks/sendgrid.ts` |
| 2.3.5 | Implement unsubscribe handling | `src/routes/api/unsubscribe.ts` |
| 2.3.6 | Add email preview in compose UI | Update compose UI |

#### SendGrid Integration

```typescript
// src/channels/adapters/sendgrid.ts

import { ChannelAdapter, DeliveryResult } from '../types';

export class SendGridAdapter implements ChannelAdapter {
  readonly type = 'email';
  readonly name = 'SendGrid';

  private apiKey: string;
  private fromEmail: string;
  private fromName: string;

  async initialize(config: ChannelConfig): Promise<void> {
    this.apiKey = config.credentials.apiKey;
    this.fromEmail = config.options.fromEmail as string;
    this.fromName = config.options.fromName as string;
  }

  async send(formatted: FormattedMessage): Promise<DeliveryResult> {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: formatted.recipient }] }],
        from: { email: this.fromEmail, name: this.fromName },
        subject: formatted.subject,
        content: [
          { type: 'text/plain', value: formatted.plainText },
          { type: 'text/html', value: formatted.html }
        ]
      })
    });

    if (response.ok) {
      return {
        success: true,
        messageId: response.headers.get('X-Message-Id') || undefined
      };
    }

    const error = await response.json();
    return {
      success: false,
      error: error.errors?.[0]?.message || 'Unknown error',
      retryable: response.status >= 500 || response.status === 429
    };
  }

  getConstraints(): ChannelConstraints {
    return {
      maxLength: 100000,
      supportsMedia: true,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'application/pdf'],
      maxMediaSize: 25 * 1024 * 1024
    };
  }
}
```

#### Acceptance Criteria

- [ ] Emails sent via SendGrid API
- [ ] HTML and plain text versions sent
- [ ] Bounces update subscriber status
- [ ] Unsubscribe links work correctly
- [ ] Email preview shows in compose UI

---

### 2.4 SMS Adapter (Twilio)

**Priority**: High
**Effort**: 3-4 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 2.4.1 | Create Twilio adapter | `src/channels/adapters/twilio.ts` |
| 2.4.2 | Implement message segmentation | `src/channels/adapters/twilio.ts` |
| 2.4.3 | Add rate limiting | `src/channels/adapters/twilio.ts` |
| 2.4.4 | Handle delivery callbacks | `src/routes/api/webhooks/twilio.ts` |
| 2.4.5 | Implement opt-in via keyword | `src/routes/api/sms/inbound.ts` |
| 2.4.6 | Add SMS preview with char count | Update compose UI |

#### Twilio Integration

```typescript
// src/channels/adapters/twilio.ts

export class TwilioAdapter implements ChannelAdapter {
  readonly type = 'sms';
  readonly name = 'Twilio';

  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  async send(formatted: FormattedMessage): Promise<DeliveryResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${this.accountSid}:${this.authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        To: formatted.recipient,
        From: this.fromNumber,
        Body: formatted.content,
        StatusCallback: `${BASE_URL}/api/webhooks/twilio/status`
      })
    });

    const result = await response.json();

    if (response.ok) {
      return {
        success: true,
        messageId: result.sid
      };
    }

    return {
      success: false,
      error: result.message,
      retryable: result.code === 20429 // Rate limited
    };
  }

  getConstraints(): ChannelConstraints {
    return {
      maxLength: 160,
      supportsMedia: false,
      rateLimit: { requests: 100, windowSeconds: 60 }
    };
  }
}
```

#### Acceptance Criteria

- [ ] SMS sent via Twilio API
- [ ] Long messages show segment count
- [ ] Rate limiting prevents overages
- [ ] Delivery status tracked via callbacks
- [ ] Opt-in/opt-out via SMS keywords work

---

### 2.5 Twitter/X Adapter

**Priority**: High
**Effort**: 3-4 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 2.5.1 | Create Twitter adapter | `src/channels/adapters/twitter.ts` |
| 2.5.2 | Implement OAuth 2.0 authentication | `src/channels/adapters/twitter.ts` |
| 2.5.3 | Add media upload support | `src/channels/adapters/twitter.ts` |
| 2.5.4 | Implement thread creation | `src/channels/adapters/twitter.ts` |
| 2.5.5 | Add character count with URL handling | Update compose UI |
| 2.5.6 | Handle rate limiting | `src/channels/adapters/twitter.ts` |

#### Twitter API v2 Integration

```typescript
// src/channels/adapters/twitter.ts

export class TwitterAdapter implements ChannelAdapter {
  readonly type = 'twitter';
  readonly name = 'X (Twitter)';

  private bearerToken: string;

  async send(formatted: FormattedMessage): Promise<DeliveryResult> {
    // Upload media if present
    let mediaIds: string[] = [];
    if (formatted.media?.length) {
      mediaIds = await this.uploadMedia(formatted.media);
    }

    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.bearerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: formatted.content,
        ...(mediaIds.length && { media: { media_ids: mediaIds } }),
        ...(formatted.replyTo && { reply: { in_reply_to_tweet_id: formatted.replyTo } })
      })
    });

    const result = await response.json();

    if (response.ok) {
      return {
        success: true,
        messageId: result.data.id
      };
    }

    return {
      success: false,
      error: result.detail || result.title,
      retryable: response.status === 429
    };
  }

  getConstraints(): ChannelConstraints {
    return {
      maxLength: 280,
      supportsMedia: true,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
      maxMediaSize: 5 * 1024 * 1024,
      rateLimit: { requests: 300, windowSeconds: 900 }
    };
  }
}
```

#### Acceptance Criteria

- [ ] Tweets posted via Twitter API v2
- [ ] Images attached to tweets
- [ ] Long incidents create threads
- [ ] Character count accurate (URLs = 23 chars)
- [ ] Rate limits respected

---

### 2.6 Delivery Tracking

**Priority**: High
**Effort**: 2-3 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 2.6.1 | Update delivery status from callbacks | `src/server/deliveries.ts` |
| 2.6.2 | Implement delivery status webhooks | `src/routes/api/webhooks/` |
| 2.6.3 | Add real-time status updates (polling) | `src/hooks/use-delivery-status.ts` |
| 2.6.4 | Build delivery dashboard | `src/routes/messages/$messageId.tsx` |
| 2.6.5 | Add retry failed deliveries UI | `src/components/retry-delivery.tsx` |
| 2.6.6 | Create delivery analytics | `src/server/analytics.ts` |

#### Acceptance Criteria

- [ ] Delivery status updates from provider callbacks
- [ ] UI shows real-time delivery progress
- [ ] Failed deliveries can be manually retried
- [ ] Delivery success rate calculated per channel
- [ ] Analytics show delivery performance

---

### Phase 2 Deliverables

| Deliverable | Description |
|-------------|-------------|
| Channel framework | Adapter interface, manager, health checks |
| Queue system | Cloudflare Queues with retry/DLQ |
| Email channel | SendGrid integration with templates |
| SMS channel | Twilio integration with rate limiting |
| Twitter channel | API v2 with media and threads |
| Delivery tracking | Real-time status, analytics |

---

## Phase 3: Automation Engine

**Goal**: Rules-based automatic notifications

**Duration**: 2-3 weeks

**Prerequisites**: Phase 2 complete

### 3.1 Rule Management

**Priority**: High
**Effort**: 3-4 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 3.1.1 | Create automation rules CRUD API | `src/server/automation.ts` |
| 3.1.2 | Build rule list UI | `src/routes/automation/index.tsx` |
| 3.1.3 | Build rule editor UI | `src/routes/automation/$ruleId.tsx` |
| 3.1.4 | Create trigger configuration forms | `src/components/trigger-config.tsx` |
| 3.1.5 | Create action configuration forms | `src/components/action-config.tsx` |
| 3.1.6 | Add rule enable/disable toggle | Update UI |

#### Rule Editor UI Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                      AUTOMATION RULE EDITOR                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Rule Name: [_______________________]  Enabled: [✓]                 │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ WHEN (Trigger)                                               │   │
│  │                                                              │   │
│  │ Trigger Type: [Incident Status Changed ▼]                   │   │
│  │                                                              │   │
│  │ Configuration:                                               │   │
│  │   From Status: [ ] Draft [✓] Active [✓] Updated [ ] Resolved│   │
│  │   To Status:   [✓] Resolved                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ THEN (Actions)                                    [+ Add]    │   │
│  │                                                              │   │
│  │ ┌─────────────────────────────────────────────────────────┐ │   │
│  │ │ 1. Send Notification                              [🗑️]  │ │   │
│  │ │    Channels: [✓] Email [✓] SMS [ ] Push                 │ │   │
│  │ │    Template: [Service Restored ▼]                       │ │   │
│  │ └─────────────────────────────────────────────────────────┘ │   │
│  │                                                              │   │
│  │ ┌─────────────────────────────────────────────────────────┐ │   │
│  │ │ 2. Send Email                                     [🗑️]  │ │   │
│  │ │    To: admin@uta.org                                    │ │   │
│  │ │    Subject: Incident Resolved: {{incident_title}}       │ │   │
│  │ └─────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  [Test Rule]  [Save Draft]  [Save & Enable]                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### Acceptance Criteria

- [ ] CRUD operations for automation rules
- [ ] UI for creating/editing rules
- [ ] All trigger types configurable
- [ ] All action types configurable
- [ ] Rules can be enabled/disabled

---

### 3.2 Trigger Evaluation Engine

**Priority**: Critical
**Effort**: 4-5 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 3.2.1 | Create trigger evaluator interface | `src/automation/evaluators/types.ts` |
| 3.2.2 | Implement severity threshold evaluator | `src/automation/evaluators/severity.ts` |
| 3.2.3 | Implement status change evaluator | `src/automation/evaluators/status.ts` |
| 3.2.4 | Implement incident created evaluator | `src/automation/evaluators/created.ts` |
| 3.2.5 | Implement time elapsed evaluator | `src/automation/evaluators/elapsed.ts` |
| 3.2.6 | Create trigger dispatcher | `src/automation/dispatcher.ts` |
| 3.2.7 | Hook into incident lifecycle events | `src/server/incidents.ts` |

#### Trigger Evaluation Flow

```typescript
// src/automation/dispatcher.ts

export class AutomationDispatcher {
  private evaluators: Map<TriggerType, TriggerEvaluator>;

  async dispatchEvent(event: AutomationEvent): Promise<void> {
    // Get all enabled rules sorted by priority
    const rules = await this.getRulesForEvent(event.type);

    for (const rule of rules) {
      const evaluator = this.evaluators.get(rule.triggerType);

      if (!evaluator) continue;

      const shouldTrigger = await evaluator.evaluate(rule.triggerConfig, event);

      if (shouldTrigger) {
        await this.executeRule(rule, event);
      }
    }
  }

  private async executeRule(rule: AutomationRule, event: AutomationEvent): Promise<void> {
    const execution = await this.createExecution(rule.id, event);

    try {
      for (const action of rule.actions) {
        await this.executeAction(action, event, execution);
      }

      await this.completeExecution(execution.id, true);
    } catch (error) {
      await this.completeExecution(execution.id, false, error.message);
    }
  }
}
```

#### Acceptance Criteria

- [ ] Triggers evaluate on incident events
- [ ] Multiple rules can trigger on same event
- [ ] Priority determines execution order
- [ ] Failed triggers don't block others
- [ ] Execution history is recorded

---

### 3.3 Action Execution Engine

**Priority**: Critical
**Effort**: 3-4 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 3.3.1 | Create action executor interface | `src/automation/actions/types.ts` |
| 3.3.2 | Implement send notification action | `src/automation/actions/notify.ts` |
| 3.3.3 | Implement send email action | `src/automation/actions/email.ts` |
| 3.3.4 | Implement escalate action | `src/automation/actions/escalate.ts` |
| 3.3.5 | Implement update status action | `src/automation/actions/status.ts` |
| 3.3.6 | Implement webhook action | `src/automation/actions/webhook.ts` |
| 3.3.7 | Add action execution to dispatcher | `src/automation/dispatcher.ts` |

#### Action Executor Interface

```typescript
// src/automation/actions/types.ts

export interface ActionExecutor<T extends Action = Action> {
  readonly type: ActionType;

  execute(action: T, context: ActionContext): Promise<ActionResult>;
  validate(action: T): ValidationResult;
}

export interface ActionContext {
  incident: Incident;
  event: AutomationEvent;
  execution: AutomationExecution;
}

export interface ActionResult {
  success: boolean;
  output?: unknown;
  error?: string;
}
```

#### Acceptance Criteria

- [ ] All action types implemented
- [ ] Actions execute in sequence
- [ ] Action failures are recorded
- [ ] Webhook actions support custom headers
- [ ] Template variables resolved in actions

---

### 3.4 Scheduled Triggers

**Priority**: Medium
**Effort**: 2-3 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 3.4.1 | Create cron trigger evaluator | `src/automation/evaluators/schedule.ts` |
| 3.4.2 | Set up Cloudflare Cron Triggers | `wrangler.toml` |
| 3.4.3 | Create scheduled trigger worker | `src/workers/scheduled.ts` |
| 3.4.4 | Implement no-update timeout trigger | `src/automation/evaluators/timeout.ts` |
| 3.4.5 | Add cron expression builder UI | `src/components/cron-builder.tsx` |

#### Cron Trigger Configuration

```typescript
// wrangler.toml
[triggers]
crons = ["*/5 * * * *"]  # Every 5 minutes

// src/workers/scheduled.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    const dispatcher = new AutomationDispatcher(env);

    // Check scheduled rules
    await dispatcher.checkScheduledRules();

    // Check timeout rules
    await dispatcher.checkTimeoutRules();
  }
};
```

#### Acceptance Criteria

- [ ] Cron triggers execute on schedule
- [ ] Timeout triggers detect stale incidents
- [ ] Cron expression builder is user-friendly
- [ ] Scheduled executions are logged
- [ ] Timezone support for schedules

---

### 3.5 Rule Testing & Simulation

**Priority**: Medium
**Effort**: 2 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 3.5.1 | Create rule simulation endpoint | `src/server/automation.ts` |
| 3.5.2 | Build test UI with mock incident | `src/components/rule-tester.tsx` |
| 3.5.3 | Show which rules would trigger | Test UI |
| 3.5.4 | Show what actions would execute | Test UI |
| 3.5.5 | Add dry-run mode | `src/automation/dispatcher.ts` |

#### Acceptance Criteria

- [ ] Users can test rules without executing
- [ ] Simulation shows trigger evaluation result
- [ ] Simulation shows actions that would run
- [ ] Dry-run mode available for debugging
- [ ] Test with real or mock incident data

---

### Phase 3 Deliverables

| Deliverable | Description |
|-------------|-------------|
| Rule management | CRUD UI for automation rules |
| Trigger engine | Evaluators for all trigger types |
| Action engine | Executors for all action types |
| Scheduled triggers | Cron-based and timeout triggers |
| Testing tools | Rule simulation and dry-run |

---

## Phase 4: Advanced Channels

**Goal**: Full channel coverage including signage and GTFS

**Duration**: 3-4 weeks

**Prerequisites**: Phase 3 complete

### 4.1 Push Notifications (FCM)

**Priority**: High
**Effort**: 3-4 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 4.1.1 | Create FCM adapter | `src/channels/adapters/fcm.ts` |
| 4.1.2 | Implement topic-based routing | `src/channels/adapters/fcm.ts` |
| 4.1.3 | Handle token registration | `src/routes/api/push/register.ts` |
| 4.1.4 | Handle token refresh | `src/routes/api/push/refresh.ts` |
| 4.1.5 | Add push preview in compose UI | Update compose UI |
| 4.1.6 | Create push notification settings | Subscriber preferences |

#### FCM Topics Structure

```
Topics:
  /topics/all                    # All subscribers
  /topics/mode_rail              # Rail mode
  /topics/mode_bus               # Bus mode
  /topics/route_801              # Specific route
  /topics/severity_critical      # Critical alerts only
```

#### Acceptance Criteria

- [ ] Push notifications sent via FCM
- [ ] Topic-based subscription works
- [ ] Token registration/refresh handled
- [ ] Rich notifications with images
- [ ] Platform-specific formatting (iOS/Android)

---

### 4.2 Digital Signage Adapters

**Priority**: Medium
**Effort**: 5-6 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 4.2.1 | Create signage adapter interface | `src/channels/adapters/signage/types.ts` |
| 4.2.2 | Implement Penta WavWriter adapter | `src/channels/adapters/signage/penta.ts` |
| 4.2.3 | Implement Papercast adapter | `src/channels/adapters/signage/papercast.ts` |
| 4.2.4 | Implement Daktronics adapter | `src/channels/adapters/signage/daktronics.ts` |
| 4.2.5 | Add location-based targeting | `src/channels/adapters/signage/targeting.ts` |
| 4.2.6 | Create signage preview | `src/components/signage-preview.tsx` |
| 4.2.7 | Build signage management UI | `src/routes/admin/signage.tsx` |

#### Signage Message Format

```typescript
interface SignageMessage {
  id: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'emergency';
  duration: number;           // Seconds to display
  locations: string[];        // Target sign IDs or groups
  startTime?: string;
  endTime?: string;
  formatting?: {
    fontSize?: 'small' | 'medium' | 'large';
    scrollSpeed?: 'slow' | 'normal' | 'fast';
    alignment?: 'left' | 'center' | 'right';
  };
}
```

#### Acceptance Criteria

- [ ] Messages sent to Penta signs
- [ ] Messages sent to Papercast displays
- [ ] Location targeting works
- [ ] Priority override displays urgent messages
- [ ] Message duration controllable

---

### 4.3 GTFS-RT Service Alerts

**Priority**: Medium
**Effort**: 4-5 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 4.3.1 | Create GTFS-RT adapter | `src/channels/adapters/gtfs.ts` |
| 4.3.2 | Generate service alert feed | `src/gtfs/alerts.ts` |
| 4.3.3 | Map incidents to GTFS entities | `src/gtfs/mapper.ts` |
| 4.3.4 | Create GTFS-RT feed endpoint | `src/routes/api/gtfs/alerts.ts` |
| 4.3.5 | Add feed refresh mechanism | `src/gtfs/refresh.ts` |
| 4.3.6 | Build GTFS feed monitor UI | `src/routes/admin/gtfs.tsx` |

#### GTFS-RT Service Alert Structure

```protobuf
message Alert {
  repeated TimeRange active_period = 1;
  repeated EntitySelector informed_entity = 5;

  optional Cause cause = 6;
  optional Effect effect = 7;

  optional TranslatedString url = 8;
  optional TranslatedString header_text = 10;
  optional TranslatedString description_text = 11;
}
```

#### Entity Mapping

| Incident Field | GTFS Entity |
|----------------|-------------|
| affectedRoutes | informed_entity.route_id |
| affectedModes | informed_entity.route_type |
| geographicScope.stops | informed_entity.stop_id |
| severity | (mapped to effect) |
| incidentType | cause |

#### Acceptance Criteria

- [ ] GTFS-RT feed endpoint serves alerts
- [ ] Incidents mapped to GTFS entities
- [ ] Feed refreshes when incidents change
- [ ] Trip planners consume feed
- [ ] Feed validates against GTFS-RT spec

---

### 4.4 Website/CMS Integration

**Priority**: Low
**Effort**: 3-4 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 4.4.1 | Create website adapter | `src/channels/adapters/website.ts` |
| 4.4.2 | Implement CMS API integration | `src/channels/adapters/website.ts` |
| 4.4.3 | Create embeddable widget | `src/widgets/alerts.tsx` |
| 4.4.4 | Create alert banner component | `src/widgets/banner.tsx` |
| 4.4.5 | Add widget configuration UI | `src/routes/admin/widgets.tsx` |
| 4.4.6 | Document widget embed code | Documentation |

#### Widget Configuration

```typescript
interface WidgetConfig {
  type: 'banner' | 'list' | 'ticker';
  filters: {
    routes?: string[];
    modes?: string[];
    minSeverity?: Severity;
  };
  display: {
    maxItems: number;
    refreshInterval: number;  // Seconds
    showTimestamp: boolean;
    compact: boolean;
  };
  styling: {
    theme: 'light' | 'dark' | 'auto';
    customCss?: string;
  };
}
```

#### Acceptance Criteria

- [ ] Website receives incident updates
- [ ] Embeddable widget available
- [ ] Widget configurable per route/mode
- [ ] Widget auto-refreshes
- [ ] Multiple widget styles available

---

### Phase 4 Deliverables

| Deliverable | Description |
|-------------|-------------|
| Push notifications | FCM integration with topics |
| Signage adapters | Penta, Papercast, Daktronics |
| GTFS-RT feed | Service alerts for trip planners |
| Website widgets | Embeddable alert components |

---

## Phase 5: Enterprise Features

**Goal**: Production-ready for UTA deployment

**Duration**: 3-4 weeks

**Prerequisites**: Phase 4 complete

### 5.1 SSO Integration

**Priority**: Critical
**Effort**: 4-5 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 5.1.1 | Create OAuth2 provider interface | `src/auth/providers/types.ts` |
| 5.1.2 | Implement Azure AD provider | `src/auth/providers/azure-ad.ts` |
| 5.1.3 | Implement Okta provider | `src/auth/providers/okta.ts` |
| 5.1.4 | Add SAML support (optional) | `src/auth/providers/saml.ts` |
| 5.1.5 | Create login flow UI | `src/routes/auth/login.tsx` |
| 5.1.6 | Handle callback and token exchange | `src/routes/auth/callback.tsx` |
| 5.1.7 | Implement session management | `src/auth/session.ts` |
| 5.1.8 | Add SSO configuration UI | `src/routes/admin/auth.tsx` |

#### Azure AD Configuration

```typescript
interface AzureADConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

// OAuth2 flow
const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`;
const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
```

#### Acceptance Criteria

- [ ] Users authenticate via SSO
- [ ] Azure AD integration works
- [ ] Okta integration works
- [ ] Sessions managed securely
- [ ] SSO can be configured by admins

---

### 5.2 MFA Support

**Priority**: High
**Effort**: 2-3 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 5.2.1 | Add MFA requirement by role | `src/auth/mfa.ts` |
| 5.2.2 | Implement TOTP support | `src/auth/mfa/totp.ts` |
| 5.2.3 | Create MFA setup UI | `src/routes/auth/mfa/setup.tsx` |
| 5.2.4 | Create MFA verification UI | `src/routes/auth/mfa/verify.tsx` |
| 5.2.5 | Add backup codes | `src/auth/mfa/backup.ts` |
| 5.2.6 | Handle MFA recovery | `src/routes/auth/mfa/recovery.tsx` |

#### Acceptance Criteria

- [ ] MFA enforced for admin role
- [ ] TOTP apps (Google Auth, etc.) work
- [ ] Backup codes available
- [ ] MFA recovery process exists
- [ ] MFA can be required per role

---

### 5.3 Advanced Reporting

**Priority**: Medium
**Effort**: 4-5 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 5.3.1 | Create reporting service | `src/server/reports.ts` |
| 5.3.2 | Build incident frequency report | `src/routes/reports/incidents.tsx` |
| 5.3.3 | Build response time report | `src/routes/reports/response-times.tsx` |
| 5.3.4 | Build channel effectiveness report | `src/routes/reports/channels.tsx` |
| 5.3.5 | Build subscriber growth report | `src/routes/reports/subscribers.tsx` |
| 5.3.6 | Add report export (CSV, JSON) | `src/server/reports.ts` |
| 5.3.7 | Create report scheduler | `src/workers/reports.ts` |

#### Report Types

```typescript
interface ReportConfig {
  type: 'incident_frequency' | 'response_time' | 'channel_effectiveness' | 'subscriber_growth';
  dateRange: {
    start: string;
    end: string;
  };
  groupBy: 'day' | 'week' | 'month';
  filters: {
    incidentTypes?: string[];
    modes?: string[];
    routes?: string[];
    channels?: string[];
  };
  format: 'json' | 'csv' | 'pdf';
}
```

#### Acceptance Criteria

- [ ] Incident frequency reports available
- [ ] Response time metrics calculated
- [ ] Channel delivery rates shown
- [ ] Reports exportable
- [ ] Scheduled report delivery works

---

### 5.4 Subscriber Import/Export

**Priority**: Medium
**Effort**: 2-3 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 5.4.1 | Create CSV import parser | `src/server/subscribers/import.ts` |
| 5.4.2 | Add import validation | `src/server/subscribers/import.ts` |
| 5.4.3 | Build import UI with preview | `src/routes/subscribers/import.tsx` |
| 5.4.4 | Create export functionality | `src/server/subscribers/export.ts` |
| 5.4.5 | Add export UI with filters | `src/routes/subscribers/export.tsx` |
| 5.4.6 | Handle large imports (batching) | `src/server/subscribers/import.ts` |

#### Import CSV Format

```csv
email,phone,language,routes,modes
user@example.com,+18015551234,en,"801,802",rail
another@example.com,,es,all,bus
```

#### Acceptance Criteria

- [ ] CSV import with validation
- [ ] Import preview before commit
- [ ] Error rows identified
- [ ] Export with configurable filters
- [ ] Large imports handled via batching

---

### 5.5 Multi-Language Support

**Priority**: Low
**Effort**: 3-4 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 5.5.1 | Create i18n framework | `src/lib/i18n.ts` |
| 5.5.2 | Extract UI strings | `src/locales/en.json` |
| 5.5.3 | Add Spanish translations | `src/locales/es.json` |
| 5.5.4 | Implement language switching | `src/components/language-switcher.tsx` |
| 5.5.5 | Add multi-language templates | Template system |
| 5.5.6 | Send messages in subscriber's language | Message orchestration |

#### Acceptance Criteria

- [ ] UI available in English and Spanish
- [ ] Subscribers receive messages in preferred language
- [ ] Templates support multiple languages
- [ ] Language can be switched in UI
- [ ] New languages can be added

---

### Phase 5 Deliverables

| Deliverable | Description |
|-------------|-------------|
| SSO | Azure AD and Okta integration |
| MFA | TOTP with backup codes |
| Reports | Comprehensive analytics |
| Import/Export | Bulk subscriber operations |
| Multi-language | English and Spanish support |

---

## Phase 6: Optimization & Hardening

**Goal**: Performance, reliability, and production readiness

**Duration**: 2-3 weeks

**Prerequisites**: Phase 5 complete

### 6.1 Performance Optimization

**Priority**: High
**Effort**: 3-4 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 6.1.1 | Add database query optimization | Review all queries |
| 6.1.2 | Implement response caching (KV) | `src/lib/cache.ts` |
| 6.1.3 | Add lazy loading for lists | UI components |
| 6.1.4 | Optimize bundle size | Build config |
| 6.1.5 | Add pagination to all lists | Server functions |
| 6.1.6 | Profile and fix slow endpoints | Performance testing |

#### Caching Strategy

```typescript
// src/lib/cache.ts

export class Cache {
  constructor(private kv: KVNamespace) {}

  async get<T>(key: string): Promise<T | null> {
    const cached = await this.kv.get(key, 'json');
    return cached as T | null;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.kv.put(key, JSON.stringify(value), {
      expirationTtl: ttlSeconds
    });
  }

  async invalidate(pattern: string): Promise<void> {
    // Invalidate all keys matching pattern
    const list = await this.kv.list({ prefix: pattern });
    await Promise.all(list.keys.map(k => this.kv.delete(k.name)));
  }
}

// Cache TTLs
const CACHE_TTL = {
  incidents_list: 30,        // 30 seconds
  incident_detail: 60,       // 1 minute
  settings: 300,             // 5 minutes
  uta_routes: 3600,          // 1 hour
  templates: 300,            // 5 minutes
};
```

#### Acceptance Criteria

- [ ] Page load time < 2 seconds
- [ ] API response time < 500ms (p95)
- [ ] Bundle size < 500KB
- [ ] All lists paginated
- [ ] Caching reduces database load

---

### 6.2 Load Testing

**Priority**: High
**Effort**: 2-3 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 6.2.1 | Set up load testing tool (k6) | `tests/load/` |
| 6.2.2 | Create incident creation test | `tests/load/incidents.ts` |
| 6.2.3 | Create message delivery test | `tests/load/messages.ts` |
| 6.2.4 | Create concurrent user test | `tests/load/users.ts` |
| 6.2.5 | Document performance baselines | `docs/performance.md` |
| 6.2.6 | Fix identified bottlenecks | Various |

#### Load Test Scenarios

```javascript
// tests/load/scenarios.js

export const scenarios = {
  // Normal operation
  normal: {
    executor: 'constant-vus',
    vus: 10,
    duration: '5m',
  },

  // Peak load (major incident)
  peak: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 50 },
      { duration: '5m', target: 50 },
      { duration: '2m', target: 0 },
    ],
  },

  // Stress test
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '2m', target: 0 },
    ],
  },
};
```

#### Acceptance Criteria

- [ ] System handles 50 concurrent users
- [ ] 1000 messages delivered in < 60 seconds
- [ ] No errors under normal load
- [ ] Graceful degradation under stress
- [ ] Performance baselines documented

---

### 6.3 Disaster Recovery

**Priority**: High
**Effort**: 2-3 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 6.3.1 | Create database backup script | `scripts/backup.ts` |
| 6.3.2 | Create restore procedure | `scripts/restore.ts` |
| 6.3.3 | Test backup/restore process | Manual testing |
| 6.3.4 | Document DR procedures | `docs/disaster-recovery.md` |
| 6.3.5 | Set up automated backups | Cloudflare Cron |
| 6.3.6 | Create health check endpoint | `src/routes/api/health.ts` |

#### Backup Strategy

```typescript
// Backup schedule
Daily: Full D1 database backup to R2
Weekly: Full export to external storage
Monthly: Archive old audit logs

// Recovery Time Objectives
RPO: 24 hours (max data loss)
RTO: 4 hours (max downtime)
```

#### Acceptance Criteria

- [ ] Daily automated backups
- [ ] Restore tested successfully
- [ ] DR procedures documented
- [ ] Health check endpoint works
- [ ] Backup retention policy defined

---

### 6.4 Security Hardening

**Priority**: Critical
**Effort**: 2-3 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 6.4.1 | Security audit of all endpoints | Manual review |
| 6.4.2 | Add rate limiting to all APIs | `src/middleware/rate-limit.ts` |
| 6.4.3 | Implement CSRF protection | `src/middleware/csrf.ts` |
| 6.4.4 | Add security headers | `src/middleware/headers.ts` |
| 6.4.5 | Review and rotate secrets | Manual process |
| 6.4.6 | Penetration testing | External/manual |

#### Security Headers

```typescript
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
```

#### Acceptance Criteria

- [ ] All endpoints require authentication
- [ ] Rate limiting prevents abuse
- [ ] Security headers configured
- [ ] No high/critical vulnerabilities
- [ ] Secrets rotated and secure

---

### 6.5 Documentation

**Priority**: Medium
**Effort**: 2-3 days

#### Tasks

| Task | Description | File(s) |
|------|-------------|---------|
| 6.5.1 | Complete API documentation | `docs/api/` |
| 6.5.2 | Write user guide | `docs/user-guide.md` |
| 6.5.3 | Write admin guide | `docs/admin-guide.md` |
| 6.5.4 | Create runbook for operations | `docs/runbook.md` |
| 6.5.5 | Document deployment process | `docs/deployment.md` |
| 6.5.6 | Create troubleshooting guide | `docs/troubleshooting.md` |

#### Documentation Structure

```
docs/
├── api/
│   ├── incidents.md
│   ├── messages.md
│   ├── subscribers.md
│   └── webhooks.md
├── user-guide.md
├── admin-guide.md
├── runbook.md
├── deployment.md
├── disaster-recovery.md
├── troubleshooting.md
└── performance.md
```

#### Acceptance Criteria

- [ ] API fully documented
- [ ] User guide covers all features
- [ ] Admin guide covers configuration
- [ ] Runbook ready for operations
- [ ] Troubleshooting guide complete

---

### Phase 6 Deliverables

| Deliverable | Description |
|-------------|-------------|
| Performance | Optimized, cached, fast |
| Load tested | Verified under stress |
| DR ready | Backups, restore, procedures |
| Hardened | Security audit complete |
| Documented | Comprehensive docs |

---

## Appendix: Task Tracking Template

Use this template to track progress in each phase:

```markdown
## Phase X: [Name]

### Sprint 1 (Week X-Y)

| Task | Assignee | Status | Notes |
|------|----------|--------|-------|
| X.1.1 | - | ⬜ Not Started | |
| X.1.2 | - | 🔄 In Progress | |
| X.1.3 | - | ✅ Complete | |
| X.1.4 | - | ❌ Blocked | Waiting on... |

### Blockers
- [ ] Blocker description

### Risks
- Risk description (mitigation)

### Decisions Made
- Decision and rationale
```

---

## Appendix: Definition of Done

A feature is considered "done" when:

1. **Code Complete**
   - [ ] Implementation matches requirements
   - [ ] Code follows project conventions
   - [ ] No console errors or warnings

2. **Tested**
   - [ ] Unit tests written and passing
   - [ ] Integration tests where applicable
   - [ ] Manual testing completed

3. **Reviewed**
   - [ ] Code review completed
   - [ ] Feedback addressed

4. **Documented**
   - [ ] Code comments where needed
   - [ ] API documentation updated
   - [ ] User-facing docs updated (if applicable)

5. **Deployed**
   - [ ] Deployed to staging
   - [ ] Smoke tested in staging
   - [ ] Ready for production

---

*This plan should be reviewed and updated at the start of each phase.*
