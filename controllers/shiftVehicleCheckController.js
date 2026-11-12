const db = require('../database/db');

const buildCheckSummary = (record) => ({
  ...record,
  checklist_total: Number(record.checklist_total) || 0,
  checklist_ok: Number(record.checklist_ok) || 0,
  checklist_failed: (Number(record.checklist_total) || 0) - (Number(record.checklist_ok) || 0),
});

const shiftVehicleCheckController = {
  // Get all shift vehicle checks
  getAllShiftVehicleChecks: async (req, res) => {
    try {
      const [records] = await db.query(`
        SELECT
          svc.id, svc.shift_id, svc.team_id, svc.vehicle_id, svc.remarks,
          s.shift_date,
          t.name AS team_name,
          v.registration_number, v.category AS vehicle_category,
          vm.name AS vehicle_model,
          COUNT(sci.id) AS checklist_total,
          SUM(CASE WHEN sci.is_ok = 1 THEN 1 ELSE 0 END) AS checklist_ok
        FROM shift_vehicle_checks svc
        LEFT JOIN shifts s ON svc.shift_id = s.id
        LEFT JOIN teams t ON svc.team_id = t.id
        LEFT JOIN vehicles v ON svc.vehicle_id = v.id
        LEFT JOIN vehicle_models vm ON v.model_id = vm.id
        LEFT JOIN shift_checklist_items sci ON sci.check_id = svc.id
        GROUP BY svc.id, svc.shift_id, svc.team_id, svc.vehicle_id, svc.remarks,
                 s.shift_date, t.name, v.registration_number, v.category, vm.name
        ORDER BY s.shift_date DESC, svc.id DESC
      `);

      res.json(records.map(buildCheckSummary));
    } catch (error) {
      console.error('Error fetching shift vehicle checks:', error);
      res.status(500).json({ message: 'Error fetching shift vehicle checks', error: error.message });
    }
  },

  // Get a single shift vehicle check with full details (team members + checklist items)
  getShiftVehicleCheckById: async (req, res) => {
    try {
      const { id } = req.params;

      const [records] = await db.query(`
        SELECT
          svc.id, svc.shift_id, svc.team_id, svc.vehicle_id, svc.remarks,
          s.shift_date,
          t.name AS team_name,
          v.registration_number, v.category AS vehicle_category,
          vm.name AS vehicle_model
        FROM shift_vehicle_checks svc
        LEFT JOIN shifts s ON svc.shift_id = s.id
        LEFT JOIN teams t ON svc.team_id = t.id
        LEFT JOIN vehicles v ON svc.vehicle_id = v.id
        LEFT JOIN vehicle_models vm ON v.model_id = vm.id
        WHERE svc.id = ?
      `, [id]);

      if (records.length === 0) {
        return res.status(404).json({ message: 'Shift vehicle check not found' });
      }

      const record = records[0];

      const [teamMembers] = await db.query(`
        SELECT st.id, st.name, st.role, st.empl_no, st.photo_url
        FROM team_members tm
        JOIN staff st ON tm.staff_id = st.id
        WHERE tm.team_id = ?
        ORDER BY st.name
      `, [record.team_id]);

      const [checklistItems] = await db.query(`
        SELECT id, item, is_ok
        FROM shift_checklist_items
        WHERE check_id = ?
        ORDER BY id
      `, [id]);

      res.json({
        ...record,
        team_members: teamMembers,
        checklist_items: checklistItems,
      });
    } catch (error) {
      console.error('Error fetching shift vehicle check:', error);
      res.status(500).json({ message: 'Error fetching shift vehicle check', error: error.message });
    }
  },

  // Matrix view: checklist items as rows, vehicles as columns, for a given (or the latest) shift date
  getChecklistMatrix: async (req, res) => {
    try {
      const { date } = req.query;

      const [dateRows] = await db.query(`
        SELECT DISTINCT s.shift_date
        FROM shift_vehicle_checks svc
        LEFT JOIN shifts s ON svc.shift_id = s.id
        WHERE s.shift_date IS NOT NULL
        ORDER BY s.shift_date DESC
      `);
      const availableDates = dateRows.map(r => {
        const d = r.shift_date;
        return d instanceof Date ? d.toISOString().substring(0, 10) : String(d).substring(0, 10);
      });

      const targetDate = date || availableDates[0] || null;

      if (!targetDate) {
        return res.json({ date: null, availableDates, vehicles: [], items: [], matrix: {}, remarks: {} });
      }

      const [rows] = await db.query(`
        SELECT
          svc.id AS check_id, svc.vehicle_id, svc.remarks,
          v.registration_number, v.category AS vehicle_category,
          vm.name AS vehicle_model,
          t.name AS team_name,
          sci.id AS item_id, sci.item, sci.is_ok
        FROM shift_vehicle_checks svc
        LEFT JOIN shifts s ON svc.shift_id = s.id
        LEFT JOIN vehicles v ON svc.vehicle_id = v.id
        LEFT JOIN vehicle_models vm ON v.model_id = vm.id
        LEFT JOIN teams t ON svc.team_id = t.id
        LEFT JOIN shift_checklist_items sci ON sci.check_id = svc.id
        WHERE DATE(s.shift_date) = ?
        ORDER BY v.registration_number ASC, sci.id ASC
      `, [targetDate]);

      const vehiclesById = {};
      const itemFirstSeen = {};
      const matrix = {};
      const remarks = {};

      rows.forEach(row => {
        const vehicleKey = row.vehicle_id;
        if (!vehiclesById[vehicleKey]) {
          vehiclesById[vehicleKey] = {
            vehicle_id: row.vehicle_id,
            registration_number: row.registration_number,
            vehicle_model: row.vehicle_model,
            vehicle_category: row.vehicle_category,
            team_name: row.team_name,
          };
          matrix[vehicleKey] = {};
          remarks[vehicleKey] = row.remarks || null;
        }
        if (row.item) {
          matrix[vehicleKey][row.item] = row.is_ok;
          if (!(row.item in itemFirstSeen)) {
            itemFirstSeen[row.item] = row.item_id;
          }
        }
      });

      const items = Object.keys(itemFirstSeen).sort((a, b) => itemFirstSeen[a] - itemFirstSeen[b]);
      const vehicles = Object.values(vehiclesById);

      res.json({ date: targetDate, availableDates, vehicles, items, matrix, remarks });
    } catch (error) {
      console.error('Error fetching checklist matrix:', error);
      res.status(500).json({ message: 'Error fetching checklist matrix', error: error.message });
    }
  }
};

module.exports = shiftVehicleCheckController;
