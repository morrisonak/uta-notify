# UTA Notify - Architecture & Implementation Plan

> **Version**: 1.0.0
> **Last Updated**: 2026-01-15
> **Status**: Active Development

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Core Design Principles](#2-core-design-principles)
3. [Technical Architecture](#3-technical-architecture)
4. [Domain Model](#4-domain-model)
5. [Incident Management](#5-incident-management)
6. [Communication Orchestration](#6-communication-orchestration)
7. [Channel Adapters](#7-channel-adapters)
8. [Automation Engine](#8-automation-engine)
9. [User Management & Access Control](#9-user-management--access-control)
10. [Subscriber Management](#10-subscriber-management)
11. [Audit & Compliance](#11-audit--compliance)
12. [Reporting & Analytics](#12-reporting--analytics)
13. [API Design](#13-api-design)
14. [Security Architecture](#14-security-architecture)
15. [Infrastructure & Deployment](#15-infrastructure--deployment)
16. [Implementation Status](#16-implementation-status)
17. [Development Roadmap](#17-development-roadmap)

---

## 1. System Overview

### 1.1 Purpose

UTA Notify is a centralized, resilient, real-time system for creating, managing, and distributing public-facing transit incident communications across multiple external channels from a single authoritative source of truth.

### 1.2 Primary Users

- **Incident Communications Specialists (ICS)** - Primary operators in time-critical environments
- **System Administrators** - Platform configuration and user management
- **Transit Operations** - Monitoring and reporting
- **Public Subscribers** - Receive notifications via email, SMS, push

### 1.3 Key Capabilities

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          UTA NOTIFY PLATFORM                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   Incident   │───▶│   Message    │───▶│   Channel    │              │
│  │  Management  │    │ Orchestrator │    │   Adapters   │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│         │                   │                    │                      │
│         ▼                   ▼                    ▼                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │  Automation  │    │  Templates   │    │  Subscribers │              │
│  │    Engine    │    │    System    │    │  Management  │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
         ┌──────────────────────────────────────────────────┐
         │              EXTERNAL CHANNELS                    │
         ├──────┬──────┬──────┬──────┬──────┬──────┬───────┤
         │  X   │Email │ SMS  │ Push │Signs │ GTFS │Website│
         └──────┴──────┴──────┴──────┴──────┴──────┴───────┘
```

---

## 2. Core Design Principles

| Principle | Description | Implementation |
|-----------|-------------|----------------|
| **Single Source of Truth** | All incident data managed centrally | D1 database with versioned incidents |
| **Channel-Agnostic** | Write once, publish to many channels | Message orchestrator with adapters |
| **Configuration over Customization** | Behavior driven by config, not code | Database-driven settings |
| **API-First** | All functionality exposed via APIs | REST APIs with TanStack Server Functions |
| **High Availability** | No single point of failure | Cloudflare Workers global distribution |
| **Full Auditability** | Every action logged and traceable | Comprehensive audit log system |
| **Security-First** | Least-privilege access by default | RBAC with granular permissions |
| **No Hard Dependencies** | Graceful degradation if channels fail | Independent async delivery per channel |

---

## 3. Technical Architecture

### 3.1 Architecture Style

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE EDGE NETWORK                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   CLOUDFLARE WORKERS                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │  TanStack   │  │   Server    │  │   Cron      │     │   │
│  │  │   Start     │  │  Functions  │  │  Triggers   │     │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌───────────────────────────┼───────────────────────────────┐  │
│  │                    DATA LAYER                              │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │  │
│  │  │   D1    │  │   R2    │  │   KV    │  │  Queues │     │  │
│  │  │ (SQLite)│  │ (Files) │  │ (Cache) │  │(Messages)│     │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Runtime** | Bun | JavaScript runtime, testing, package management |
| **Framework** | TanStack Start | Full-stack React framework with SSR |
| **Routing** | TanStack Router | File-based routing with type safety |
| **Database** | Cloudflare D1 | SQLite at the edge |
| **File Storage** | Cloudflare R2 | Attachments, media |
| **Cache** | Cloudflare KV | Session data, rate limiting |
| **Queues** | Cloudflare Queues | Async message delivery |
| **Validation** | Zod | Schema validation |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Icons** | Lucide React | Icon library |

### 3.3 Environment Separation

| Environment | Purpose | Database | Notes |
|-------------|---------|----------|-------|
| **Production** | Live system | D1 prod binding | Real channel delivery |
| **Staging** | Pre-release testing | D1 staging binding | Test channel endpoints |
| **Development** | Local development | Local SQLite | Mock auth, seeded data |
| **Training** | User training | Isolated D1 | No live data, sandboxed |

---

## 4. Domain Model

### 4.1 Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    Users     │       │  Incidents   │       │  Messages    │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id           │◄──────│ created_by   │       │ id           │
│ email        │       │ id           │◄──────│ incident_id  │
│ name         │       │ title        │       │ content      │
│ role         │       │ status       │       │ created_by   │──┐
│ permissions  │       │ severity     │       │ created_at   │  │
└──────────────┘       │ type         │       └──────────────┘  │
                       │ version      │              │           │
                       └──────────────┘              ▼           │
                              │            ┌──────────────┐      │
                              │            │  Deliveries  │      │
                              │            ├──────────────┤      │
                              │            │ id           │      │
                              │            │ message_id   │      │
                              │            │ channel_id   │      │
                              │            │ status       │      │
                              │            │ sent_at      │      │
                              │            └──────────────┘      │
                              │                                  │
┌──────────────┐              │            ┌──────────────┐      │
│  Subscribers │              │            │   Channels   │      │
├──────────────┤              │            ├──────────────┤      │
│ id           │              │            │ id           │      │
│ email        │              │            │ type         │      │
│ phone        │              │            │ name         │      │
│ preferences  │──────────────┼───────────▶│ config       │      │
│ status       │              │            │ enabled      │      │
└──────────────┘              │            └──────────────┘      │
                              │                                  │
┌──────────────┐              │            ┌──────────────┐      │
│  Templates   │◄─────────────┘            │  Automation  │      │
├──────────────┤                           ├──────────────┤      │
│ id           │                           │ id           │      │
│ name         │                           │ trigger_type │      │
│ content      │◄──────────────────────────│ actions      │      │
│ incident_type│                           │ enabled      │◄─────┘
│ channel_type │                           └──────────────┘
└──────────────┘
```

### 4.2 Domain Schemas Location

All domain schemas are defined in `core/domain/`:

```
core/domain/
├── incidents/
│   └── incident.schema.ts      # Incident types, statuses, validation
├── messages/
│   └── message.schema.ts       # Messages, deliveries, channels
├── subscribers/
│   └── subscriber.schema.ts    # Subscriber preferences, targeting
├── templates/
│   └── template.schema.ts      # Message templates, parameters
├── auth/
│   └── auth.schema.ts          # Users, roles, permissions
└── automation/
    └── automation.schema.ts    # Rules, triggers, actions
```

---

## 5. Incident Management

### 5.1 Incident Object Model

```typescript
interface Incident {
  // Identity
  id: string;                    // UUID, immutable
  incidentNumber: number;        // Sequential, human-readable

  // Classification
  incidentType: string;          // delay, detour, suspension, etc.
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'draft' | 'active' | 'updated' | 'resolved' | 'archived';
  tags: string[];                // Additional categorization

  // Scope
  affectedModes: string[];       // rail, bus, streetcar, etc.
  affectedRoutes: string[];      // Route IDs
  geographicScope: {
    stops?: string[];
    stations?: string[];
    polygon?: [number, number][];
  };

  // Timing
  startTime: string | null;
  estimatedResolution: string | null;
  actualResolution: string | null;

  // Content
  title: string;                 // Required, max 200 chars
  publicMessage: string | null;  // Subscriber-facing, max 2000 chars
  internalNotes: string | null;  // Staff-only, max 5000 chars

  // Versioning
  currentVersion: number;

  // Audit
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  archivedAt: string | null;
}
```

### 5.2 Incident Lifecycle

```
                    ┌──────────────────────────────────────────┐
                    │           INCIDENT LIFECYCLE              │
                    └──────────────────────────────────────────┘

    ┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐
    │  DRAFT  │─────▶│ ACTIVE  │─────▶│ UPDATED │─────▶│RESOLVED │
    └─────────┘      └─────────┘      └─────────┘      └─────────┘
         │                │                │                │
         │                │                │                ▼
         │                │                │          ┌─────────┐
         │                │                └─────────▶│ARCHIVED │
         │                │                           └─────────┘
         │                │                                ▲
         │                └────────────────────────────────┘
         │                        (can reactivate)
         ▼
    [DELETED - draft only]

    Transitions must be:
    ✓ Logged with timestamp
    ✓ Attributed to user or automation
    ✓ Version incremented
    ✓ Audit trail created
```

### 5.3 Status Transitions

| From | To | Trigger | Actions |
|------|-----|---------|---------|
| draft | active | Publish | Create version, send notifications |
| active | updated | Edit + Save | Increment version, optional re-notify |
| active | resolved | Resolve | Set resolution time, notify closure |
| updated | resolved | Resolve | Set resolution time, notify closure |
| resolved | active | Reactivate | New version, notify reopening |
| resolved | archived | Archive | Set archive time |

### 5.4 Incident Types (Configurable)

| Type ID | Label | Default Severity |
|---------|-------|------------------|
| `type_delay` | Service Delay | medium |
| `type_detour` | Route Detour | medium |
| `type_suspension` | Service Suspension | high |
| `type_accident` | Accident/Collision | high |
| `type_weather` | Weather Related | medium |
| `type_maintenance` | Planned Maintenance | low |
| `type_security` | Security Incident | critical |
| `type_other` | Other | low |

---

## 6. Communication Orchestration

### 6.1 Message Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MESSAGE ORCHESTRATION FLOW                        │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │   Incident   │
  │   Updated    │
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐     ┌──────────────┐
  │   Template   │────▶│   Compose    │
  │   Selection  │     │   Message    │
  └──────────────┘     └──────┬───────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │   Channel    │     │   Channel    │     │   Channel    │
  │  Formatter   │     │  Formatter   │     │  Formatter   │
  │   (Twitter)  │     │   (Email)    │     │    (SMS)     │
  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
         │                    │                    │
         ▼                    ▼                    ▼
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │   Preview    │     │   Preview    │     │   Preview    │
  │  Validation  │     │  Validation  │     │  Validation  │
  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │   Message    │
                       │    Queue     │
                       └──────┬───────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │   Twitter    │     │    Email     │     │     SMS      │
  │   Adapter    │     │   Adapter    │     │   Adapter    │
  └──────────────┘     └──────────────┘     └──────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │  Delivery    │     │  Delivery    │     │  Delivery    │
  │   Tracking   │     │   Tracking   │     │   Tracking   │
  └──────────────┘     └──────────────┘     └──────────────┘
```

### 6.2 Message Composition Interface

The composition interface provides:

- **Single Editor**: Write message once
- **Live Previews**: See formatted output per channel
- **Character Counts**: Per-channel limits displayed
- **Validation**: Errors/warnings before send
- **Template Selection**: Quick-fill from templates
- **Media Attachments**: Where channels support

### 6.3 Fan-Out Engine Requirements

| Requirement | Implementation |
|-------------|----------------|
| Independent delivery | Cloudflare Queues per channel |
| Async processing | Worker-based consumers |
| Failure isolation | Channel failure doesn't block others |
| Retry logic | Exponential backoff (1s, 2s, 4s, 8s, max 5 retries) |
| Dead-letter queue | Failed messages stored for review |
| Rate limiting | Per-channel configurable limits |

---

## 7. Channel Adapters

### 7.1 Channel Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CHANNEL ADAPTER PATTERN                         │
└─────────────────────────────────────────────────────────────────────┘

                         ┌──────────────────┐
                         │ Channel Manager  │
                         │   (Singleton)    │
                         └────────┬─────────┘
                                  │
           ┌──────────────────────┼──────────────────────┐
           │                      │                      │
           ▼                      ▼                      ▼
    ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
    │   Adapter   │       │   Adapter   │       │   Adapter   │
    │  Interface  │       │  Interface  │       │  Interface  │
    └─────────────┘       └─────────────┘       └─────────────┘
           │                      │                      │
           ▼                      ▼                      ▼
    ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
    │  Twitter    │       │   Twilio    │       │  SendGrid   │
    │   Impl      │       │    Impl     │       │    Impl     │
    └─────────────┘       └─────────────┘       └─────────────┘

interface ChannelAdapter {
  type: ChannelType;
  name: string;

  // Lifecycle
  initialize(config: Record<string, unknown>): Promise<void>;
  healthCheck(): Promise<HealthStatus>;

  // Formatting
  formatMessage(message: Message, incident: Incident): FormattedMessage;
  validateMessage(formatted: FormattedMessage): ValidationResult;

  // Delivery
  send(formatted: FormattedMessage): Promise<DeliveryResult>;

  // Constraints
  getConstraints(): ChannelConstraints;
}
```

### 7.2 Supported Channels

#### 7.2.1 Social Media - Twitter/X

| Property | Value |
|----------|-------|
| Type | `twitter` |
| Max Length | 280 characters |
| Media Support | Images (JPEG, PNG, GIF), Video (MP4) |
| Max Media Size | 5MB images, 512MB video |
| Rate Limit | 300 posts / 15 minutes |
| Threading | Supported |
| Provider | Twitter API v2 |

#### 7.2.2 Email

| Property | Value |
|----------|-------|
| Type | `email` |
| Max Length | 100,000 characters |
| Media Support | Inline images, attachments |
| Formats | HTML + Plain text |
| Provider | SendGrid, SES, or SMTP |
| Features | Distribution lists, templates |

#### 7.2.3 SMS

| Property | Value |
|----------|-------|
| Type | `sms` |
| Max Length | 160 characters (single segment) |
| Media Support | None |
| Rate Limit | 100 messages / minute |
| Provider | Twilio |
| Features | Opt-in management, rate limiting |

#### 7.2.4 Push Notifications

| Property | Value |
|----------|-------|
| Type | `push` |
| Max Length | 178 characters (iOS limit) |
| Media Support | Images (1MB) |
| Platforms | iOS, Android, Web |
| Provider | Firebase Cloud Messaging |
| Features | Topic-based routing |

#### 7.2.5 Digital Signage

| Property | Value |
|----------|-------|
| Type | `signage` |
| Max Length | 500 characters (device-dependent) |
| Media Support | None |
| Supported Systems | Penta WavWriter, Papercast, Daktronics |
| Features | Location targeting, priority override |

#### 7.2.6 GTFS/Trip Planners

| Property | Value |
|----------|-------|
| Type | `gtfs` |
| Max Length | 5,000 characters |
| Output Format | GTFS-RT Service Alerts |
| Consumers | Google Maps, Apple Maps, Transit App |
| Features | Route/stop association |

#### 7.2.7 Website

| Property | Value |
|----------|-------|
| Type | `website` |
| Max Length | 10,000 characters |
| Media Support | Images (10MB) |
| Integration | CMS API (Sitecore) |
| Features | Widgets, banners, route pages |

### 7.3 Channel Constraints Reference

```typescript
const DefaultChannelConstraints: Record<ChannelType, ChannelConstraints> = {
  twitter: {
    maxLength: 280,
    supportsMedia: true,
    supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
    maxMediaSize: 5 * 1024 * 1024,
    rateLimit: { requests: 300, windowSeconds: 900 },
  },
  email: {
    maxLength: 100000,
    supportsMedia: true,
    supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    maxMediaSize: 25 * 1024 * 1024,
  },
  sms: {
    maxLength: 160,
    supportsMedia: false,
    rateLimit: { requests: 100, windowSeconds: 60 },
  },
  push: {
    maxLength: 178,
    supportsMedia: true,
    supportedMediaTypes: ['image/jpeg', 'image/png'],
    maxMediaSize: 1024 * 1024,
  },
  signage: {
    maxLength: 500,
    supportsMedia: false,
  },
  gtfs: {
    maxLength: 5000,
    supportsMedia: false,
  },
  website: {
    maxLength: 10000,
    supportsMedia: true,
    supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxMediaSize: 10 * 1024 * 1024,
  },
};
```

---

## 8. Automation Engine

### 8.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      AUTOMATION ENGINE                               │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────┐
  │                         EVENT SOURCES                             │
  ├─────────────┬─────────────┬─────────────┬─────────────┬─────────┤
  │  Incident   │  Schedule   │   Timer     │  External   │ Manual  │
  │   Events    │   (Cron)    │  Elapsed    │  Webhook    │ Trigger │
  └──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴────┬────┘
         │             │             │             │           │
         └─────────────┴─────────────┴─────────────┴───────────┘
                                    │
                                    ▼
                         ┌──────────────────┐
                         │  Rule Evaluator  │
                         │  (Priority Sort) │
                         └────────┬─────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
             ┌─────────────┐             ┌─────────────┐
             │  Condition  │             │   Action    │
             │   Checker   │────────────▶│  Executor   │
             └─────────────┘             └─────────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────┐
                    │                          │                      │
                    ▼                          ▼                      ▼
             ┌─────────────┐            ┌─────────────┐        ┌─────────────┐
             │    Send     │            │   Update    │        │   Call      │
             │  Notification│            │   Status    │        │  Webhook    │
             └─────────────┘            └─────────────┘        └─────────────┘
```

### 8.2 Trigger Types

| Trigger | Description | Configuration |
|---------|-------------|---------------|
| `severity_threshold` | When severity >= threshold | `minSeverity`, `modes`, `routes` |
| `delay_duration` | When delay exceeds duration | `minMinutes`, `modes`, `routes` |
| `incident_created` | When incident is created | `incidentTypes`, `severities`, `modes` |
| `incident_status_changed` | When status changes | `fromStatus`, `toStatus` |
| `schedule` | Cron-based schedule | `cron`, `timezone` |
| `time_elapsed` | Time since event | `minutes`, `fromEvent`, `onlyStatus` |
| `no_update_timeout` | No updates for X minutes | `minutes`, `onlyStatus`, `severities` |

### 8.3 Action Types

| Action | Description | Configuration |
|--------|-------------|---------------|
| `send_notification` | Send to channels | `channels`, `templateId`, `targetSubscribers` |
| `send_email` | Send specific email | `to`, `templateId`, `subject`, `body` |
| `escalate` | Notify users/roles | `userIds`, `roles`, `message`, `channels` |
| `update_status` | Change incident status | `newStatus`, `reason` |
| `add_tag` | Add tags to incident | `tags` |
| `webhook` | Call external URL | `url`, `method`, `headers` |

### 8.4 Example Rules

```typescript
// Auto-SMS for delays > 15 minutes
{
  name: "Auto SMS - Long Delay",
  triggerType: "delay_duration",
  triggerConfig: {
    minMinutes: 15,
    modes: ["rail", "bus"]
  },
  actions: [{
    type: "send_notification",
    channels: ["sms"],
    targetSubscribers: true
  }]
}

// Rail disruption → signage + trip planner
{
  name: "Rail Disruption - Full Alert",
  triggerType: "incident_created",
  triggerConfig: {
    incidentTypes: ["type_suspension", "type_accident"],
    modes: ["rail"]
  },
  actions: [
    { type: "send_notification", channels: ["signage", "gtfs"] },
    { type: "escalate", roles: ["admin"], message: "Rail disruption created" }
  ]
}

// Auto-notify on incident closure
{
  name: "Closure Notification",
  triggerType: "incident_status_changed",
  triggerConfig: {
    toStatus: ["resolved"]
  },
  actions: [{
    type: "send_notification",
    channels: ["email", "sms", "push"],
    templateId: "template_resolved"
  }]
}
```

---

## 9. User Management & Access Control

### 9.1 Role Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ROLE HIERARCHY                                │
└─────────────────────────────────────────────────────────────────────┘

                          ┌─────────────┐
                          │   ADMIN     │  Full system access
                          └──────┬──────┘
                                 │
                          ┌──────┴──────┐
                          │   EDITOR    │  Content management
                          └──────┬──────┘
                                 │
                          ┌──────┴──────┐
                          │  OPERATOR   │  Incident operations
                          └──────┬──────┘
                                 │
                          ┌──────┴──────┐
                          │   VIEWER    │  Read-only access
                          └─────────────┘
```

### 9.2 Permission Matrix

| Permission | Admin | Editor | Operator | Viewer |
|------------|:-----:|:------:|:--------:|:------:|
| incidents.create | ✓ | ✓ | ✓ | |
| incidents.read | ✓ | ✓ | ✓ | ✓ |
| incidents.update | ✓ | ✓ | ✓ | |
| incidents.delete | ✓ | | | |
| incidents.publish | ✓ | ✓ | ✓ | |
| incidents.resolve | ✓ | ✓ | ✓ | |
| incidents.archive | ✓ | | | |
| messages.create | ✓ | ✓ | ✓ | |
| messages.read | ✓ | ✓ | ✓ | ✓ |
| messages.send | ✓ | ✓ | ✓ | |
| templates.create | ✓ | ✓ | | |
| templates.read | ✓ | ✓ | ✓ | ✓ |
| templates.update | ✓ | ✓ | | |
| templates.delete | ✓ | | | |
| subscribers.read | ✓ | ✓ | ✓ | ✓ |
| subscribers.manage | ✓ | | | |
| subscribers.export | ✓ | | | |
| automation.read | ✓ | ✓ | | |
| automation.manage | ✓ | | | |
| channels.read | ✓ | ✓ | ✓ | ✓ |
| channels.configure | ✓ | | | |
| reports.read | ✓ | ✓ | ✓ | ✓ |
| reports.export | ✓ | ✓ | | |
| audit.read | ✓ | ✓ | | |
| users.read | ✓ | | | |
| users.manage | ✓ | | | |
| settings.read | ✓ | | | |
| settings.update | ✓ | | | |

### 9.3 Authentication

| Method | Status | Notes |
|--------|--------|-------|
| Mock Auth | Implemented | Development only |
| SSO (AD/Okta) | Planned | Production requirement |
| MFA | Planned | Required for admin role |
| Session Timeout | Planned | Configurable per role |

---

## 10. Subscriber Management

### 10.1 Subscriber Data Model

```typescript
interface Subscriber {
  id: string;

  // Contact Methods (at least one required)
  email: string | null;
  phone: string | null;
  pushToken: string | null;
  pushPlatform: 'ios' | 'android' | 'web' | null;

  // Preferences
  preferences: {
    routes?: string[];           // Specific routes
    modes?: string[];            // Transit modes
    areas?: GeographicArea[];    // Geographic filtering
    severity?: Severity[];       // Minimum severity
    quietHours?: {
      enabled: boolean;
      start: string;             // HH:mm
      end: string;
      timezone: string;
    };
    channels?: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
  };

  // Compliance
  language: string;
  consentGivenAt: string;
  consentMethod: 'web_form' | 'sms_keyword' | 'api' | 'import';
  consentIp: string | null;

  // Status
  status: 'active' | 'unsubscribed' | 'bounced' | 'complained';
  unsubscribedAt: string | null;
  bounceCount: number;
  lastBounceAt: string | null;
}
```

### 10.2 Subscription Options

| Option | Type | Description |
|--------|------|-------------|
| By Route | Multi-select | Subscribe to specific routes (e.g., "Route 2", "Blue Line") |
| By Mode | Multi-select | Subscribe to transit modes (Rail, Bus, etc.) |
| By Area | Geographic | Draw polygon or set radius |
| By Severity | Threshold | Minimum severity to receive alerts |

### 10.3 Compliance Features

- **Opt-in Required**: Double opt-in for email, keyword for SMS
- **Easy Unsubscribe**: One-click unsubscribe links
- **Bounce Handling**: Auto-disable after 3 hard bounces
- **Complaint Handling**: Immediate unsubscribe on complaint
- **Inactive Cleanup**: Configurable auto-cleanup policy
- **TCPA/CAN-SPAM Compliance**: Built-in safeguards

---

## 11. Audit & Compliance

### 11.1 Audit Log Schema

```typescript
interface AuditLogEntry {
  id: string;
  timestamp: string;

  // Actor
  actorType: 'user' | 'automation' | 'system';
  actorId: string;
  actorName: string;

  // Action
  action: string;              // e.g., "incident.create", "message.send"
  resource: string;            // e.g., "incident", "message"
  resourceId: string;

  // Details
  changes: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];

  // Context
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string;

  // Outcome
  success: boolean;
  errorMessage: string | null;
}
```

### 11.2 Audited Actions

| Category | Actions |
|----------|---------|
| **Incidents** | create, update, publish, resolve, archive, delete |
| **Messages** | create, send, retry, cancel |
| **Subscribers** | create, update, unsubscribe, import, export |
| **Templates** | create, update, delete |
| **Automation** | create, update, delete, execute |
| **Channels** | configure, enable, disable, test |
| **Users** | create, update, delete, login, logout |
| **Settings** | update |

### 11.3 Audit Requirements

| Requirement | Implementation |
|-------------|----------------|
| Immutability | Append-only table, no updates/deletes |
| Timestamps | Server-generated UTC timestamps |
| Searchability | Indexed by actor, action, resource, time |
| Exportability | CSV, JSON export endpoints |
| Retention | Configurable (default: 2 years) |

---

## 12. Reporting & Analytics

### 12.1 Real-Time Dashboards

#### Active Incidents Dashboard
- Count by status (draft, active, resolved)
- Count by severity
- Count by mode/route
- Time since last update

#### Channel Delivery Status
- Messages in queue
- Delivery success rate (24h)
- Failed deliveries requiring attention
- Channel health status

#### System Health
- API response times
- Queue depths
- Error rates
- Active users

### 12.2 Historical Reports

| Report | Metrics | Granularity |
|--------|---------|-------------|
| **Incident Frequency** | Count by type, mode, route, severity | Daily, Weekly, Monthly |
| **Response Times** | Time to activate, time to resolve | Per incident, averaged |
| **Communication Reach** | Subscribers notified, delivery rate | Per message, per channel |
| **Channel Effectiveness** | Open rates (email), click rates | Per channel, per campaign |
| **User Activity** | Actions per user, incidents handled | Daily, Weekly |

### 12.3 Export Formats

- **CSV**: Tabular data exports
- **JSON**: Structured data exports
- **API**: Programmatic access with pagination

---

## 13. API Design

### 13.1 API Principles

- **REST**: Resource-oriented design
- **Versioning**: URL-based (e.g., `/api/v1/incidents`)
- **Authentication**: OAuth2 / JWT
- **Rate Limiting**: Per-client, per-endpoint
- **Documentation**: OpenAPI 3.0 spec

### 13.2 Core Endpoints

```
# Incidents
GET    /api/v1/incidents              # List incidents
POST   /api/v1/incidents              # Create incident
GET    /api/v1/incidents/:id          # Get incident
PATCH  /api/v1/incidents/:id          # Update incident
DELETE /api/v1/incidents/:id          # Delete incident (draft only)
POST   /api/v1/incidents/:id/publish  # Publish incident
POST   /api/v1/incidents/:id/resolve  # Resolve incident

# Messages
GET    /api/v1/messages               # List messages
POST   /api/v1/messages               # Create and send message
GET    /api/v1/messages/:id           # Get message with deliveries

# Subscribers
GET    /api/v1/subscribers            # List subscribers
POST   /api/v1/subscribers            # Create subscriber
GET    /api/v1/subscribers/:id        # Get subscriber
PATCH  /api/v1/subscribers/:id        # Update preferences
DELETE /api/v1/subscribers/:id        # Unsubscribe

# Templates
GET    /api/v1/templates              # List templates
POST   /api/v1/templates              # Create template
GET    /api/v1/templates/:id          # Get template
PATCH  /api/v1/templates/:id          # Update template
DELETE /api/v1/templates/:id          # Delete template
POST   /api/v1/templates/:id/render   # Render with parameters

# Channels
GET    /api/v1/channels               # List channels
GET    /api/v1/channels/:id           # Get channel status
POST   /api/v1/channels/:id/test      # Test channel

# Webhooks (for external integrations)
POST   /api/v1/webhooks/bounce        # Handle email bounces
POST   /api/v1/webhooks/delivery      # Handle delivery callbacks
```

### 13.3 Webhook Support

External systems can subscribe to events:

```typescript
interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];  // e.g., ["incident.created", "message.sent"]
  secret: string;    // For signature verification
  active: boolean;
}
```

---

## 14. Security Architecture

### 14.1 Data Protection

| Layer | Protection |
|-------|------------|
| **At Rest** | D1 encryption, R2 encryption |
| **In Transit** | TLS 1.3 (Cloudflare) |
| **Secrets** | Cloudflare Secrets, env vars |
| **API Keys** | Hashed storage, rotation support |

### 14.2 Access Control

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                                   │
└─────────────────────────────────────────────────────────────────────┘

  Request ──▶ [Rate Limiter] ──▶ [Authentication] ──▶ [Authorization]
                   │                    │                    │
                   │                    │                    │
                   ▼                    ▼                    ▼
              IP blocking         JWT validation       Permission check
              DDoS protection     Session check        Role verification
              Abuse detection     MFA verification     Resource ownership
```

### 14.3 Security Controls

| Control | Implementation |
|---------|----------------|
| **Rate Limiting** | Per-IP, per-user, per-endpoint |
| **Input Validation** | Zod schemas on all inputs |
| **SQL Injection** | Parameterized queries only |
| **XSS Prevention** | React auto-escaping, CSP headers |
| **CSRF Protection** | SameSite cookies, token validation |
| **Session Security** | Secure, HttpOnly cookies |

---

## 15. Infrastructure & Deployment

### 15.1 Cloudflare Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE INFRASTRUCTURE                         │
└─────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │                        CLOUDFLARE CDN                            │
  │                   (Global Edge Network)                          │
  └────────────────────────────┬────────────────────────────────────┘
                               │
  ┌────────────────────────────┼────────────────────────────────────┐
  │                     WORKERS RUNTIME                              │
  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
  │  │    Main     │  │   Queue     │  │    Cron     │            │
  │  │   Worker    │  │  Consumers  │  │   Workers   │            │
  │  └─────────────┘  └─────────────┘  └─────────────┘            │
  └────────────────────────────┬────────────────────────────────────┘
                               │
  ┌────────────────────────────┼────────────────────────────────────┐
  │                      DATA SERVICES                               │
  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
  │  │   D1    │  │   R2    │  │   KV    │  │ Queues  │           │
  │  │ Primary │  │ Storage │  │  Cache  │  │Messages │           │
  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘           │
  └─────────────────────────────────────────────────────────────────┘
```

### 15.2 Deployment Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CI/CD PIPELINE                                   │
└─────────────────────────────────────────────────────────────────────┘

  [Commit] ──▶ [Lint] ──▶ [Type Check] ──▶ [Test] ──▶ [Build]
                                                         │
                          ┌──────────────────────────────┘
                          │
                          ▼
              ┌─────────────────────┐
              │  Deploy to Staging  │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   Smoke Tests       │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │ Deploy to Production│
              │   (Manual Approve)  │
              └─────────────────────┘
```

### 15.3 Observability

| Component | Tool | Purpose |
|-----------|------|---------|
| **Metrics** | Cloudflare Analytics | Request rates, latency |
| **Logs** | Cloudflare Logpush | Centralized logging |
| **Traces** | Workers Trace | Request tracing |
| **Alerts** | Cloudflare Notifications | Error spikes, downtime |

---

## 16. Implementation Status

### 16.1 Completed Features

| Feature | Status | Location |
|---------|--------|----------|
| ✅ Database schema | Done | `db/schema.sql` |
| ✅ Domain schemas (Zod) | Done | `core/domain/` |
| ✅ Incident CRUD | Done | `src/server/incidents.ts` |
| ✅ Incident UI (list, detail, create) | Done | `src/routes/incidents/` |
| ✅ Message CRUD | Done | `src/server/messages.ts` |
| ✅ Message UI (list, detail, compose) | Done | `src/routes/messages/` |
| ✅ Subscriber CRUD | Done | `src/server/subscribers.ts` |
| ✅ Template system | Done | `src/server/templates.ts` |
| ✅ Dashboard | Done | `src/routes/index.tsx` |
| ✅ Mock authentication | Done | `src/server/auth.ts` |
| ✅ UTA route data | Done | `src/data/uta-routes.ts` |
| ✅ Nested routing (TanStack) | Done | `src/routes/` |

### 16.2 In Progress

| Feature | Status | Notes |
|---------|--------|-------|
| 🔄 Publish with notifications | Partial | UI done, queue integration needed |
| 🔄 Delivery tracking | Partial | Schema done, real delivery needed |
| 🔄 Channel adapters | Started | Interface defined, implementations needed |

### 16.3 Not Started

| Feature | Priority | Notes |
|---------|----------|-------|
| ⬜ Twitter adapter | High | API integration |
| ⬜ Email adapter (SendGrid) | High | Provider integration |
| ⬜ SMS adapter (Twilio) | High | Provider integration |
| ⬜ Push notifications | Medium | FCM integration |
| ⬜ Signage adapters | Medium | Multiple vendor APIs |
| ⬜ GTFS-RT feed | Medium | Service alert generation |
| ⬜ Automation engine | Medium | Rule evaluation, execution |
| ⬜ Audit logging | Medium | Comprehensive logging |
| ⬜ SSO integration | High | AD/Okta |
| ⬜ Real reporting | Low | Analytics dashboards |
| ⬜ Subscriber import/export | Low | Bulk operations |
| ⬜ Webhook integrations | Low | External notifications |

---

## 17. Development Roadmap

### Phase 1: Core Platform (Current)
**Goal**: Functional incident management with manual notification

- [x] Database schema and migrations
- [x] Incident management (CRUD, lifecycle)
- [x] Message composition and preview
- [x] Subscriber management
- [x] Template system
- [x] Dashboard and navigation
- [ ] Audit logging foundation
- [ ] Error handling improvements

### Phase 2: Channel Integration
**Goal**: Automated delivery to primary channels

- [ ] Channel adapter interface
- [ ] Email adapter (SendGrid)
- [ ] SMS adapter (Twilio)
- [ ] Twitter adapter
- [ ] Cloudflare Queues integration
- [ ] Delivery tracking and retry
- [ ] Dead-letter queue handling

### Phase 3: Automation
**Goal**: Rules-based automatic notifications

- [ ] Automation rule management UI
- [ ] Trigger evaluation engine
- [ ] Action execution engine
- [ ] Scheduled triggers (cron)
- [ ] Rule testing/simulation

### Phase 4: Advanced Channels
**Goal**: Full channel coverage

- [ ] Push notification adapter (FCM)
- [ ] Signage adapters (Penta, Papercast)
- [ ] GTFS-RT feed generation
- [ ] Website/CMS integration

### Phase 5: Enterprise Features
**Goal**: Production-ready for UTA

- [ ] SSO integration (AD/Okta)
- [ ] MFA support
- [ ] Advanced reporting
- [ ] Subscriber import/export
- [ ] Webhook integrations
- [ ] Multi-language support

### Phase 6: Optimization
**Goal**: Performance and reliability

- [ ] Performance optimization
- [ ] Caching strategies
- [ ] Load testing
- [ ] Disaster recovery testing
- [ ] Documentation completion

---

## Appendix A: UTA Transit Data

### Transit Modes
| ID | Label | Color |
|----|-------|-------|
| `rail` | Rail (TRAX/FrontRunner) | Blue |
| `bus` | Bus | Green |
| `streetcar` | S-Line Streetcar | Orange |
| `paratransit` | Paratransit | Purple |
| `ski` | Ski Bus | White |

### Sample Routes
See `src/data/uta-routes.ts` for complete route data including:
- 100+ bus routes
- TRAX lines (Red, Blue, Green)
- FrontRunner stations
- S-Line Streetcar
- Ski bus routes

---

## Appendix B: Environment Variables

```bash
# Database
DATABASE_URL=           # D1 binding name

# Authentication
SESSION_SECRET=         # Cookie signing secret
SSO_CLIENT_ID=         # OAuth client ID
SSO_CLIENT_SECRET=     # OAuth client secret

# Channel Providers
TWITTER_API_KEY=       # Twitter API credentials
TWITTER_API_SECRET=
SENDGRID_API_KEY=      # SendGrid for email
TWILIO_ACCOUNT_SID=    # Twilio for SMS
TWILIO_AUTH_TOKEN=
FCM_SERVER_KEY=        # Firebase for push

# Feature Flags
ENABLE_MOCK_AUTH=      # Enable mock auth (dev only)
ENABLE_TEST_MODE=      # Send to test endpoints only
```

---

## Appendix C: Database Schema Overview

```sql
-- Core tables
incidents              -- Incident records
incident_versions      -- Version history
messages              -- Notification messages
message_deliveries    -- Per-channel delivery tracking

-- Communication
channels              -- Channel configurations
templates             -- Message templates

-- Users
users                 -- System users
sessions              -- Auth sessions
subscribers           -- Public subscribers

-- Automation
automation_rules      -- Rule definitions
automation_executions -- Execution history

-- System
audit_logs            -- Audit trail
settings              -- System configuration
```

See `db/schema.sql` for complete schema definition.

---

*This document is the authoritative source for UTA Notify architecture and should be updated as the system evolves.*
