const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Get user from database
    const [users] = await db.query(
      'SELECT * FROM vault_users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];

    // Compare password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

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
    // Check old password
    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Old password is incorrect' });
    }
    // Hash new password
    const hashed = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE vault_users SET password = ? WHERE id = ?', [hashed, id]);
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  login,
  updateUser,
  changePassword
}; 