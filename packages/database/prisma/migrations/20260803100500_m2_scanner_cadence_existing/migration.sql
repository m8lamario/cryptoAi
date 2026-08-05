-- M2: migrate the existing persisted scanner configuration to the 60-second cadence.
UPDATE "ScannerConfig"
SET "scannerFrequencyMinutes" = 1;

