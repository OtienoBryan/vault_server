const db = require('../database/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logAudit, getStaffInfo, getIpAddress } = require('../utils/auditLogger');

const login = async (req, res) => {
  let user = null;
  const ipAddress = getIpAddress(req);
  const userAgent = req.headers['user-agent'] || null;
  
  try {
    const { username, password } = req.body;

    // Get user from database
    const [users] = await db.query(
      'SELECT * FROM vault_users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      // Log failed login attempt
      await logAudit({
        staffId: null,
        staffName: null,
        staffUsername: username,
        action: 'LOGIN_FAILED',
        entityType: 'AUTH',
        entityId: null,
        details: JSON.stringify({ reason: 'Invalid username', username }),
        ipAddress,
        userAgent
      });
      
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    user = users[0];

    // Compare password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      // Log failed login attempt
      await logAudit({
        staffId: null,
        staffName: null,
        staffUsername: username,
        action: 'LOGIN_FAILED',
        entityType: 'AUTH',
        entityId: user.id,
        details: JSON.stringify({ reason: 'Invalid password', username }),
        ipAddress,
        userAgent
      });
      
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Get staff info for audit log
    const staffInfo = await getStaffInfo(user.id);

    // Create JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        username: user.username,
        role: user.role 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Log successful login - ensure staff_name is always populated
    await logAudit({
      staffId: staffInfo?.staffId || null,
      staffName: staffInfo?.staffName || user.username, // Use username as staff_name if no staff record
      staffUsername: staffInfo?.staffUsername || user.username, // Always use username
      action: 'LOGIN',
      entityType: 'AUTH',
      entityId: user.id,
      details: JSON.stringify({ username: user.username, role: user.role }),
      ipAddress,
      userAgent
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    
    // Log login error - ensure staff_name is always populated
    if (user) {
      const staffInfo = await getStaffInfo(user.id);
      await logAudit({
        staffId: staffInfo?.staffId || null,
        staffName: staffInfo?.staffName || user.username, // Use username as staff_name if no staff record
        staffUsername: staffInfo?.staffUsername || user.username, // Always use username
        action: 'LOGIN_ERROR',
        entityType: 'AUTH',
        entityId: user.id,
        details: JSON.stringify({ error: error.message }),
        ipAddress,
        userAgent
      });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email } = req.body;
    if (!username || !email) {
      return res.status(400).json({ message: 'Username and email are required' });
    }
    const [result] = await db.query(
      'UPDATE vault_users SET username = ?, email = ? WHERE id = ?',
      [username, email, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    // Return the updated user
    const [users] = await db.query('SELECT id, username, email, role FROM vault_users WHERE id = ?', [id]);
    res.json({ user: users[0] });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const changePassword = async (req, res) => {
  const ipAddress = getIpAddress(req);
  const userAgent = req.headers['user-agent'] || null;
  
  try {
    const { id } = req.params;
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Old and new passwords are required' });
    }
    // Get user
    const [users] = await db.query('SELECT * FROM vault_users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const user = users[0];
    
    // Get staff info for audit log
    const staffInfo = await getStaffInfo(user.id);
    
    // Check old password
    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) {
      // Log failed password change attempt - ensure staff_name is always populated
      await logAudit({
        staffId: staffInfo?.staffId || null,
        staffName: staffInfo?.staffName || user.username, // Use username as staff_name if no staff record
        staffUsername: staffInfo?.staffUsername || user.username, // Always use username
        action: 'PASSWORD_CHANGE_FAILED',
        entityType: 'USER',
        entityId: user.id,
        details: JSON.stringify({ reason: 'Invalid old password' }),
        ipAddress,
        userAgent
      });
      
      return res.status(401).json({ message: 'Old password is incorrect' });
    }
    // Hash new password
    const hashed = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE vault_users SET password = ? WHERE id = ?', [hashed, id]);
    
    // Log successful password change
    await logAudit({
      staffId: staffInfo?.staffId || null,
      staffName: staffInfo?.staffName || null,
      staffUsername: staffInfo?.staffUsername || user.username,
      action: 'PASSWORD_CHANGE',
      entityType: 'USER',
      entityId: user.id,
      details: JSON.stringify({ username: user.username }),
      ipAddress,
      userAgent
    });
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const logout = async (req, res) => {
  const ipAddress = getIpAddress(req);
  const userAgent = req.headers['user-agent'] || null;
  
  try {
    // Try to get user from token if available
    let userId = null;
    let username = null;
    
    // Try to decode JWT token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        userId = decoded.userId || decoded.id;
        username = decoded.username;
      } catch (tokenError) {
        // Token is invalid or expired, but we'll still log the logout attempt
        console.log('Token validation failed during logout (expected if token expired):', tokenError.message);
      }
    }
    
    // Also try from req.user if middleware set it
    if (!userId && req.user) {
      userId = req.user.userId || req.user.id;
      username = req.user.username || username;
    }
    
    // Get staff info for audit log
    let staffInfo = null;
    if (userId) {
      staffInfo = await getStaffInfo(userId);
    }
    
    // Log logout - ensure staff_name is always populated
    await logAudit({
      staffId: staffInfo?.staffId || null,
      staffName: staffInfo?.staffName || username || null, // Use username as staff_name if no staff record
      staffUsername: staffInfo?.staffUsername || username || null, // Always use username
      action: 'LOGOUT',
      entityType: 'AUTH',
      entityId: userId,
      details: JSON.stringify({ username: username || 'unknown' }),
      ipAddress,
      userAgent
    });
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    // Still return success even if logging fails
    res.json({ message: 'Logged out successfully' });
  }
};

module.exports = {
  login,
  updateUser,
  changePassword,
  logout
}; 