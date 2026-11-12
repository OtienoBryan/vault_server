const db = require('../database/db');

const ensureTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS vehicle_models (
      id          int(11)      NOT NULL AUTO_INCREMENT,
      name        varchar(100) NOT NULL,
      consumption decimal(5,2) NOT NULL,
      status      tinyint(4)   DEFAULT 1,
      created_at  timestamp    NOT NULL DEFAULT current_timestamp(),
      updated_at  timestamp    NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
      PRIMARY KEY (id),
      UNIQUE KEY name (name)
    )
  `);
};

const getAll = async (req, res) => {
  try {
    await ensureTable();
    const [rows] = await db.query(
      'SELECT id, name, consumption, status, created_at, updated_at FROM vehicle_models ORDER BY name ASC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching vehicle models:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const create = async (req, res) => {
  try {
    await ensureTable();
    const { name, consumption, status = 1 } = req.body;

    if (!name || consumption === undefined || consumption === null) {
      return res.status(400).json({ message: 'Name and consumption are required' });
    }

    const rate = parseFloat(consumption);
    if (isNaN(rate) || rate <= 0) {
      return res.status(400).json({ message: 'Consumption must be a positive number' });
    }

    const [result] = await db.query(
      'INSERT INTO vehicle_models (name, consumption, status) VALUES (?, ?, ?)',
      [name.trim(), rate, status]
    );

    const [rows] = await db.query(
      'SELECT id, name, consumption, status, created_at, updated_at FROM vehicle_models WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'A vehicle model with that name already exists' });
    }
    console.error('Error creating vehicle model:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, consumption, status } = req.body;

    if (!name || consumption === undefined || consumption === null) {
      return res.status(400).json({ message: 'Name and consumption are required' });
    }

    const rate = parseFloat(consumption);
    if (isNaN(rate) || rate <= 0) {
      return res.status(400).json({ message: 'Consumption must be a positive number' });
    }

    const fields = { name: name.trim(), consumption: rate };
    if (status !== undefined) fields.status = status;

    const setClause = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(fields), id];

    const [result] = await db.query(
      `UPDATE vehicle_models SET ${setClause} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Vehicle model not found' });
    }

    const [rows] = await db.query(
      'SELECT id, name, consumption, status, created_at, updated_at FROM vehicle_models WHERE id = ?',
      [id]
    );

    res.json(rows[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'A vehicle model with that name already exists' });
    }
    console.error('Error updating vehicle model:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM vehicle_models WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Vehicle model not found' });
    }

    res.json({ message: 'Vehicle model deleted successfully' });
  } catch (error) {
    console.error('Error deleting vehicle model:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { getAll, create, update, remove };
