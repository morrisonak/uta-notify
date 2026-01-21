# Role-Based Access Control (RBAC) E2E Test Plan

## Overview

This test suite validates that role-based permissions are correctly enforced across all UI pages and server functions in production.

## Roles Under Test

| Role | Description | Key Capabilities |
|------|-------------|------------------|
| **admin** | Full system access | All permissions including user management |
| **editor** | Content management | Create, edit, publish incidents; manage templates |
| **operator** | Incident operations | Create, edit incidents; cannot publish or delete |
| **viewer** | Read-only access | View incidents, messages, reports only |

## Test Users Required

Before running tests, ensure these users exist in the production database:

```sql
INSERT OR IGNORE INTO users (id, email, name, role, created_at, updated_at) VALUES
  ('usr_admin', 'admin@uta.org', 'Test Admin', 'admin', datetime('now'), datetime('now')),
  ('usr_editor', 'editor@uta.org', 'Test Editor', 'editor', datetime('now'), datetime('now')),
  ('usr_operator', 'operator@uta.org', 'Test Operator', 'operator', datetime('now'), datetime('now')),
  ('usr_viewer', 'viewer@uta.org', 'Test Viewer', 'viewer', datetime('now'), datetime('now'));
```

## Test Matrix

### 1. Page Access Tests

Verify each role can/cannot access each page:

| Page | Admin | Editor | Operator | Viewer |
|------|-------|--------|----------|--------|
| `/` (Dashboard) | ✓ | ✓ | ✓ | ✓ |
| `/incidents` | ✓ | ✓ | ✓ | ✓ |
| `/incidents/new` | ✓ | ✓ | ✓ | ✗ |
| `/incidents/:id` | ✓ | ✓ | ✓ | ✓ |
| `/messages` | ✓ | ✓ | ✓ | ✓ |
| `/messages/new` | ✓ | ✓ | ✓ | ✗ |
| `/templates` | ✓ | ✓ | ✓ | ✓ |
| `/subscribers` | ✓ | ✓ | ✓ | ✓ |
| `/reports` | ✓ | ✓ | ✓ | ✓ |
| `/settings` | ✓ | ✓ | ✓ | ✓ |
| `/settings` (edit) | ✓ | ✗ | ✗ | ✗ |
| `/audit` | ✓ | ✓ | ✗ | ✗ |

### 2. Incident Permission Tests

| Action | Admin | Editor | Operator | Viewer |
|--------|-------|--------|----------|--------|
| View incident list | ✓ | ✓ | ✓ | ✓ |
| View incident detail | ✓ | ✓ | ✓ | ✓ |
| Create incident | ✓ | ✓ | ✓ | ✗ |
| Edit incident | ✓ | ✓ | ✓ | ✗ |
| Delete incident | ✓ | ✗ | ✗ | ✗ |
| Publish incident | ✓ | ✓ | ✗ | ✗ |
| Resolve incident | ✓ | ✓ | ✓ | ✗ |
| Archive incident | ✓ | ✓ | ✗ | ✗ |

### 3. Message Permission Tests

| Action | Admin | Editor | Operator | Viewer |
|--------|-------|--------|----------|--------|
| View messages | ✓ | ✓ | ✓ | ✓ |
| Create message | ✓ | ✓ | ✓ | ✗ |
| Edit message | ✓ | ✓ | ✓ | ✗ |
| Delete message | ✓ | ✗ | ✗ | ✗ |
| Send message | ✓ | ✓ | ✗ | ✗ |

### 4. Template Permission Tests

| Action | Admin | Editor | Operator | Viewer |
|--------|-------|--------|----------|--------|
| View templates | ✓ | ✓ | ✓ | ✓ |
| Create template | ✓ | ✓ | ✗ | ✗ |
| Edit template | ✓ | ✓ | ✗ | ✗ |
| Delete template | ✓ | ✓ | ✗ | ✗ |

### 5. Subscriber Permission Tests

| Action | Admin | Editor | Operator | Viewer |
|--------|-------|--------|----------|--------|
| View subscribers | ✓ | ✓ | ✓ | ✓ |
| Add subscriber | ✓ | ✓ | ✗ | ✗ |
| Edit subscriber | ✓ | ✓ | ✗ | ✗ |
| Delete subscriber | ✓ | ✗ | ✗ | ✗ |
| Export subscribers | ✓ | ✓ | ✗ | ✗ |

### 6. User Management Tests (Admin Only)

| Action | Admin | Editor | Operator | Viewer |
|--------|-------|--------|----------|--------|
| View users | ✓ | ✗ | ✗ | ✗ |
| Create user | ✓ | ✗ | ✗ | ✗ |
| Edit user | ✓ | ✗ | ✗ | ✗ |
| Delete user | ✓ | ✗ | ✗ | ✗ |
| Change role | ✓ | ✗ | ✗ | ✗ |

### 7. Settings Permission Tests

| Action | Admin | Editor | Operator | Viewer |
|--------|-------|--------|----------|--------|
| View settings | ✓ | ✓ | ✓ | ✓ |
| Edit settings | ✓ | ✗ | ✗ | ✗ |
| Configure channels | ✓ | ✗ | ✗ | ✗ |

### 8. Report Permission Tests

| Action | Admin | Editor | Operator | Viewer |
|--------|-------|--------|----------|--------|
| View reports | ✓ | ✓ | ✓ | ✓ |
| Export reports | ✓ | ✓ | ✗ | ✗ |

## Test Implementation Strategy

### Phase 1: Setup & Authentication
1. Create test users in production DB (one-time setup)
2. Test login flow for each user
3. Verify session persistence
4. Test logout functionality

### Phase 2: Page Access Validation
For each role:
1. Login as role
2. Navigate to each page
3. Verify page loads or shows appropriate error
4. Check that restricted UI elements are hidden

### Phase 3: Action Permission Tests
For each role, test CRUD operations:
1. Verify "create" buttons are present/hidden appropriately
2. Attempt to create resources via UI
3. Verify edit forms are accessible/blocked
4. Attempt edits and verify success/failure
5. Verify delete buttons are present/hidden
6. Attempt deletes and verify success/failure

### Phase 4: Server Function Security
Directly test server functions to ensure backend enforcement:
1. Attempt API calls with insufficient permissions
2. Verify 403 Forbidden responses
3. Test permission bypass attempts

### Phase 5: Edge Cases
1. Test custom permission overrides (granted/denied)
2. Test session expiration handling
3. Test role change during active session
4. Test concurrent sessions

## Success Criteria

- All ✓ actions succeed without errors
- All ✗ actions are blocked with appropriate error messages
- UI correctly hides/shows elements based on permissions
- Server functions reject unauthorized requests
- No permission escalation vulnerabilities found

## Artifacts Generated

- `rbac-test-results.json` - Detailed test results
- `rbac-test-screenshots/` - Screenshots of permission denials
- `rbac-test-report.html` - Human-readable test report
