-- Runs once, only on first container start (empty data volume).
-- Creates the separate logical databases used by dev, automated tests and e2e,
-- so the three never share rows even though they share one local Postgres server.
CREATE DATABASE matiere_test;
CREATE DATABASE matiere_e2e;
