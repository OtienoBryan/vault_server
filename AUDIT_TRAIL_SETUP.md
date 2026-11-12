# Audit Trail System Setup

This document describes the audit trail system that logs all activities in the system including login, logout, and all other operations.

## Database Table

The audit trail uses the `audit_logs` table with the following schema:

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  staff_id INT(11) NULL,
  staff_name VARCHAR(255) NULL,
  staff_username VARCHAR(255) NULL,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100) NULL,
  entity_id INT(11) NULL,
  details TEXT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_staff_id (staff_id),
  INDEX idx_action (action),
  INDEX idx_entity_type (entity_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## Setup Instructions

1. **Create the database table:**
   ```bash
   cd server
   node create-audit-trail-table.js
   ```

2. **The audit middleware is automatically integrated** into `server.js` and will log all HTTP requests.

## Features

### Automatic Logging

- **All HTTP requests** are automatically logged via the audit middleware
- **Login events** are logged with success/failure status
- **Logout events** are logged when users log out
- **Password changes** are logged for security tracking
- **All CRUD operations** (CREATE, UPDATE, DELETE, VIEW) are automatically logged

### Logged Information

Each audit log entry includes:
- **Staff information**: staff_id, staff_name, staff_username (if available)
- **Action type**: LOGIN, LOGOUT, CREATE, UPDATE, DELETE, VIEW, etc.
- **Entity information**: entity_type (e.g., CLIENT, REQUEST, VAULT) and entity_id
- **Request details**: endpoint, HTTP method, status code, sanitized request body
- **Client information**: IP address and user agent
- **Timestamp**: created_at

### Security Features

- **Sensitive data redaction**: Passwords and tokens are automatically redacted from logs
- **Non-blocking**: Audit logging failures don't break the main application flow
- **Comprehensive**: Logs both successful and failed operations

## API Endpoints

### Get All Audit Logs
```
GET /api/audit-logs
```

Query parameters:
- `action`: Filter by action type
- `entityType`: Filter by entity type
- `staffId`: Filter by staff ID
- `staffUsername`: Filter by staff username
- `startDate`: Filter by start date
- `endDate`: Filter by end date
- `limit`: Number of results (default: 100)
- `offset`: Pagination offset (default: 0)

### Get Audit Log by ID
```
GET /api/audit-logs/:id
```

### Get Audit Logs by Staff
```
GET /api/audit-logs/staff/:staffId
```

Query parameters:
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset (default: 0)

### Get Audit Logs by Action
```
GET /api/audit-logs/action/:action
```

Query parameters:
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset (default: 0)

## Action Types

Common action types logged:
- `LOGIN` - Successful login
- `LOGIN_FAILED` - Failed login attempt
- `LOGOUT` - User logout
- `PASSWORD_CHANGE` - Password change
- `PASSWORD_CHANGE_FAILED` - Failed password change attempt
- `CREATE` - Create operation (POST)
- `UPDATE` - Update operation (PUT/PATCH)
- `DELETE` - Delete operation (DELETE)
- `VIEW` - View/Read operation (GET)

## Entity Types

Common entity types:
- `AUTH` - Authentication related
- `USER` - User management
- `CLIENT` - Client management
- `BRANCH` - Branch management
- `STAFF` - Staff management
- `REQUEST` - Request management
- `VAULT` - Vault operations
- `CASH_COUNT` - Cash count operations
- `NOTICE` - Notice management
- `TEAM` - Team management
- `ATM` - ATM management

## Files Modified/Created

### New Files:
- `server/create-audit-trail-table.js` - Database table creation script
- `server/utils/auditLogger.js` - Audit logging utility functions
- `server/middleware/auditMiddleware.js` - Express middleware for automatic logging
- `server/controllers/auditController.js` - API controller for retrieving audit logs

### Modified Files:
- `server/server.js` - Added audit middleware and audit routes
- `server/controllers/authController.js` - Added login/logout/password change logging
- `client/src/contexts/AuthContext.tsx` - Updated logout to call logout endpoint
- `client/src/services/authService.ts` - Updated logout to call logout endpoint

## Usage Examples

### Example: Get all login events
```bash
GET /api/audit-logs?action=LOGIN&limit=50
```

### Example: Get all activities for a specific staff member
```bash
GET /api/audit-logs/staff/123?limit=100
```

### Example: Get all activities for a specific date range
```bash
GET /api/audit-logs?startDate=2024-01-01&endDate=2024-01-31
```

### Example: Get all failed login attempts
```bash
GET /api/audit-logs/action/LOGIN_FAILED
```

## Notes

- The audit middleware runs on all routes automatically
- Sensitive fields (passwords, tokens) are automatically redacted
- Logging failures are caught and logged to console but don't affect the main application
- The system attempts to extract user information from JWT tokens when available
- Staff information is automatically looked up from the user_id when available


