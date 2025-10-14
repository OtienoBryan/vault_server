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
};

module.exports = processingFeeController;


