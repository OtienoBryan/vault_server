const db = require('../database/db');

/**
 * Get staff information from user ID
 * @param {number} userId - User ID
 * @returns {Object|null} - Staff information or null
 */
async function getStaffInfo(userId) {
  if (!userId) return null;
  
  try {
    // First, get user info from vault_users (always available)
    const [users] = await db.query(
      'SELECT id, username FROM vault_users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return null;
    }
    
    const username = users[0].username;
    
    // Try multiple methods to find staff record
    let staff = null;
    
    // Method 1: Try to find staff by user_id (if column exists and references vault_users)
    try {
      const [staffByUserId] = await db.query(
        `SELECT s.id as staff_id, s.name as staff_name
         FROM staff s
         WHERE s.user_id = ?`,
        [userId]
      );
      
      if (staffByUserId.length > 0) {
        staff = staffByUserId[0];
      }
    } catch (err) {
      // Column might not exist, continue to other methods
    }
    
    // Method 2: If no staff found by user_id, try to find by matching username with name
    // This is a fallback if staff table doesn't have user_id column
    if (!staff) {
      try {
        // Try to find staff where name matches or is similar to username
        const [staffByName] = await db.query(
          `SELECT s.id as staff_id, s.name as staff_name
           FROM staff s
           WHERE LOWER(s.name) LIKE LOWER(CONCAT('%', ?, '%'))
           LIMIT 1`,
          [username]
        );
        
        if (staffByName.length > 0) {
          staff = staffByName[0];
        }
      } catch (err) {
        // Continue if this fails
      }
    }
    
    // Return staff info with username
    if (staff) {
      return {
        staffId: staff.staff_id,
        staffName: staff.staff_name || username, // Use username as fallback for name
        staffUsername: username
      };
    }
    
    // Final fallback: return username as name if no staff found
    return {
      staffId: null,
      staffName: username, // Use username as staff_name
      staffUsername: username
    };
  } catch (error) {
    console.error('Error getting staff info:', error);
    // Even on error, try to return something useful
    try {
      const [users] = await db.query(
        'SELECT username FROM vault_users WHERE id = ?',
        [userId]
      );
      if (users.length > 0) {
        return {
          staffId: null,
          staffName: users[0].username,
          staffUsername: users[0].username
        };
      }
    } catch (err) {
      // If even this fails, return null
    }
    return null;
  }
}

/**
 * Log an audit entry to audit_logs table
 * @param {Object} options - Audit log options
 * @param {number} options.staffId - Staff ID (optional)
 * @param {string} options.staffName - Staff name (optional)
 * @param {string} options.staffUsername - Staff username (optional)
 * @param {string} options.action - Action type (e.g., 'LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'VIEW')
 * @param {string} options.entityType - Entity type (e.g., 'USER', 'CLIENT', 'REQUEST', 'VAULT')
 * @param {number} options.entityId - Entity ID (optional)
 * @param {string} options.details - Additional details (optional, can be JSON string or text)
 * @param {string} options.ipAddress - IP address
 * @param {string} options.userAgent - User agent string
 */
async function logAudit({
  staffId = null,
  staffName = null,
  staffUsername = null,
  action,
  entityType = null,
  entityId = null,
  details = null,
  ipAddress = null,
  userAgent = null
}) {
  try {
    // Ensure staff_name and staff_username are always populated
    // Try to extract from details if not provided
    let extractedUsername = null;
    if ((!staffName && !staffUsername) && details) {
      try {
        const detailsObj = typeof details === 'string' ? JSON.parse(details) : details;
        if (detailsObj.username) {
          extractedUsername = detailsObj.username;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    // Use provided values or extracted username, but never use 'Unknown'
    const finalStaffName = staffName || staffUsername || extractedUsername || null;
    const finalStaffUsername = staffUsername || extractedUsername || null;
    
    // Only log if we have at least staff_username (should always be provided)
    await db.query(
      `INSERT INTO audit_logs (
        staff_id, staff_name, staff_username, action, entity_type, entity_id,
        details, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        staffId,
        finalStaffName, // Should always be populated (username as fallback)
        finalStaffUsername, // Should always be populated
        action,
        entityType,
        entityId,
        details,
        ipAddress,
        userAgent
      ]
    );
  } catch (error) {
    // Don't throw errors for audit logging failures to avoid breaking the main flow
    console.error('Error logging audit:', error);
  }
}

/**
 * Extract user information from request
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Staff/user information
 */
async function getStaffFromRequest(req) {
  let userId = null;
  let username = null;

  // Try to get from JWT token (from auth middleware)
  if (req.user) {
    userId = req.user.userId || req.user.id;
    username = req.user.username;
  }

  // Try to decode JWT token from Authorization header if req.user is not set
  if (!userId || !username) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        userId = decoded.userId || decoded.id || userId;
        username = decoded.username || username;
      } catch (tokenError) {
        // Token invalid or expired, continue without it
      }
    }
  }

  // Try to get from headers (if passed manually)
  if (!userId && req.headers['x-user-id']) {
    userId = parseInt(req.headers['x-user-id']);
  }
  if (!username && req.headers['x-username']) {
    username = req.headers['x-username'];
  }

  // If we have userId but no username, get it from database
  if (userId && !username) {
    try {
      const [users] = await db.query(
        'SELECT username FROM vault_users WHERE id = ?',
        [userId]
      );
      if (users.length > 0) {
        username = users[0].username;
      }
    } catch (err) {
      console.error('Error getting username from vault_users:', err);
    }
  }

  // Get staff info from user ID
  if (userId) {
    // Ensure we have username - fetch from database if not already got it
    if (!username) {
      try {
        const [users] = await db.query(
          'SELECT username FROM vault_users WHERE id = ?',
          [userId]
        );
        if (users.length > 0) {
          username = users[0].username;
        }
      } catch (err) {
        console.error('Error fetching username in getStaffFromRequest:', err);
      }
    }
    
    const staffInfo = await getStaffInfo(userId);
    if (staffInfo && staffInfo.staffUsername) {
      // Ensure all fields are populated
      return {
        staffId: staffInfo.staffId,
        staffName: staffInfo.staffName || staffInfo.staffUsername || username,
        staffUsername: staffInfo.staffUsername || username
      };
    }
    
    // If no staff info but we have username, use it
    if (username) {
      return {
        staffId: staffInfo?.staffId || null,
        staffName: staffInfo?.staffName || username, // Use username as staff_name if no staff record
        staffUsername: username // Always populate staff_username
      };
    }
  }

  // If we have username but no userId, still log it
  if (username) {
    return {
      staffId: null,
      staffName: username, // Use username as staff_name
      staffUsername: username
    };
  }

  // Last resort - try to get username from request body (for login attempts)
  if (req.body && req.body.username) {
    return {
      staffId: null,
      staffName: req.body.username,
      staffUsername: req.body.username
    };
  }

  // Final fallback - return null values (logAudit will handle this)
  return {
    staffId: null,
    staffName: null,
    staffUsername: null
  };
}

/**
 * Get IP address from request
 * @param {Object} req - Express request object
 * @returns {string} - IP address
 */
function getIpAddress(req) {
  return req.ip || 
         req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         null;
}

module.exports = {
  logAudit,
  getStaffFromRequest,
  getStaffInfo,
  getIpAddress
};
