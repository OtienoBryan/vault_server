const db = require('../config/database');

const auditController = {
  // Get all audit logs with optional filters
  getAllAuditLogs: async (req, res) => {
    try {
      const { 
        action, 
        entityType, 
        staffId, 
        staffUsername,
        startDate, 
        endDate,
        limit = 100,
        offset = 0
      } = req.query;

      let query = `
        SELECT id, staff_id, staff_name, staff_username, action, entity_type, 
               entity_id, details, ip_address, user_agent, created_at
        FROM audit_logs
        WHERE 1=1
      `;
      const params = [];

      // Add filters
      if (action) {
        query += ' AND action = ?';
        params.push(action);
      }

      if (entityType) {
        query += ' AND entity_type = ?';
        params.push(entityType);
      }

      if (staffId) {
        query += ' AND staff_id = ?';
        params.push(parseInt(staffId));
      }

      if (staffUsername) {
        query += ' AND staff_username = ?';
        params.push(staffUsername);
      }

      if (startDate) {
        query += ' AND created_at >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND created_at <= ?';
        params.push(endDate);
      }

      // Order by most recent first
      query += ' ORDER BY created_at DESC';

      // Add pagination
      query += ' LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const [logs] = await db.query(query, params);

      // Parse details JSON if it exists
      const parsedLogs = logs.map(log => {
        if (log.details) {
          try {
            log.details = JSON.parse(log.details);
          } catch (e) {
            // If parsing fails, keep as string
          }
        }
        return log;
      });

      // Get total count for pagination
      let countQuery = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
      const countParams = [];
      
      if (action) {
        countQuery += ' AND action = ?';
        countParams.push(action);
      }
      if (entityType) {
        countQuery += ' AND entity_type = ?';
        countParams.push(entityType);
      }
      if (staffId) {
        countQuery += ' AND staff_id = ?';
        countParams.push(parseInt(staffId));
      }
      if (staffUsername) {
        countQuery += ' AND staff_username = ?';
        countParams.push(staffUsername);
      }
      if (startDate) {
        countQuery += ' AND created_at >= ?';
        countParams.push(startDate);
      }
      if (endDate) {
        countQuery += ' AND created_at <= ?';
        countParams.push(endDate);
      }

      const [countResult] = await db.query(countQuery, countParams);
      const total = countResult[0].total;

      res.json({
        logs: parsedLogs,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          page: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ message: 'Error fetching audit logs', error: error.message });
    }
  },

  // Get audit log by ID
  getAuditLogById: async (req, res) => {
    try {
      const { id } = req.params;
      const [logs] = await db.query(
        'SELECT * FROM audit_logs WHERE id = ?',
        [id]
      );

      if (logs.length === 0) {
        return res.status(404).json({ message: 'Audit log not found' });
      }

      const log = logs[0];
      
      // Parse details JSON if it exists
      if (log.details) {
        try {
          log.details = JSON.parse(log.details);
        } catch (e) {
          // If parsing fails, keep as string
        }
      }

      res.json(log);
    } catch (error) {
      console.error('Error fetching audit log:', error);
      res.status(500).json({ message: 'Error fetching audit log', error: error.message });
    }
  },

  // Get audit logs by staff ID
  getAuditLogsByStaff: async (req, res) => {
    try {
      const { staffId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const [logs] = await db.query(
        `SELECT * FROM audit_logs 
         WHERE staff_id = ? 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [parseInt(staffId), parseInt(limit), parseInt(offset)]
      );

      // Parse details JSON
      const parsedLogs = logs.map(log => {
        if (log.details) {
          try {
            log.details = JSON.parse(log.details);
          } catch (e) {
            // If parsing fails, keep as string
          }
        }
        return log;
      });

      res.json(parsedLogs);
    } catch (error) {
      console.error('Error fetching audit logs by staff:', error);
      res.status(500).json({ message: 'Error fetching audit logs', error: error.message });
    }
  },

  // Get audit logs by action type
  getAuditLogsByAction: async (req, res) => {
    try {
      const { action } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const [logs] = await db.query(
        `SELECT * FROM audit_logs 
         WHERE action = ? 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [action, parseInt(limit), parseInt(offset)]
      );

      // Parse details JSON
      const parsedLogs = logs.map(log => {
        if (log.details) {
          try {
            log.details = JSON.parse(log.details);
          } catch (e) {
            // If parsing fails, keep as string
          }
        }
        return log;
      });

      res.json(parsedLogs);
    } catch (error) {
      console.error('Error fetching audit logs by action:', error);
      res.status(500).json({ message: 'Error fetching audit logs', error: error.message });
    }
  }
};

module.exports = auditController;


