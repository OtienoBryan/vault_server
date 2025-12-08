const db = require('../database/db');

const staffController = {
  getAllStaff: async (req, res) => {
    try {
      // Optimized query - only select needed columns
      const [staff] = await db.query(`
        SELECT id, name, email, phone, role_id, branch_id, created_at, updated_at 
        FROM staff 
        ORDER BY created_at DESC
      `);

      res.json(staff || []);
    } catch (error) {
      console.error('Error in getAllStaff:', error);
      res.status(500).json({ 
        message: 'Error fetching staff list',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  getStaffById: async (req, res) => {
    try {
      const [staff] = await db.query('SELECT * FROM staff WHERE id = ?', [req.params.id]);
      
      if (staff.length === 0) {
        return res.status(404).json({ message: 'Staff member not found' });
      }
      
      res.json(staff[0]);
    } catch (error) {
      console.error('Error fetching staff member:', error);
      res.status(500).json({ message: 'Error fetching staff member' });
    }
  },

  createStaff: async (req, res) => {
    const { name, photo_url, empl_no, id_no, role } = req.body;
    
    try {
      const [result] = await db.query(
        'INSERT INTO staff (name, photo_url, empl_no, id_no, role) VALUES (?, ?, ?, ?, ?)',
        [name, photo_url, empl_no, id_no, role]
      );
      
      res.status(201).json({
        id: result.insertId,
        name,
        photo_url,
        empl_no,
        id_no,
        role
      });
    } catch (error) {
      console.error('Error creating staff member:', error);
      res.status(500).json({ message: 'Error creating staff member' });
    }
  },

  updateStaff: async (req, res) => {
    const { name, photo_url, empl_no, id_no, role } = req.body;
    
    try {
      await db.query(
        'UPDATE staff SET name = ?, photo_url = ?, empl_no = ?, id_no = ?, role = ? WHERE id = ?',
        [name, photo_url, empl_no, id_no, role, req.params.id]
      );
      
      res.json({
        id: parseInt(req.params.id),
        name,
        photo_url,
        empl_no,
        id_no,
        role
      });
    } catch (error) {
      console.error('Error updating staff member:', error);
      res.status(500).json({ message: 'Error updating staff member' });
    }
  },

  deleteStaff: async (req, res) => {
    try {
      await db.query('DELETE FROM staff WHERE id = ?', [req.params.id]);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting staff member:', error);
      res.status(500).json({ message: 'Error deleting staff member' });
    }
  },

  updateStaffStatus: async (req, res) => {
    const { status } = req.body;
    const staffId = req.params.id;
    
    try {
      console.log('Updating staff status:', { staffId, status });
      
      // First check if staff exists
      const [existingStaff] = await db.query('SELECT * FROM staff WHERE id = ?', [staffId]);
      
      if (existingStaff.length === 0) {
        return res.status(404).json({ message: 'Staff member not found' });
      }
      
      // Update the status
      await db.query(
        'UPDATE staff SET status = ? WHERE id = ?',
        [status, staffId]
      );
      
      // Get the updated staff record
      const [updatedStaff] = await db.query('SELECT * FROM staff WHERE id = ?', [staffId]);
      
      console.log('Staff status updated successfully:', updatedStaff[0]);
      res.json(updatedStaff[0]);
    } catch (error) {
      console.error('Error updating staff status:', error);
      res.status(500).json({ 
        message: 'Error updating staff status',
        error: error.message 
      });
    }
  }
};

module.exports = staffController; 