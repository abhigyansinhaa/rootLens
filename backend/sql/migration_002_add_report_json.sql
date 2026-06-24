-- Add report_json to analyses (run manually on existing DBs if init script was already applied).
USE rootLens_db;
ALTER TABLE analyses ADD COLUMN report_json LONGTEXT NULL AFTER shap_json;
