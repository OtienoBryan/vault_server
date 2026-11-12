const db = require('../database/db');

const cashinTransactionController = {
  // Get all cash-in transactions
  getAllCashinTransactions: async (req, res) => {
    try {
      const [records] = await db.query(`
        SELECT
          ct.*,
          cc.ones, cc.fives, cc.tens, cc.twenties, cc.forties, cc.fifties,
          cc.hundreds, cc.twoHundreds, cc.fiveHundreds, cc.thousands,
          cc.totalAmount as cash_count_total, cc.sealNumber,
          cc.status as cash_count_status,
          s.name as staff_name, s.phone as staff_phone, s.role as staff_role,
          s.empl_no as staff_empl_no, s.photo_url as staff_photo_url,
          r.user_name as requester_name, r.pickup_location, r.delivery_location,
          r.pickup_date, r.price as request_price,
          b.name as branch_name, b.id as branch_id,
          c.name as client_name, c.id as client_id, c.account_number as client_account_number
        FROM cashin_transactions ct
        LEFT JOIN cash_counts cc ON ct.cash_count_id = cc.id
        LEFT JOIN staff s ON ct.staff_id = s.id
        LEFT JOIN requests r ON ct.request_id = r.id
        LEFT JOIN branches b ON r.branch_id = b.id
        LEFT JOIN clients c ON b.client_id = c.id
        ORDER BY ct.created_at DESC
      `);

      res.json(records);
    } catch (error) {
      console.error('Error fetching cash-in transactions:', error);
      res.status(500).json({ message: 'Error fetching cash-in transactions', error: error.message });
    }
  },

  // Get a single cash-in transaction by ID
  getCashinTransactionById: async (req, res) => {
    try {
      const { id } = req.params;

      const [records] = await db.query(`
        SELECT
          ct.*,
          cc.ones, cc.fives, cc.tens, cc.twenties, cc.forties, cc.fifties,
          cc.hundreds, cc.twoHundreds, cc.fiveHundreds, cc.thousands,
          cc.totalAmount as cash_count_total, cc.sealNumber,
          cc.status as cash_count_status,
          s.name as staff_name, s.phone as staff_phone, s.role as staff_role,
          s.empl_no as staff_empl_no, s.photo_url as staff_photo_url,
          r.user_name as requester_name, r.pickup_location, r.delivery_location,
          r.pickup_date, r.price as request_price,
          b.name as branch_name, b.id as branch_id,
          c.name as client_name, c.id as client_id, c.account_number as client_account_number
        FROM cashin_transactions ct
        LEFT JOIN cash_counts cc ON ct.cash_count_id = cc.id
        LEFT JOIN staff s ON ct.staff_id = s.id
        LEFT JOIN requests r ON ct.request_id = r.id
        LEFT JOIN branches b ON r.branch_id = b.id
        LEFT JOIN clients c ON b.client_id = c.id
        WHERE ct.id = ?
      `, [id]);

      if (records.length === 0) {
        return res.status(404).json({ message: 'Cash-in transaction not found' });
      }

      res.json(records[0]);
    } catch (error) {
      console.error('Error fetching cash-in transaction:', error);
      res.status(500).json({ message: 'Error fetching cash-in transaction', error: error.message });
    }
  }
};

module.exports = cashinTransactionController;
