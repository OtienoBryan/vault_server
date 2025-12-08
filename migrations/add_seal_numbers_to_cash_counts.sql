-- Add seal number columns to cash_counts table
ALTER TABLE cash_counts ADD COLUMN IF NOT EXISTS original_seal_number VARCHAR(255);
ALTER TABLE cash_counts ADD COLUMN IF NOT EXISTS new_seal_number VARCHAR(255);

