const db = require('../database/db');

// Shared fragment to fetch a team row with members, crew_commander and vehicles
const teamQuery = (whereClause = '') => `
  SELECT t.*,
    JSON_ARRAYAGG(
      JSON_OBJECT(
        'id', s.id, 'name', s.name, 'role', s.role,
        'photo_url', s.photo_url, 'empl_no', s.empl_no,
        'id_no', s.id_no, 'status', s.status
      )
    ) AS members,
    JSON_OBJECT(
      'id', cc.id, 'name', cc.name, 'role', cc.role,
      'photo_url', cc.photo_url, 'empl_no', cc.empl_no,
      'id_no', cc.id_no, 'status', cc.status
    ) AS crew_commander,
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'id', v.id,
          'registration_number', v.registration_number,
          'category', v.category,
          'model_id', v.model_id,
          'consumption', v.consumption
        )
      )
      FROM team_vehicles tv2
      JOIN vehicles v ON tv2.vehicle_id = v.id
      WHERE tv2.team_id = t.id
    ) AS vehicles
  FROM teams t
  LEFT JOIN team_members tm ON t.id = tm.team_id
  LEFT JOIN staff s ON tm.staff_id = s.id
  LEFT JOIN staff cc ON t.crew_commander_id = cc.id
  ${whereClause}
  GROUP BY t.id
`;

const parseTeam = (row) => {
  row.members = JSON.parse(row.members || '[]').filter(m => m && m.id);
  row.vehicles = JSON.parse(row.vehicles || '[]').filter(v => v && v.id);
  if (row.crew_commander) {
    const cc = JSON.parse(row.crew_commander);
    row.crew_commander = cc && cc.id ? cc : null;
  }
  return row;
};

const teamController = {
  createTeam: async (req, res) => {
    const { name, members, crew_commander_id } = req.body;

    if (!name || !members || !Array.isArray(members)) {
      return res.status(400).json({ message: 'Invalid team data. Name and members array are required.' });
    }

    try {
      // Check if any member is already assigned to a team today
      const [conflicts] = await db.query(
        `SELECT s.name
         FROM team_members tm
         JOIN teams t ON tm.team_id = t.id
         JOIN staff s ON tm.staff_id = s.id
         WHERE DATE(t.created_at) = CURDATE()
           AND tm.staff_id IN (?)`,
        [members]
      );
      if (conflicts.length > 0) {
        const names = conflicts.map(r => r.name).join(', ');
        return res.status(409).json({
          message: `The following staff are already assigned to a team today: ${names}`
        });
      }

      const [result] = await db.query(
        'INSERT INTO teams (name, crew_commander_id) VALUES (?, ?)',
        [name, crew_commander_id || null]
      );
      const teamId = result.insertId;

      for (const memberId of members) {
        await db.query('INSERT INTO team_members (team_id, staff_id) VALUES (?, ?)', [teamId, memberId]);
      }

      const [rows] = await db.query(teamQuery('WHERE t.id = ?'), [teamId]);
      res.status(201).json(parseTeam(rows[0]));
    } catch (error) {
      console.error('Error creating team:', error);
      res.status(500).json({ message: 'Error creating team', error: error.message });
    }
  },

  getTeams: async (req, res) => {
    try {
      const [rows] = await db.query(teamQuery() + ' ORDER BY t.created_at DESC');
      res.json(rows.map(parseTeam));
    } catch (error) {
      console.error('Error fetching teams:', error);
      res.status(500).json({ message: 'Error fetching teams' });
    }
  },

  getTeamById: async (req, res) => {
    try {
      const [rows] = await db.query(teamQuery('WHERE t.id = ?'), [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ message: 'Team not found' });
      res.json(parseTeam(rows[0]));
    } catch (error) {
      console.error('Error fetching team:', error);
      res.status(500).json({ message: 'Error fetching team' });
    }
  },

  // POST /api/teams/:id/vehicles  body: { vehicle_id }
  assignVehicle: async (req, res) => {
    const { id: teamId } = req.params;
    const { vehicle_id } = req.body;

    if (!vehicle_id) return res.status(400).json({ message: 'vehicle_id is required' });

    try {
      // Fetch the vehicle's category
      const [vRows] = await db.query(
        'SELECT id, registration_number, category FROM vehicles WHERE id = ? AND status = 1',
        [vehicle_id]
      );
      if (vRows.length === 0) return res.status(404).json({ message: 'Vehicle not found or inactive' });

      const vehicle = vRows[0];

      // Check if this vehicle is already assigned to another team today
      const [conflict] = await db.query(
        `SELECT t.name AS team_name
         FROM team_vehicles tv
         JOIN teams t ON tv.team_id = t.id
         WHERE DATE(t.created_at) = CURDATE()
           AND tv.vehicle_id = ?
           AND tv.team_id != ?`,
        [vehicle_id, teamId]
      );
      if (conflict.length > 0) {
        return res.status(409).json({
          message: `${vehicle.registration_number} is already assigned to team "${conflict[0].team_name}" today`
        });
      }

      // Remove any existing vehicle of the same category from this team
      await db.query(
        `DELETE tv FROM team_vehicles tv
         JOIN vehicles v ON tv.vehicle_id = v.id
         WHERE tv.team_id = ? AND v.category = ?`,
        [teamId, vehicle.category]
      );

      // Assign
      await db.query('INSERT INTO team_vehicles (team_id, vehicle_id) VALUES (?, ?)', [teamId, vehicle_id]);

      const [rows] = await db.query(teamQuery('WHERE t.id = ?'), [teamId]);
      res.json(parseTeam(rows[0]));
    } catch (error) {
      console.error('Error assigning vehicle:', error);
      res.status(500).json({ message: 'Error assigning vehicle' });
    }
  },

  // DELETE /api/teams/:id/vehicles/:vehicleId
  removeVehicle: async (req, res) => {
    const { id: teamId, vehicleId } = req.params;
    try {
      await db.query('DELETE FROM team_vehicles WHERE team_id = ? AND vehicle_id = ?', [teamId, vehicleId]);
      const [rows] = await db.query(teamQuery('WHERE t.id = ?'), [teamId]);
      if (rows.length === 0) return res.status(404).json({ message: 'Team not found' });
      res.json(parseTeam(rows[0]));
    } catch (error) {
      console.error('Error removing vehicle:', error);
      res.status(500).json({ message: 'Error removing vehicle' });
    }
  },

  deleteTeam: async (req, res) => {
    try {
      const { id } = req.params;
      await db.query('DELETE FROM team_vehicles WHERE team_id = ?', [id]);
      await db.query('DELETE FROM team_members WHERE team_id = ?', [id]);
      const [result] = await db.query('DELETE FROM teams WHERE id = ?', [id]);
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Team not found' });
      res.json({ message: 'Team deleted successfully' });
    } catch (error) {
      console.error('Error deleting team:', error);
      res.status(500).json({ message: 'Error deleting team' });
    }
  }
};

module.exports = teamController;
