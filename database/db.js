const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bm_admin_db',
  waitForConnections: true,
  connectionLimit: 50, // Increased from 10 to handle more concurrent requests
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Connection pool optimizations
  acquireTimeout: 60000,
  timeout: 60000,
  // Query optimizations
  multipleStatements: false,
  // Performance tuning
  reconnect: true
});

// Test database connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Successfully connected to MySQL database');
  connection.release();
});

// Enhanced promise pool with better error handling
const promisePool = pool.promise();

// Add query optimization wrapper
promisePool.query = (function(originalQuery) {
  return function(sql, params) {
    const startTime = Date.now();
    return originalQuery.call(this, sql, params).then((result) => {
      const duration = Date.now() - startTime;
      // Log slow queries (over 1000ms) in development
      if (process.env.NODE_ENV === 'development' && duration > 1000) {
        console.warn(`Slow query detected (${duration}ms):`, sql.substring(0, 100));
      }
      return result;
    });
  };
})(promisePool.query);

module.exports = promisePool; 