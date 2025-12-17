const { logAudit, getStaffFromRequest, getIpAddress } = require('../utils/auditLogger');

/**
 * Determine action type from HTTP method and route
 */
function getActionFromRoute(method, path) {
  const upperMethod = method.toUpperCase();
  const lowerPath = path.toLowerCase();

  // Authentication routes
  if (lowerPath.includes('/auth/login')) return 'LOGIN';
  if (lowerPath.includes('/auth/logout')) return 'LOGOUT';

  // CRUD operations
  if (upperMethod === 'POST') return 'CREATE';
  if (upperMethod === 'PUT' || upperMethod === 'PATCH') return 'UPDATE';
  if (upperMethod === 'DELETE') return 'DELETE';
  if (upperMethod === 'GET') return 'VIEW';

  return upperMethod;
}

/**
 * Extract resource type from path
 */
function getResourceTypeFromPath(path) {
  const segments = path.split('/').filter(s => s);
  
  // Skip 'api' prefix if present
  const apiIndex = segments.indexOf('api');
  const relevantSegments = apiIndex >= 0 ? segments.slice(apiIndex + 1) : segments;
  
  if (relevantSegments.length === 0) return null;
  
  // Get the main resource (first segment)
  let resource = relevantSegments[0];
  
  // Handle nested resources (e.g., /api/clients/:id/branches -> 'BRANCH')
  if (relevantSegments.length > 1 && resource !== 'auth') {
    resource = relevantSegments[relevantSegments.length - 1];
  }
  
  // Convert to uppercase and singular form (simple conversion)
  resource = resource.replace(/s$/, '').toUpperCase();
  
  // Special cases
  const resourceMap = {
    'STAFF': 'STAFF',
    'CLIENT': 'CLIENT',
    'BRANCH': 'BRANCH',
    'ATM': 'ATM',
    'REQUEST': 'REQUEST',
    'VAULT': 'VAULT',
    'CASH-COUNT': 'CASH_COUNT',
    'CASH-COUNT': 'CASH_COUNT',
    'PROCESSING-CHARGE': 'PROCESSING_CHARGE',
    'SERVICE-CHARGE': 'SERVICE_CHARGE',
    'NOTICE': 'NOTICE',
    'TEAM': 'TEAM',
    'USER': 'USER',
    'ROLE': 'ROLE',
    'SERVICE-TYPE': 'SERVICE_TYPE'
  };
  
  return resourceMap[resource] || resource;
}

/**
 * Extract resource ID from path or body
 */
function getResourceId(req) {
  // Try to get from URL params
  const pathSegments = req.path.split('/').filter(s => s);
  const params = req.params;
  
  // Check common ID parameter names
  if (params.id) return parseInt(params.id);
  if (params.userId) return parseInt(params.userId);
  if (params.clientId) return parseInt(params.clientId);
  if (params.branchId) return parseInt(params.branchId);
  if (params.staffId) return parseInt(params.staffId);
  if (params.requestId) return parseInt(params.requestId);
  if (params.vaultId) return parseInt(params.vaultId);
  
  // Try to get from request body for POST/PUT/PATCH
  if (req.body && req.body.id) return parseInt(req.body.id);
  
  return null;
}

/**
 * Audit middleware to log all requests
 */
function auditMiddleware(req, res, next) {
  // Store original end function
  const originalEnd = res.end;
  
  // Override end function to capture response
  res.end = function(chunk, encoding) {
    // Restore original end
    res.end = originalEnd;
    
    // Call original end first
    res.end(chunk, encoding);
    
    // Log audit trail asynchronously (don't block response)
    setImmediate(async () => {
      try {
        // Skip logging for certain paths
        const skipPaths = ['/api/test', '/test-cors', '/', '/favicon.ico'];
        if (skipPaths.includes(req.path)) {
          return;
        }

        // Skip health checks and monitoring endpoints
        if (req.path.includes('/health') || req.path.includes('/ping')) {
          return;
        }

        // Try to extract user from JWT token if available (for routes without auth middleware)
        if (!req.user) {
          const authHeader = req.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
              const jwt = require('jsonwebtoken');
              const token = authHeader.substring(7);
              const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
              req.user = {
                userId: decoded.userId || decoded.id,
                username: decoded.username
              };
            } catch (tokenError) {
              // Token invalid or expired, continue without user info
            }
          }
        }
        
        const staffInfo = await getStaffFromRequest(req);
        const action = getActionFromRoute(req.method, req.path);
        const entityType = getResourceTypeFromPath(req.path);
        const entityId = getResourceId(req);
        const ipAddress = getIpAddress(req);
        const userAgent = req.headers['user-agent'] || null;
        
        // Prepare details (combine endpoint, method, status, and sanitized body)
        const detailsObj = {
          endpoint: req.originalUrl || req.url,
          method: req.method,
          status: res.statusCode
        };
        
        // Add request body if present (sanitize sensitive data)
        if (req.body && Object.keys(req.body).length > 0) {
          const sanitizedBody = { ...req.body };
          const sensitiveFields = ['password', 'oldPassword', 'newPassword', 'token'];
          sensitiveFields.forEach(field => {
            if (sanitizedBody[field]) {
              sanitizedBody[field] = '[REDACTED]';
            }
          });
          detailsObj.requestBody = sanitizedBody;
        }
        
        const details = JSON.stringify(detailsObj);

        await logAudit({
          staffId: staffInfo.staffId,
          staffName: staffInfo.staffName,
          staffUsername: staffInfo.staffUsername,
          action,
          entityType,
          entityId,
          details,
          ipAddress,
          userAgent
        });
      } catch (error) {
        // Silently fail - don't break the request flow
        console.error('Error in audit middleware:', error);
      }
    });
  };
  
  next();
}

module.exports = auditMiddleware;
