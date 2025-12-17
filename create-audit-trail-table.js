const db = require('./database/db');

async function createAuditLogsTable() {
  try {
    await db.query(`
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
    `);
    console.log('✅ Audit logs table created successfully');
  } catch (error) {
    console.error('❌ Error creating audit logs table:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createAuditLogsTable()
    .then(() => {
      console.log('Audit logs setup complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Audit logs setup failed:', error);
      process.exit(1);
    });
}

module.exports = createAuditLogsTable;
