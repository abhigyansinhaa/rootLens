-- Add value_column to analyses (run manually on existing DBs if init script was already applied).
USE rootLens_db;
ALTER TABLE analyses ADD COLUMN value_column VARCHAR(512) NULL AFTER target;
