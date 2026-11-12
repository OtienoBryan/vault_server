ALTER TABLE vehicles
  ADD COLUMN category varchar(20) NOT NULL DEFAULT 'chase'
  AFTER consumption;
