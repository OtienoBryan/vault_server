-- Add decline_reason column to cash_counts table
ALTER TABLE cash_counts ADD COLUMN IF NOT EXISTS decline_reason TEXT;
ALTER TABLE cash_counts ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';

