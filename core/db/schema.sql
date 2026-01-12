-- UTA Notify - Incident Communications Management Platform
-- Database Schema (Cloudflare D1 / SQLite)

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  external_id TEXT UNIQUE, -- SSO provider ID (null for mock auth)
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'operator', 'viewer')),
  permissions TEXT, -- JSON: fine-grained permission overrides
  avatar_url TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ============================================
-- INCIDENTS (Core Domain)
-- ============================================

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  incident_number INTEGER UNIQUE, -- Human-readable sequential number
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'updated', 'resolved', 'archived')),
  title TEXT NOT NULL,
  affected_modes TEXT, -- JSON array: ['rail', 'bus', 'paratransit']
  affected_routes TEXT, -- JSON array: ['801', '850', 'FrontRunner']
  geographic_scope TEXT, -- JSON: {stops: [], stations: [], polygon: []}
  start_time TEXT,
  estimated_resolution TEXT,
  actual_resolution TEXT,
  internal_notes TEXT,
  public_message TEXT,
  tags TEXT, -- JSON array: ['delay', 'detour', 'accident']
  current_version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  archived_at TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_number ON incidents(incident_number);

-- Incident version history (immutable snapshots)
CREATE TABLE IF NOT EXISTS incident_versions (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL, -- JSON: full incident state at this version
  public_message TEXT, -- Cached for quick access
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  change_reason TEXT,
  change_type TEXT CHECK (change_type IN ('create', 'update', 'status_change', 'resolve', 'archive')),
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id),
  UNIQUE(incident_id, version)
);

CREATE INDEX IF NOT EXISTS idx_incident_versions_incident ON incident_versions(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_versions_changed ON incident_versions(changed_at DESC);

-- Incident attachments
CREATE TABLE IF NOT EXISTS incident_attachments (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  r2_key TEXT NOT NULL, -- R2 object key
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_attachments_incident ON incident_attachments(incident_id);

-- ============================================
-- CHANNELS & CONFIGURATION
-- ============================================

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- twitter, email, sms, push, signage, gtfs
  name TEXT NOT NULL,
  provider TEXT, -- sendgrid, twilio, penta, papercast, etc.
  config TEXT NOT NULL, -- JSON: encrypted provider configuration
  constraints TEXT, -- JSON: {maxLength, supportsMedia, rateLimit, etc.}
  enabled INTEGER NOT NULL DEFAULT 1,
  test_mode INTEGER NOT NULL DEFAULT 0,
  last_health_check TEXT,
  health_status TEXT CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_channels_type ON channels(type);
CREATE INDEX IF NOT EXISTS idx_channels_enabled ON channels(enabled);

-- ============================================
-- MESSAGES & DELIVERY
-- ============================================

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  incident_version INTEGER NOT NULL,
  content TEXT NOT NULL, -- Base message content
  channel_overrides TEXT, -- JSON: per-channel content customizations
  media_attachments TEXT, -- JSON array of attachment IDs
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_incident ON messages(incident_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- Delivery tracking (per message per channel)
CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'sending', 'delivered', 'failed', 'partial')),
  provider_message_id TEXT, -- External ID from provider
  provider_response TEXT, -- JSON: full response from provider
  failure_reason TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  queued_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  delivered_at TEXT,
  failed_at TEXT,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES channels(id)
);

