const express = require('express');
const cors = require('cors');
// Compression is optional - install with: npm install compression
let compression;
try {
  compression = require('compression');
} catch (e) {
  console.log('Compression module not found. Install with: npm install compression');
}
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database/db');
const staffController = require('./controllers/staffController');
const roleController = require('./controllers/roleController');
const { upload } = require('./config/cloudinary');
const uploadController = require('./controllers/uploadController');
const teamController = require('./controllers/teamController');
const clientController = require('./controllers/clientController');
const branchController = require('./controllers/branchController');
const atmController = require('./controllers/atmController');
const serviceChargeController = require('./controllers/serviceChargeController');
const noticeController = require('./controllers/noticeController');
const cashCountController = require('./controllers/cashCountController');
const vaultController = require('./controllers/vaultController');
const cashProcessingController = require('./controllers/cashProcessingController');
const cashinTransactionController = require('./controllers/cashinTransactionController');
const processingChargesController = require('./controllers/processingChargesController');
const processingFeeController = require('./controllers/processingFeeController');
const clientUpdateController = require('./controllers/clientUpdateController');
const atmLoadingTableController = require('./controllers/atmLoadingTableController');
const authController = require('./controllers/authController');
const auditController = require('./controllers/auditController');
const auditMiddleware = require('./middleware/auditMiddleware');
const vehicleModelController = require('./controllers/vehicleModelController');
const vehicleController = require('./controllers/vehicleController');
require('dotenv').config();

const app = express();

