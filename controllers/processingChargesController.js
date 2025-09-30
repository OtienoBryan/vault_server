const db = require('../database/db');

const processingChargesController = {
  // Get all processing charges
  getAllProcessingCharges: async (req, res) => {
    try {
      const [rows] = await db.query(`
        SELECT 
          pc.*,
          cp.request_id,
          cp.processed_total,
          cp.expected_total
        FROM processing_charges pc
        JOIN cash_processing cp ON pc.cash_processing_id = cp.id
        ORDER BY pc.created_at DESC
      `);
      
      res.json(rows);
    } catch (error) {
      console.error('Error fetching processing charges:', error);
      res.status(500).json({ message: 'Failed to fetch processing charges' });
    }
  },

  // Get processing charges by cash processing ID
  getProcessingChargesByCashProcessingId: async (req, res) => {
    try {
      const { cashProcessingId } = req.params;
      
      const [rows] = await db.query(`
        SELECT 
          pc.*,
          cp.request_id,
          cp.processed_total,
          cp.expected_total
        FROM processing_charges pc
        JOIN cash_processing cp ON pc.cash_processing_id = cp.id
        WHERE pc.cash_processing_id = ?
        ORDER BY pc.created_at DESC
      `, [cashProcessingId]);
      
      res.json(rows);
    } catch (error) {
      console.error('Error fetching processing charges by cash processing ID:', error);
      res.status(500).json({ message: 'Failed to fetch processing charges' });
    }
  },

  // Create processing charge
  createProcessingCharge: async (req, res) => {
    try {
      const {
        cash_processing_id,
        total_amount,
        processing_fee_percentage,
        processing_fee_amount
      } = req.body;

      // Validate required fields
      if (!cash_processing_id || !total_amount || !processing_fee_percentage || !processing_fee_amount) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      // Verify that the cash processing record exists
      const [cashProcessingRows] = await db.query(
        'SELECT id FROM cash_processing WHERE id = ?',
        [cash_processing_id]
      );

      if (cashProcessingRows.length === 0) {
        return res.status(404).json({ message: 'Cash processing record not found' });
      }

      // Insert processing charge record
      const [result] = await db.query(`
        INSERT INTO processing_charges (
          cash_processing_id, total_amount, processing_fee_percentage, processing_fee_amount
        ) VALUES (?, ?, ?, ?)
      `, [cash_processing_id, total_amount, processing_fee_percentage, processing_fee_amount]);

      // Fetch the created record
      const [newRecord] = await db.query(`
        SELECT 
          pc.*,
          cp.request_id,
          cp.processed_total,
          cp.expected_total
        FROM processing_charges pc
        JOIN cash_processing cp ON pc.cash_processing_id = cp.id
        WHERE pc.id = ?
      `, [result.insertId]);

      res.status(201).json(newRecord[0]);
    } catch (error) {
      console.error('Error creating processing charge:', error);
      res.status(500).json({ message: 'Failed to create processing charge' });
    }
  },

  // Get processing charge by ID
  getProcessingChargeById: async (req, res) => {
    try {
      const { id } = req.params;
      
      const [rows] = await db.query(`
        SELECT 
          pc.*,
          cp.request_id,
          cp.processed_total,
          cp.expected_total
        FROM processing_charges pc
        JOIN cash_processing cp ON pc.cash_processing_id = cp.id
        WHERE pc.id = ?
      `, [id]);
      
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Processing charge not found' });
      }
      
      res.json(rows[0]);
    } catch (error) {
      console.error('Error fetching processing charge:', error);
      res.status(500).json({ message: 'Failed to fetch processing charge' });
    }
  },

  // Update processing charge
  updateProcessingCharge: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        total_amount,
        processing_fee_percentage,
        processing_fee_amount
      } = req.body;

      // Validate required fields
      if (!total_amount || !processing_fee_percentage || !processing_fee_amount) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      // Update processing charge record
      await db.query(`
        UPDATE processing_charges 
        SET total_amount = ?, processing_fee_percentage = ?, processing_fee_amount = ?
        WHERE id = ?
      `, [total_amount, processing_fee_percentage, processing_fee_amount, id]);

      // Fetch the updated record
      const [updatedRecord] = await db.query(`
        SELECT 
          pc.*,
          cp.request_id,
          cp.processed_total,
          cp.expected_total
        FROM processing_charges pc
        JOIN cash_processing cp ON pc.cash_processing_id = cp.id
        WHERE pc.id = ?
      `, [id]);

      res.json(updatedRecord[0]);
    } catch (error) {
      console.error('Error updating processing charge:', error);
      res.status(500).json({ message: 'Failed to update processing charge' });
    }
  },

  // Delete processing charge
  deleteProcessingCharge: async (req, res) => {
    try {
      const { id } = req.params;
      
      await db.query('DELETE FROM processing_charges WHERE id = ?', [id]);
      
      res.json({ message: 'Processing charge deleted successfully' });
    } catch (error) {
      console.error('Error deleting processing charge:', error);
      res.status(500).json({ message: 'Failed to delete processing charge' });
    }
  }
};

module.exports = processingChargesController;