CREATE INDEX IF NOT EXISTS idx_deliveries_message ON deliveries(message_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_channel ON deliveries(channel_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_queued ON deliveries(queued_at DESC);

-- ============================================
-- TEMPLATES
-- ============================================

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  incident_type TEXT, -- NULL = applies to all types
  channel_type TEXT, -- NULL = applies to all channels
  content TEXT NOT NULL, -- Template with {{parameter}} placeholders
  parameters TEXT, -- JSON schema of available parameters
  language TEXT NOT NULL DEFAULT 'en',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(incident_type);
CREATE INDEX IF NOT EXISTS idx_templates_channel ON templates(channel_type);
CREATE INDEX IF NOT EXISTS idx_templates_language ON templates(language);

-- ============================================
-- SUBSCRIBERS
-- ============================================

CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY,
  email TEXT,
  phone TEXT,
  push_token TEXT,
  push_platform TEXT CHECK (push_platform IN ('ios', 'android', 'web')),
  preferences TEXT NOT NULL, -- JSON: {routes: [], modes: [], areas: [], severity: []}
  language TEXT NOT NULL DEFAULT 'en',
  consent_given_at TEXT NOT NULL,
  consent_method TEXT NOT NULL, -- web_form, sms_keyword, api
  consent_ip TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced', 'complained')),
  unsubscribed_at TEXT,
  bounce_count INTEGER NOT NULL DEFAULT 0,
  last_bounce_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_phone ON subscribers(phone);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subscribers_created ON subscribers(created_at DESC);

-- Subscriber delivery history (for compliance and analytics)
CREATE TABLE IF NOT EXISTS subscriber_deliveries (
  id TEXT PRIMARY KEY,
  subscriber_id TEXT NOT NULL,
  delivery_id TEXT NOT NULL,
  channel TEXT NOT NULL, -- email, sms, push
  status TEXT NOT NULL CHECK (status IN ('sent', 'delivered', 'failed', 'opened', 'clicked')),
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at TEXT,
  opened_at TEXT,
  clicked_at TEXT,
  FOREIGN KEY (subscriber_id) REFERENCES subscribers(id) ON DELETE CASCADE,
  FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sub_deliveries_subscriber ON subscriber_deliveries(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_sub_deliveries_delivery ON subscriber_deliveries(delivery_id);

-- ============================================
-- AUTOMATION RULES
-- ============================================

CREATE TABLE IF NOT EXISTS automation_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL, -- severity_threshold, delay_duration, schedule, incident_type
  trigger_config TEXT NOT NULL, -- JSON: trigger-specific configuration
  conditions TEXT, -- JSON: additional conditions to match
  actions TEXT NOT NULL, -- JSON array: actions to execute
  priority INTEGER NOT NULL DEFAULT 0, -- Higher = runs first
  enabled INTEGER NOT NULL DEFAULT 1,
  last_triggered_at TEXT,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_automation_enabled ON automation_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_automation_trigger ON automation_rules(trigger_type);

-- Automation execution log
CREATE TABLE IF NOT EXISTS automation_executions (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  incident_id TEXT,
  trigger_data TEXT, -- JSON: data that triggered the rule
  actions_executed TEXT, -- JSON: actions that were executed
  success INTEGER NOT NULL,
  error_message TEXT,
  execution_time_ms INTEGER,
  executed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE,
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_automation_exec_rule ON automation_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_exec_incident ON automation_executions(incident_id);
CREATE INDEX IF NOT EXISTS idx_automation_exec_time ON automation_executions(executed_at DESC);

-- ============================================
-- AUDIT LOG
-- ============================================

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT, -- NULL for system actions
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'automation', 'api')),
  actor_name TEXT, -- Cached name for display
  action TEXT NOT NULL, -- create, update, delete, publish, login, etc.
  resource_type TEXT NOT NULL, -- incident, message, template, user, etc.
  resource_id TEXT,
  resource_name TEXT, -- Cached name for display
  details TEXT, -- JSON: action-specific details
  changes TEXT, -- JSON: {field: {old, new}} for updates
  ip_address TEXT,
  user_agent TEXT,
  request_id TEXT, -- For correlating related actions
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_request ON audit_log(request_id);

-- ============================================
-- CONFIGURATION & SETTINGS
-- ============================================

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL, -- JSON value
  description TEXT,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Incident type taxonomy
CREATE TABLE IF NOT EXISTS incident_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- Icon identifier
  default_severity TEXT CHECK (default_severity IN ('low', 'medium', 'high', 'critical')),
  default_template_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (default_template_id) REFERENCES templates(id) ON DELETE SET NULL
);

-- Transit modes
CREATE TABLE IF NOT EXISTS transit_modes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT, -- Hex color for UI
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1
);

-- Routes (reference data)
CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL UNIQUE, -- GTFS route_id
  route_short_name TEXT,
  route_long_name TEXT,
  route_type INTEGER, -- GTFS route_type
  mode_id TEXT,
  color TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (mode_id) REFERENCES transit_modes(id)
);

CREATE INDEX IF NOT EXISTS idx_routes_mode ON routes(mode_id);

-- ============================================
-- SEED DATA
-- ============================================

-- Default admin user (for mock auth)
INSERT OR IGNORE INTO users (id, email, name, role, created_at, updated_at)
VALUES ('usr_admin', 'admin@uta.org', 'System Administrator', 'admin', datetime('now'), datetime('now'));

-- Default incident types
INSERT OR IGNORE INTO incident_types (id, name, description, default_severity, sort_order) VALUES
  ('type_delay', 'Service Delay', 'Delay affecting service schedule', 'medium', 1),
  ('type_detour', 'Detour', 'Route deviation from normal path', 'medium', 2),
  ('type_suspension', 'Service Suspension', 'Complete suspension of service', 'high', 3),
  ('type_accident', 'Accident/Incident', 'Vehicle or passenger incident', 'high', 4),
  ('type_weather', 'Weather Impact', 'Weather-related service impact', 'medium', 5),
  ('type_maintenance', 'Planned Maintenance', 'Scheduled maintenance work', 'low', 6),
  ('type_security', 'Security Alert', 'Security-related incident', 'critical', 7),
  ('type_other', 'Other', 'Other incident type', 'low', 99);

-- Default transit modes
INSERT OR IGNORE INTO transit_modes (id, name, description, icon, color, sort_order) VALUES
  ('mode_rail', 'Rail', 'TRAX Light Rail and FrontRunner', 'train', '#0066CC', 1),
  ('mode_bus', 'Bus', 'Local and Express Bus Service', 'bus', '#00AA44', 2),
  ('mode_streetcar', 'Streetcar', 'S-Line Streetcar', 'tram', '#FF6600', 3),
  ('mode_paratransit', 'Paratransit', 'Flex and Paratransit Service', 'accessible', '#9933CC', 4),
  ('mode_ski', 'Ski Bus', 'Ski Resort Service', 'mountain-snow', '#00CCFF', 5);

-- Default settings
INSERT OR IGNORE INTO settings (key, value, description, updated_at) VALUES
  ('app.name', '"UTA Notify"', 'Application display name', datetime('now')),
  ('app.timezone', '"America/Denver"', 'Default timezone for the application', datetime('now')),
  ('incidents.auto_archive_days', '90', 'Days after resolution to auto-archive incidents', datetime('now')),
  ('delivery.max_retries', '3', 'Maximum delivery retry attempts', datetime('now')),
  ('delivery.retry_backoff_minutes', '[5, 15, 60]', 'Backoff intervals for retries (minutes)', datetime('now')),
  ('subscribers.cleanup_inactive_days', '365', 'Days of inactivity before subscriber cleanup', datetime('now'));