// Performance optimizations
// Enable compression for all responses (if module is installed)
if (compression) {
  app.use(compression({
    level: 6, // Balance between compression and CPU usage
    threshold: 1024, // Only compress responses larger than 1KB
    filter: (req, res) => {
      // Don't compress if client doesn't support it
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));
  console.log('Response compression enabled');
} else {
  console.log('Response compression disabled (compression module not installed)');
}

// CORS: allow all origins for debugging
app.use(cors({ origin: true, credentials: true }));

// Increase JSON payload limit for large requests
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Audit middleware - log all requests (must be after body parsing middleware)
app.use(auditMiddleware);

// Add response time header for monitoring
app.use((req, res, next) => {
  const start = Date.now();
  // Set header before response is sent
  res.once('finish', () => {
    // Only log in development, don't set header to avoid conflicts
    if (process.env.NODE_ENV === 'development') {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.path} - ${duration}ms`);
    }
  });
  next();
});

// Helper function to map database fields to frontend fields
const mapRequestFields = (request) => ({
  id: request.id,
  userId: request.user_id,
  userName: request.user_name,
  serviceTypeId: request.service_type_id,
  serviceTypeName: request.service_type_name,
  pickupLocation: request.pickup_location,
  deliveryLocation: request.delivery_location,
  pickupDate: request.pickup_date,
  description: request.description,
  priority: request.priority,
  status: request.status,
  myStatus: request.my_status,
  branchId: request.branch_id,
  branchName: request.branch_name,
  clientId: request.client_id,
  teamId: request.team_id,
  staffId: request.staff_id,
  price: request.price,
  latitude: request.latitude,
  longitude: request.longitude,
  createdAt: request.created_at,
  updatedAt: request.updated_at
});

// Auth routes
app.post('/api/auth/login', authController.login);
app.post('/api/auth/logout', authController.logout);
app.put('/api/users/:id', authController.updateUser);
app.put('/api/users/:id/password', authController.changePassword);

// Audit logs routes
app.get('/api/audit-logs', auditController.getAllAuditLogs);
app.get('/api/audit-logs/:id', auditController.getAuditLogById);
app.get('/api/audit-logs/staff/:staffId', auditController.getAuditLogsByStaff);
app.get('/api/audit-logs/action/:action', auditController.getAuditLogsByAction);

// Service Types routes
app.get('/api/service-types', async (req, res) => {
  try {
    // Optimized: select specific columns
    const [serviceTypes] = await db.query(
      'SELECT id, name, description, created_at, updated_at FROM service_types ORDER BY name'
    );
    res.json(serviceTypes);
  } catch (error) {
    console.error('Error fetching service types:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/service-types/:id', async (req, res) => {
  try {
    // Optimized: select specific columns
    const [serviceTypes] = await db.query(
      'SELECT id, name, description, created_at, updated_at FROM service_types WHERE id = ?',
      [req.params.id]
    );

    if (serviceTypes.length === 0) {
      return res.status(404).json({ message: 'Service type not found' });
    }

    res.json(serviceTypes[0]);
  } catch (error) {
    console.error('Error fetching service type:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Requests routes
app.get('/api/requests', async (req, res) => {
  try {
    const { status, myStatus, limit, offset } = req.query;
    // Optimized: select specific columns instead of r.*
    // Note: client_id comes from branches table, not requests table
    let query = `
      SELECT 
        r.id, r.user_id, r.user_name, r.service_type_id, r.pickup_location, 
        r.delivery_location, r.pickup_date, r.description, r.priority, 
        r.status, r.my_status, r.branch_id, r.team_id, r.staff_id, r.atm_id,
        r.price, r.latitude, r.longitude, r.created_at, r.updated_at,
        b.name as branch_name,
        b.client_id,
        st.name as service_type_name
      FROM requests r
      LEFT JOIN branches b ON r.branch_id = b.id
      LEFT JOIN service_types st ON r.service_type_id = st.id
    `;
    const params = [];

    // Add filters if provided
    if (status || myStatus !== undefined) {
      query += ' WHERE';
      if (status) {
        query += ' r.status = ?';
        params.push(status);
      }
      if (myStatus !== undefined) {
        if (status) query += ' AND';
        query += ' r.my_status = ?';
        params.push(myStatus);
      }
    }

    query += ' ORDER BY r.created_at DESC';
    
    // Add pagination
    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit) || 100);
      if (offset) {
        query += ' OFFSET ?';
        params.push(parseInt(offset) || 0);
      }
    }
    
    const [requests] = await db.query(query, params);
    res.json(requests.map(mapRequestFields));
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [requests] = await db.query(`
      SELECT r.*, b.name as branch_name, b.client_id
      FROM requests r
      LEFT JOIN branches b ON r.branch_id = b.id
      WHERE r.id = ?
    `, [id]);

    if (requests.length === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }

    res.json(mapRequestFields(requests[0]));
  } catch (error) {
    console.error('Error fetching request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/requests', async (req, res) => {
  try {
    const { 
      userId, 
      userName, 
      serviceTypeId,
      pickupLocation, 
      deliveryLocation, 
      pickupDate, 
      description, 
      priority,
      myStatus = 0,
      branchId,
      teamId,
      staffId,
      atmId,
      price,
      latitude,
      longitude
    } = req.body;

    console.log('Received request data:', {
      userId,
      userName,
      serviceTypeId,
      pickupLocation,
      deliveryLocation,
      pickupDate,
      description,
      priority,
      myStatus,
      branchId,
      teamId,
      staffId,
      atmId,
      price,
      latitude,
      longitude
    });

    // Validate required fields
    if (!userId || !userName || !serviceTypeId || !pickupLocation || !deliveryLocation || !pickupDate || !branchId || !price) {
      console.log('Missing required fields:', {
        userId: !userId,
        userName: !userName,
        serviceTypeId: !serviceTypeId,
        pickupLocation: !pickupLocation,
        deliveryLocation: !deliveryLocation,
        pickupDate: !pickupDate,
        branchId: !branchId,
        price: !price
      });
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if service type exists
    const [serviceTypes] = await db.query(
      'SELECT id FROM service_types WHERE id = ?',
      [serviceTypeId]
    );

    if (serviceTypes.length === 0) {
      console.error('Service type not found:', serviceTypeId);
      return res.status(400).json({ message: 'Invalid service type' });
    }

    // Check if user exists
    const [users] = await db.query(
      'SELECT id FROM vault_users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      console.error('User not found:', userId);
      return res.status(400).json({ message: 'Invalid user' });
    }

    // Check if branch exists
    const [branches] = await db.query(
      'SELECT id FROM branches WHERE id = ?',
      [branchId]
    );

    if (branches.length === 0) {
      console.error('Branch not found:', branchId);
      return res.status(400).json({ message: 'Invalid branch' });
    }

    // Check if ATM exists (if atmId is provided)
    if (atmId) {
      const [atms] = await db.query(
        'SELECT id FROM atms WHERE id = ?',
        [atmId]
      );

      if (atms.length === 0) {
        console.error('ATM not found:', atmId);
        return res.status(400).json({ message: 'Invalid ATM' });
      }
    }

    // Insert the request with price, coordinates, and ATM ID
    const [result] = await db.query(
      `INSERT INTO requests (
        user_id, user_name, service_type_id, branch_id, team_id, staff_id, atm_id,
        pickup_location, delivery_location, pickup_date, 
        description, priority, status, my_status, price,
        latitude, longitude
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, userName, serviceTypeId, branchId, teamId || null, staffId || null, atmId || null,
        pickupLocation, deliveryLocation, pickupDate,
        description || null, priority || 'medium', 'pending', myStatus, price,
        latitude || null, longitude || null
      ]
    );

    // Fetch the created request with service type name
    const [requests] = await db.query(
      `SELECT r.*, b.name as branch_name, st.name as service_type_name
       FROM requests r
       LEFT JOIN branches b ON r.branch_id = b.id
       LEFT JOIN service_types st ON r.service_type_id = st.id
       WHERE r.id = ?`,
      [result.insertId]
    );

    res.status(201).json(mapRequestFields(requests[0]));
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ message: 'Error creating request', error: error.message });
  }
});

