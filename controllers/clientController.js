const db = require('../database/db');

const clientController = {
  // Get all clients
  getAllClients: async (req, res) => {
    try {
      // Optimized query - only select needed columns
      const [clients] = await db.query(`
        SELECT id, name, account_number, phone, email, address, created_at, updated_at 
        FROM clients 
        ORDER BY created_at DESC
      `);
      
      res.json(clients);
    } catch (error) {
      console.error('Error in getAllClients:', error);
      res.status(500).json({ 
        message: 'Failed to fetch clients',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  getClient: async (req, res) => {
    try {
      const { id } = req.params;
      console.log('Fetching client with ID:', id);
      
      const [clients] = await db.query(
        'SELECT * FROM clients WHERE id = ?',
        [id]
      );

      if (clients.length === 0) {
        console.log('Client not found');
        return res.status(404).json({ message: 'Client not found' });
      }

      console.log('Client found:', clients[0]);
      res.json(clients[0]);
    } catch (error) {
      console.error('Error in getClient:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      });
      res.status(500).json({ 
        message: 'Failed to fetch client',
        error: error.message 
      });
    }
  },

  // Create a new client
  createClient: async (req, res) => {
    try {
      const { name, account_number, email, phone, address } = req.body;
      console.log('Creating client with data:', req.body);

      // Validate required fields
      if (!name || !account_number || !email) {
        return res.status(400).json({ 
          message: 'Name, account number, and email are required' 
        });
      }

      // Check for duplicate account number
      const [existingClients] = await db.query(
        'SELECT * FROM clients WHERE account_number = ?',
        [account_number]
      );

      if (existingClients.length > 0) {
        return res.status(400).json({ message: 'Account number already exists' });
      }

      // Insert new client
      const [result] = await db.query(
        'INSERT INTO clients (name, account_number, email, phone, address) VALUES (?, ?, ?, ?, ?)',
        [name, account_number, email, phone, address]
      );

      // Fetch the newly created client
      const [newClient] = await db.query(
        'SELECT * FROM clients WHERE id = ?',
        [result.insertId]
      );

      console.log('Client created successfully:', newClient[0]);
      res.status(201).json(newClient[0]);
    } catch (error) {
      console.error('Error in createClient:', error);
      res.status(500).json({ 
        message: 'Failed to create client',
        error: error.message 
      });
    }
  },

  updateClient: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, account_number, email, phone, address } = req.body;
      console.log('Updating client with ID:', id, 'Data:', req.body);

      // Validate required fields
      if (!name || !account_number || !email) {
        return res.status(400).json({ 
          message: 'Name, account number, and email are required' 
        });
      }

      // Check for duplicate account number (excluding current client)
      const [existingClients] = await db.query(
        'SELECT * FROM clients WHERE account_number = ? AND id != ?',
        [account_number, id]
      );

      if (existingClients.length > 0) {
        return res.status(400).json({ message: 'Account number already exists' });
      }

      // Update client
      await db.query(
        'UPDATE clients SET name = ?, account_number = ?, email = ?, phone = ?, address = ? WHERE id = ?',
        [name, account_number, email, phone, address, id]
      );

      // Fetch the updated client
      const [updatedClient] = await db.query(
        'SELECT * FROM clients WHERE id = ?',
        [id]
      );

      if (updatedClient.length === 0) {
        return res.status(404).json({ message: 'Client not found' });
      }

      console.log('Client updated successfully:', updatedClient[0]);
      res.json(updatedClient[0]);
    } catch (error) {
      console.error('Error in updateClient:', error);
      res.status(500).json({ 
        message: 'Failed to update client',
        error: error.message 
      });
    }
  },

  deleteClient: async (req, res) => {
    try {
      const { id } = req.params;
      console.log('Deleting client with ID:', id);

      // Check if client exists
      const [client] = await db.query(
        'SELECT * FROM clients WHERE id = ?',
        [id]
      );

      if (client.length === 0) {
        return res.status(404).json({ message: 'Client not found' });
      }

      // Delete client
      await db.query('DELETE FROM clients WHERE id = ?', [id]);
      console.log('Client deleted successfully');
      res.status(204).send();
    } catch (error) {
      console.error('Error in deleteClient:', error);
      res.status(500).json({ 
        message: 'Failed to delete client',
        error: error.message 
      });
    }
  }
};

module.exports = clientController; 