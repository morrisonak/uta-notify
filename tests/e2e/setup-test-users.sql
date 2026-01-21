-- Setup test users for RBAC E2E tests
-- Run this against production D1 before running tests:
-- wrangler d1 execute uta-notify-db --file=./tests/e2e/setup-test-users.sql

-- Admin user (likely already exists)
INSERT OR REPLACE INTO users (id, email, name, role, created_at, updated_at)
VALUES ('usr_admin', 'admin@uta.org', 'Test Admin', 'admin', datetime('now'), datetime('now'));

-- Editor user
INSERT OR REPLACE INTO users (id, email, name, role, created_at, updated_at)
VALUES ('usr_editor', 'editor@uta.org', 'Test Editor', 'editor', datetime('now'), datetime('now'));

-- Operator user
INSERT OR REPLACE INTO users (id, email, name, role, created_at, updated_at)
VALUES ('usr_operator', 'operator@uta.org', 'Test Operator', 'operator', datetime('now'), datetime('now'));

-- Viewer user
INSERT OR REPLACE INTO users (id, email, name, role, created_at, updated_at)
VALUES ('usr_viewer', 'viewer@uta.org', 'Test Viewer', 'viewer', datetime('now'), datetime('now'));

-- Verify users were created
SELECT id, email, name, role FROM users WHERE email LIKE '%@uta.org';