app.patch('/api/requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // If teamId is being updated, fetch the crew_commander_id from the team
    let staffIdToUpdate = updates.staffId;
    if (updates.teamId) {
      try {
        const [teamRows] = await db.query(
          'SELECT crew_commander_id FROM teams WHERE id = ?',
          [updates.teamId]
        );
        
        if (teamRows.length > 0 && teamRows[0].crew_commander_id) {
          staffIdToUpdate = teamRows[0].crew_commander_id;
          console.log(`Auto-assigning crew commander ID ${staffIdToUpdate} for team ${updates.teamId}`);
        } else {
          console.log(`Warning: Team ${updates.teamId} has no crew commander assigned`);
        }
      } catch (error) {
        console.error('Error fetching crew commander ID:', error);
        // Continue with the original staffId if there's an error
      }
    }

    // Map frontend field names to database field names
    const dbUpdates = {
      user_name: updates.userName,
      service_type_id: updates.serviceTypeId,
      pickup_location: updates.pickupLocation,
      delivery_location: updates.deliveryLocation,
      pickup_date: updates.pickupDate,
      description: updates.description,
      priority: updates.priority,
      status: updates.status,
      my_status: updates.myStatus,
      team_id: updates.teamId,
      staff_id: staffIdToUpdate,
      atm_id: updates.atmId,
      latitude: updates.latitude,
      longitude: updates.longitude
    };

    // Remove undefined values
    Object.keys(dbUpdates).forEach(key => 
      dbUpdates[key] === undefined && delete dbUpdates[key]
    );

    // Build the SET clause dynamically based on provided updates
    const setClause = Object.keys(dbUpdates)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = [...Object.values(dbUpdates), id];

    await db.query(
      `UPDATE requests SET ${setClause} WHERE id = ?`,
      values
    );

    // Get the updated request with service type name
    const [requests] = await db.query(
      `SELECT r.*, b.name as branch_name, st.name as service_type_name
       FROM requests r
       LEFT JOIN branches b ON r.branch_id = b.id
       LEFT JOIN service_types st ON r.service_type_id = st.id
       WHERE r.id = ?`,
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }

    res.json(mapRequestFields(requests[0]));
  } catch (error) {
    console.error('Error updating request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Requests routes
app.get('/api/runs/summaries', async (req, res) => {
  try {
    const { year, month, clientId, branchId } = req.query;
    let query = `
      SELECT 
        DATE_FORMAT(pickup_date, '%Y-%m-%d') as date,
        COUNT(*) as totalRuns,
        SUM(price) as totalAmount
      FROM requests r
      LEFT JOIN branches b ON r.branch_id = b.id
      WHERE r.my_status = 3
    `;
    const params = [];

    if (year) {
      query += ' AND YEAR(r.pickup_date) = ?';
      params.push(year);
    }

    if (month) {
      query += ' AND MONTH(r.pickup_date) = ?';
      params.push(month);
    }

    if (clientId) {
      query += ' AND b.client_id = ?';
      params.push(clientId);
    }

    if (branchId) {
      query += ' AND r.branch_id = ?';
      params.push(branchId);
    }

    query += `
      GROUP BY DATE_FORMAT(r.pickup_date, '%Y-%m-%d')
      ORDER BY date DESC
    `;

    const [summaries] = await db.query(query, params);
    res.json(summaries);
  } catch (error) {
    console.error('Error fetching run summaries:', error);
    res.status(500).json({ message: 'Error fetching run summaries', error: error.message });
  }
});

app.get('/api/runs/monthly-summaries', async (req, res) => {
  try {
    const { year, clientId, branchId } = req.query;
    let query = `
      SELECT
        MONTH(r.pickup_date) as month,
        COUNT(*) as totalRuns,
        SUM(price) as totalAmount
      FROM requests r
      LEFT JOIN branches b ON r.branch_id = b.id
      WHERE r.my_status = 3
    `;
    const params = [];

    if (year) {
      query += ' AND YEAR(r.pickup_date) = ?';
      params.push(year);
    }

    if (clientId) {
      query += ' AND b.client_id = ?';
      params.push(clientId);
    }

    if (branchId) {
      query += ' AND r.branch_id = ?';
      params.push(branchId);
    }

    query += `
      GROUP BY MONTH(r.pickup_date)
      ORDER BY month ASC
    `;

    const [summaries] = await db.query(query, params);
    res.json(summaries);
  } catch (error) {
    console.error('Error fetching monthly run summaries:', error);
    res.status(500).json({ message: 'Error fetching monthly run summaries', error: error.message });
  }
});

// Run Done endpoint - Get unique pickup dates with total charges
app.get('/api/runs/done', async (req, res) => {
  try {
    const { startDate, endDate, clientId } = req.query;
    
    let query = `
      SELECT 
        DATE_FORMAT(r.pickup_date, '%Y-%m-%d') as pickup_date,
        COUNT(*) as total_runs,
        SUM(r.price) as total_charges
      FROM requests r
      LEFT JOIN branches b ON r.branch_id = b.id
      WHERE r.my_status = 3
    `;
    const params = [];

    // Add date filters
    if (startDate) {
      query += ' AND DATE(r.pickup_date) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND DATE(r.pickup_date) <= ?';
      params.push(endDate);
    }
    
    // Add client filter
    if (clientId) {
      query += ' AND b.client_id = ?';
      params.push(clientId);
    }

    query += `
      GROUP BY DATE_FORMAT(r.pickup_date, '%Y-%m-%d')
      ORDER BY pickup_date DESC
    `;
    
    const [results] = await db.query(query, params);
    res.json(results);
  } catch (error) {
    console.error('Error fetching run done data:', error);
    res.status(500).json({ message: 'Error fetching run done data', error: error.message });
  }
});

// Staff routes
app.get('/api/staff', staffController.getAllStaff);
app.get('/api/staff/:id', staffController.getStaffById);
app.post('/api/staff', staffController.createStaff);
app.put('/api/staff/:id', staffController.updateStaff);
app.delete('/api/staff/:id', staffController.deleteStaff);
app.put('/api/staff/:id/status', staffController.updateStaffStatus);

// Roles routes
app.get('/api/roles', roleController.getAllRoles);

// Upload routes
app.post('/api/upload', upload.single('photo'), uploadController.uploadImage);

// Team routes
app.post('/api/teams', teamController.createTeam);
app.get('/api/teams', teamController.getTeams);
app.get('/api/teams/:id', teamController.getTeamById);
app.delete('/api/teams/:id', teamController.deleteTeam);
app.post('/api/teams/:id/vehicles', teamController.assignVehicle);
app.delete('/api/teams/:id/vehicles/:vehicleId', teamController.removeVehicle);

app.get('/api/teams/:id/requests', async (req, res) => {
  try {
    const [requests] = await db.query(
      `SELECT
         r.id, r.user_id, r.user_name, r.service_type_id, r.pickup_location,
         r.delivery_location, r.pickup_date, r.description, r.priority,
         r.status, r.my_status, r.branch_id, r.team_id, r.staff_id, r.atm_id,
         r.price, r.latitude, r.longitude, r.created_at, r.updated_at,
         b.name AS branch_name,
         b.client_id,
         st.name AS service_type_name
       FROM requests r
       LEFT JOIN branches b ON r.branch_id = b.id
       LEFT JOIN service_types st ON r.service_type_id = st.id
       WHERE r.team_id = ?
       ORDER BY r.pickup_date DESC`,
      [req.params.id]
    );
    res.json(requests.map(mapRequestFields));
  } catch (error) {
    console.error('Error fetching team requests:', error);
    res.status(500).json({ message: 'Error fetching team requests' });
  }
});

// Client routes
app.get('/api/clients', clientController.getAllClients);
app.get('/api/clients/:id', clientController.getClient);
app.post('/api/clients', clientController.createClient);
app.put('/api/clients/:id', clientController.updateClient);
app.delete('/api/clients/:id', clientController.deleteClient);
app.get('/api/branches', branchController.getAllBranchesWithoutClient);
app.get('/api/clients/:clientId/branches', branchController.getAllBranches);
app.post('/api/clients/:clientId/branches', branchController.createBranch);
app.put('/api/clients/:clientId/branches/:branchId', branchController.updateBranch);
app.delete('/api/clients/:clientId/branches/:branchId', branchController.deleteBranch);
app.get('/api/clients/:clientId/service-charges', serviceChargeController.getServiceCharges);
app.post('/api/clients/:clientId/service-charges', serviceChargeController.createServiceCharge);
// Processing fees
app.get('/api/clients/:clientId/processing-fees', processingFeeController.getByClient);
app.post('/api/clients/:clientId/processing-fees', processingFeeController.createProcessingFee);
app.put('/api/clients/:clientId/processing-fees/:feeId', processingFeeController.updateProcessingFee);
app.delete('/api/clients/:clientId/processing-fees/:feeId', processingFeeController.deleteProcessingFee);
app.put('/api/clients/:clientId/service-charges/:chargeId', serviceChargeController.updateServiceCharge);
app.delete('/api/clients/:clientId/service-charges/:chargeId', serviceChargeController.deleteServiceCharge);

// ATM routes
app.get('/api/clients/:clientId/atms', atmController.getAllATMs);
app.post('/api/clients/:clientId/atms', atmController.createATM);
app.put('/api/clients/:clientId/atms/:atmId', atmController.updateATM);
app.delete('/api/clients/:clientId/atms/:atmId', atmController.deleteATM);

// Notice routes
app.get('/api/notices', noticeController.getNotices);
app.post('/api/notices', noticeController.createNotice);
app.patch('/api/notices/:id', noticeController.updateNotice);
app.delete('/api/notices/:id', noticeController.deleteNotice);
app.patch('/api/notices/:id/status', noticeController.toggleNoticeStatus);

// Cash Count routes
app.get('/api/cash-counts', cashCountController.getAllCashCounts);
app.get('/api/cash-counts/:id', cashCountController.getCashCountById);
app.get('/api/requests/:requestId/cash-count', cashCountController.getCashCountByRequestId);
app.post('/api/cash-counts', cashCountController.createCashCount);
app.put('/api/cash-counts/:id', cashCountController.updateCashCount);
app.delete('/api/cash-counts/:id', cashCountController.deleteCashCount);
app.post('/api/cash-counts/:id/decline', cashCountController.declineCashCount);

// Vault routes
app.get('/api/vault/:vaultId/balance', vaultController.getVaultBalance);
app.get('/api/vault/:vaultId/updates', vaultController.getVaultUpdates);
app.post('/api/vault/receive', vaultController.receiveAmount);
app.post('/api/vault/withdraw', vaultController.withdrawAmount);

// Cash Processing routes
app.get('/api/cash-processing', cashProcessingController.getAllCashProcessing);
app.get('/api/cash-processing/:id', cashProcessingController.getCashProcessingById);
app.get('/api/cash-counts/:cashCountId/processing', cashProcessingController.getCashProcessingByCashCountId);
app.post('/api/cash-processing', cashProcessingController.createCashProcessing);

// Cash-In Transactions routes
app.get('/api/cashin-transactions', cashinTransactionController.getAllCashinTransactions);
app.get('/api/cashin-transactions/:id', cashinTransactionController.getCashinTransactionById);

// Processing Charges routes
app.get('/api/processing-charges', processingChargesController.getAllProcessingCharges);
app.get('/api/processing-charges/:id', processingChargesController.getProcessingChargeById);
app.get('/api/processing-charges/cash-processing/:cashProcessingId', processingChargesController.getProcessingChargesByCashProcessingId);
app.post('/api/processing-charges', processingChargesController.createProcessingCharge);
app.put('/api/processing-charges/:id', processingChargesController.updateProcessingCharge);
app.delete('/api/processing-charges/:id', processingChargesController.deleteProcessingCharge);

// Client Update routes
app.get('/api/clients/:clientId/updates', clientUpdateController.getClientUpdates);
app.get('/api/clients/:clientId/balance', clientUpdateController.getClientBalance);
app.get('/api/clients/:clientId/balance-certificate', clientUpdateController.getClientBalanceCertificate);

// ATM Loading routes
app.post('/api/atm-loading', atmLoadingTableController.createATMLoading);
app.get('/api/atm-loading', atmLoadingTableController.getAllATMLoading);
app.get('/api/atm-loading/:id', atmLoadingTableController.getATMLoadingById);
app.get('/api/atm-loading/client/:clientId', atmLoadingTableController.getATMLoadingByClient);
app.get('/api/atm-loading/atm/:atmId', atmLoadingTableController.getATMLoadingByATM);
app.put('/api/atm-loading/:id', atmLoadingTableController.updateATMLoading);
app.delete('/api/atm-loading/:id', atmLoadingTableController.deleteATMLoading);

// Vehicle Model routes
app.get('/api/vehicle-models', vehicleModelController.getAll);
app.post('/api/vehicle-models', vehicleModelController.create);
app.put('/api/vehicle-models/:id', vehicleModelController.update);
app.delete('/api/vehicle-models/:id', vehicleModelController.remove);

// Vehicle routes
app.get('/api/vehicles', vehicleController.getAll);
app.get('/api/vehicles/:id', vehicleController.getById);
app.post('/api/vehicles', vehicleController.create);
app.put('/api/vehicles/:id', vehicleController.update);
app.delete('/api/vehicles/:id', vehicleController.remove);

// Example API endpoint
app.get('/api/test', (req, res) => {
  db.query('SELECT 1 + 1 AS solution')
    .then(([results]) => {
      res.json({ message: 'Database connection successful', results });
    })
    .catch(err => {
      res.status(500).json({ error: err.message });
    });
});
app.get('/test-cors', (req, res) => {
  res.json({ message: 'CORS is working!' });
});
app.get('/',(req, res) => {
  res.send('API IS WORKING');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5005;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error(`Please either:`);
    console.error(`  1. Stop the process using port ${PORT}`);
    console.error(`  2. Set a different port using PORT environment variable (e.g., PORT=5001)`);
    console.error(`\nTo find what's using the port, run:`);
    console.error(`  Windows: netstat -ano | findstr :${PORT}`);
    console.error(`  Mac/Linux: lsof -i :${PORT}\n`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

module.exports = app; 
