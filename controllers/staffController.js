const db = require('../database/db');

const staffController = {
  getAllStaff: async (req, res) => {
    try {
      const [staff] = await db.query(`
        SELECT id, name, phone, role_id, role, empl_no, id_no, photo_url, status, created_at, updated_at
        FROM staff
        ORDER BY name ASC
      `);
      res.json(staff || []);
    } catch (error) {
      console.error('Error in getAllStaff:', error);
      res.status(500).json({ message: 'Error fetching staff list' });
    }
  },

  getStaffById: async (req, res) => {
    try {
      const [staff] = await db.query(
        'SELECT id, name, phone, role_id, role, empl_no, id_no, photo_url, status, created_at, updated_at FROM staff WHERE id = ?',
        [req.params.id]
      );
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
    const { name, phone, empl_no, id_no, role, photo_url } = req.body;
    try {
      const [result] = await db.query(
        'INSERT INTO staff (name, phone, empl_no, id_no, role, photo_url, status) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [name, phone || null, empl_no, id_no || null, role, photo_url || null]
      );
      const [rows] = await db.query(
        'SELECT id, name, phone, role_id, role, empl_no, id_no, photo_url, status, created_at, updated_at FROM staff WHERE id = ?',
        [result.insertId]
      );
      res.status(201).json(rows[0]);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'A staff member with that employee number already exists' });
      }
      console.error('Error creating staff member:', error);
      res.status(500).json({ message: 'Error creating staff member' });
    }
  },

  updateStaff: async (req, res) => {
    const { name, phone, empl_no, id_no, role, photo_url } = req.body;
    try {
      await db.query(
        'UPDATE staff SET name = ?, phone = ?, empl_no = ?, id_no = ?, role = ?, photo_url = ? WHERE id = ?',
        [name, phone || null, empl_no, id_no || null, role, photo_url || null, req.params.id]
      );
      const [rows] = await db.query(
        'SELECT id, name, phone, role_id, role, empl_no, id_no, photo_url, status, created_at, updated_at FROM staff WHERE id = ?',
        [req.params.id]
      );
      if (rows.length === 0) return res.status(404).json({ message: 'Staff member not found' });
      res.json(rows[0]);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'A staff member with that employee number already exists' });
      }
      console.error('Error updating staff member:', error);
      res.status(500).json({ message: 'Error updating staff member' });
    }
  },

  deleteStaff: async (req, res) => {
    try {
      const [result] = await db.query('DELETE FROM staff WHERE id = ?', [req.params.id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Staff member not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting staff member:', error);
      res.status(500).json({ message: 'Error deleting staff member' });
    }
  },

  updateStaffStatus: async (req, res) => {
    const { status } = req.body;
    try {
      const [result] = await db.query('UPDATE staff SET status = ? WHERE id = ?', [status, req.params.id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Staff member not found' });
      }
      const [rows] = await db.query(
        'SELECT id, name, phone, role_id, role, empl_no, id_no, photo_url, status, created_at, updated_at FROM staff WHERE id = ?',
        [req.params.id]
      );
      res.json(rows[0]);
    } catch (error) {
      console.error('Error updating staff status:', error);
      res.status(500).json({ message: 'Error updating staff status' });
    }
  }
};

module.exports = staffController;
