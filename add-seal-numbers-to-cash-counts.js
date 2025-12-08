require('dotenv').config();
const mysql = require('mysql2/promise');
const db = require('./database/db');

async function addSealNumbersToCashCounts() {
  try {
    console.log('Adding seal number columns to cash_counts table...');

    // Check if columns exist and add them if they don't
    try {
      await db.query(`
        ALTER TABLE cash_counts 
        ADD COLUMN original_seal_number VARCHAR(255)
      `);
      console.log('✓ Added original_seal_number column');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ original_seal_number column already exists');
      } else {
        throw error;
      }
    }

    try {
      await db.query(`
        ALTER TABLE cash_counts 
        ADD COLUMN new_seal_number VARCHAR(255)
      `);
      console.log('✓ Added new_seal_number column');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ new_seal_number column already exists');
      } else {
        throw error;
      }
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  }
}

// Run the migration
addSealNumbersToCashCounts();

