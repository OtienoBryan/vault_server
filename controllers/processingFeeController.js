const db = require('../database/db');

const processingFeeController = {
  getByClient: async (req, res) => {
    try {
      const { clientId } = req.params;
      const [rows] = await db.query(
        `SELECT id, client_id, fee_type, description, amount, is_percentage, is_active, created_at, updated_at
         FROM processing_fees
         WHERE client_id = ?
         ORDER BY created_at DESC`,
        [clientId]
      );
      res.json(rows);
    } catch (error) {
      console.error('Error fetching processing fees:', error);
      res.status(500).json({ message: 'Failed to fetch processing fees', error: error.message });
    }
  },

  updateProcessingFee: async (req, res) => {
    try {
      const { clientId, feeId } = req.params;
      const { fee_type, description, amount, is_percentage, is_active } = req.body;

      // Validate required fields
      if (!fee_type || amount === undefined || amount === null) {
        return res.status(400).json({ message: 'Fee type and amount are required' });
      }

      // Check if processing fee exists and belongs to the client
      const [existingFee] = await db.query(
        'SELECT id FROM processing_fees WHERE id = ? AND client_id = ?',
        [feeId, clientId]
      );

      if (existingFee.length === 0) {
        return res.status(404).json({ message: 'Processing fee not found' });
      }

      // Update the processing fee
      await db.query(
        `UPDATE processing_fees 
         SET fee_type = ?, description = ?, amount = ?, is_percentage = ?, is_active = ?, updated_at = NOW()
         WHERE id = ? AND client_id = ?`,
        [fee_type, description || null, amount, is_percentage ? 1 : 0, is_active ? 1 : 0, feeId, clientId]
      );

      // Fetch the updated processing fee
      const [updatedFee] = await db.query(
        `SELECT id, client_id, fee_type, description, amount, is_percentage, is_active, created_at, updated_at
         FROM processing_fees
         WHERE id = ?`,
        [feeId]
      );

      console.log('Processing fee updated successfully:', updatedFee[0]);
      res.json(updatedFee[0]);
    } catch (error) {
      console.error('Error in updateProcessingFee:', error);
      res.status(500).json({ 
        message: 'Failed to update processing fee',
        error: error.message 
      });
    }
  },

  createProcessingFee: async (req, res) => {
    try {
      const { clientId } = req.params;
      const { fee_type, description, amount, is_percentage, is_active } = req.body;

      // Validate required fields
      if (!fee_type || amount === undefined || amount === null) {
        return res.status(400).json({ message: 'Fee type and amount are required' });
      }

      // Check if a processing fee already exists for this client
      const [existingFees] = await db.query(
        'SELECT id FROM processing_fees WHERE client_id = ?',
        [clientId]
      );

      if (existingFees.length > 0) {
        return res.status(400).json({ 
          message: 'A processing fee already exists for this client. Please update the existing fee instead.' 
        });
      }

      // Insert the new processing fee
      const [result] = await db.query(
        `INSERT INTO processing_fees (client_id, fee_type, description, amount, is_percentage, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [clientId, fee_type, description || null, amount, is_percentage ? 1 : 0, is_active ? 1 : 0]
      );

      // Fetch the created processing fee
      const [newFee] = await db.query(
        `SELECT id, client_id, fee_type, description, amount, is_percentage, is_active, created_at, updated_at
         FROM processing_fees
         WHERE id = ?`,
        [result.insertId]
      );

      console.log('Processing fee created successfully:', newFee[0]);
      res.status(201).json(newFee[0]);
    } catch (error) {
      console.error('Error in createProcessingFee:', error);
      res.status(500).json({ 
        message: 'Failed to create processing fee',
        error: error.message 
      });
    }
  },

  deleteProcessingFee: async (req, res) => {
    try {
      const { clientId, feeId } = req.params;
      console.log('Deleting processing fee:', { clientId, feeId });

      // Check if processing fee exists and belongs to the client
      const [existingFee] = await db.query(
        'SELECT id FROM processing_fees WHERE id = ? AND client_id = ?',
        [feeId, clientId]
      );

      if (existingFee.length === 0) {
        return res.status(404).json({ message: 'Processing fee not found' });
      }

      // Delete the processing fee
      await db.query(
        'DELETE FROM processing_fees WHERE id = ? AND client_id = ?',
        [feeId, clientId]
      );

      console.log('Processing fee deleted successfully');
      res.status(204).send();
    } catch (error) {
      console.error('Error in deleteProcessingFee:', error);
      res.status(500).json({ 
        message: 'Failed to delete processing fee',
        error: error.message 
      });
    }
  }
};

module.exports = processingFeeController;


