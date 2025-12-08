# Performance Optimizations

This document outlines the performance optimizations implemented to improve database query speed and server response times.

## Database Optimizations

### 1. Connection Pool Improvements
- **Increased connection limit**: From 10 to 50 concurrent connections
- **Added keep-alive**: Prevents connection timeouts
- **Optimized timeouts**: Better handling of long-running queries
- **Location**: `server/database/db.js`

### 2. Database Indexes
Performance indexes have been created for frequently queried columns. To apply them, run:

```bash
mysql -u your_user -p your_database < server/migrations/add_performance_indexes.sql
```

**Indexes added for:**
- `processing_charges`: cash_processing_id, created_at
- `cash_processing`: request_id, created_at, cash_count_id
- `requests`: branch_id, service_type_id, user_id, status, my_status, created_at, pickup_date
- `clients`: created_at
- `branches`: client_id
- `staff`: branch_id, role_id, created_at
- `cash_counts`: request_id, status, created_at
- `client_update`: client_id, atm_id, loading_date, created_at

**Composite indexes** for common query patterns:
- `requests(branch_id, status)` - for filtering requests by branch and status
- `processing_charges(created_at, processing_fee_amount)` - for sorted fee queries

### 3. Query Optimizations

#### Removed SELECT *
All queries now use specific column names instead of `SELECT *`, which:
- Reduces data transfer
- Improves query execution time
- Makes queries more maintainable

**Optimized controllers:**
- `clientController.js` - Removed unnecessary table checks and debug queries
- `staffController.js` - Removed table existence checks
- `processingChargesController.js` - Added pagination support
- `server.js` - Optimized service types and requests queries

#### Added Pagination
Large result sets now support pagination:
- Default limit: 1000 records
- Can be customized via query parameters: `?limit=50&offset=0`

**Example:**
```
GET /api/processing-charges?limit=100&offset=0
GET /api/requests?limit=50&offset=50
```

## Server Optimizations

### 1. Response Compression
- **Enabled**: Gzip compression for all responses
- **Threshold**: Only compresses responses > 1KB
- **Level**: 6 (balanced compression/CPU usage)
- **Package**: `compression` (added to package.json)

### 2. JSON Payload Limits
- **Increased limit**: 10MB for JSON and URL-encoded payloads
- **Prevents**: Payload too large errors

### 3. Response Time Monitoring
- **Added**: X-Response-Time header to all responses
- **Purpose**: Monitor API performance
- **Usage**: Check response headers for timing information

### 4. Query Performance Monitoring
- **Slow query detection**: Logs queries taking > 1000ms (development only)
- **Location**: `server/database/db.js`

## Installation

1. **Install new dependencies:**
```bash
cd server
npm install
```

2. **Apply database indexes:**
```bash
mysql -u your_user -p your_database < migrations/add_performance_indexes.sql
```

3. **Restart the server:**
```bash
npm start
```

## Expected Performance Improvements

- **Database queries**: 30-50% faster with indexes
- **Response sizes**: 60-80% smaller with compression
- **Concurrent requests**: 5x more connections supported
- **Large datasets**: Pagination prevents memory issues

## Monitoring

Check response headers for performance metrics:
- `X-Response-Time`: Response duration in milliseconds
- Check server logs for slow query warnings (development mode)

## Best Practices

1. **Always use specific columns** in SELECT queries
2. **Add LIMIT** for queries that might return large datasets
3. **Use indexes** for frequently filtered/sorted columns
4. **Monitor slow queries** in development
5. **Use pagination** for list endpoints

## Future Optimizations

Potential future improvements:
- [ ] Query result caching (Redis)
- [ ] Database read replicas
- [ ] Connection pooling per route
- [ ] Query result streaming for very large datasets
- [ ] Database query result pagination at database level

