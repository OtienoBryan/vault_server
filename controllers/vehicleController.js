const db = require('../database/db');

const ensureTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id                  int(11)      NOT NULL AUTO_INCREMENT,
      registration_number varchar(20)  NOT NULL,
      model_id            int(11)      NOT NULL,
      consumption         decimal(5,2) NOT NULL,
      category            varchar(20)  NOT NULL DEFAULT 'chase',
      status              tinyint(4)   DEFAULT 1,
      created_at          timestamp    NOT NULL DEFAULT current_timestamp(),
      updated_at          timestamp    NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
      PRIMARY KEY (id),
      UNIQUE KEY registration_number (registration_number),
      KEY model_id (model_id),
      CONSTRAINT fk_vehicles_model FOREIGN KEY (model_id) REFERENCES vehicle_models (id)
    )
  `);
  // Add column if table already exists without it
  await db.query(`
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS category varchar(20) NOT NULL DEFAULT 'chase'
  `).catch(() => {});
};

const selectFields = `
  v.id, v.registration_number, v.model_id, v.consumption, v.category, v.status,
  v.created_at, v.updated_at,
  vm.name AS model_name
`;

const joinModels = `
  FROM vehicles v
  LEFT JOIN vehicle_models vm ON v.model_id = vm.id
`;

const getAll = async (req, res) => {
  try {
    await ensureTable();
    const [rows] = await db.query(
      `SELECT ${selectFields} ${joinModels} ORDER BY v.registration_number ASC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getById = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ${selectFields} ${joinModels} WHERE v.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Vehicle not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const VALID_CATEGORIES = ['chase', 'lead'];

const create = async (req, res) => {
  try {
    await ensureTable();
    const { registration_number, model_id, consumption, category = 'chase', status = 1 } = req.body;

    if (!registration_number || !model_id || consumption === undefined || consumption === null) {
      return res.status(400).json({ message: 'Registration number, model and consumption are required' });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: 'Category must be chase or lead' });
    }

    const rate = parseFloat(consumption);
    if (isNaN(rate) || rate <= 0) {
      return res.status(400).json({ message: 'Consumption must be a positive number' });
    }

    const [modelRows] = await db.query('SELECT id FROM vehicle_models WHERE id = ?', [model_id]);
    if (modelRows.length === 0) {
      return res.status(400).json({ message: 'Selected vehicle model does not exist' });
    }

    const [result] = await db.query(
      'INSERT INTO vehicles (registration_number, model_id, consumption, category, status) VALUES (?, ?, ?, ?, ?)',
      [registration_number.trim().toUpperCase(), model_id, rate, category, status]
    );

    const [rows] = await db.query(
      `SELECT ${selectFields} ${joinModels} WHERE v.id = ?`,
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'A vehicle with that registration number already exists' });
    }
    console.error('Error creating vehicle:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { registration_number, model_id, consumption, category, status } = req.body;

    if (!registration_number || !model_id || consumption === undefined || consumption === null) {
      return res.status(400).json({ message: 'Registration number, model and consumption are required' });
    }
    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: 'Category must be chase or lead' });
    }

    const rate = parseFloat(consumption);
    if (isNaN(rate) || rate <= 0) {
      return res.status(400).json({ message: 'Consumption must be a positive number' });
    }

    const fields = {
      registration_number: registration_number.trim().toUpperCase(),
      model_id,
      consumption: rate,
      category: category || 'chase',
    };
    if (status !== undefined) fields.status = status;

    const setClause = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(fields), id];

    const [result] = await db.query(
      `UPDATE vehicles SET ${setClause} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    const [rows] = await db.query(
      `SELECT ${selectFields} ${joinModels} WHERE v.id = ?`,
      [id]
    );
    res.json(rows[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'A vehicle with that registration number already exists' });
    }
    console.error('Error updating vehicle:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM vehicles WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }
    res.json({ message: 'Vehicle deleted successfully' });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { getAll, getById, create, update, remove };
