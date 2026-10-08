// Additive, repeatable migration. Existing tables and Worker namespace stay intact.
export function migrateYoga(db) {
  for (const sql of [
    `CREATE TABLE IF NOT EXISTS yoga_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS yoga_seed_history (seed_key TEXT PRIMARY KEY)`,
    `CREATE TABLE IF NOT EXISTS yoga_poses (id TEXT PRIMARY KEY, name_key TEXT NOT NULL UNIQUE, json TEXT NOT NULL CHECK(json_valid(json)))`,
    `CREATE TABLE IF NOT EXISTS yoga_flows (id TEXT PRIMARY KEY, owner_id TEXT REFERENCES users(id), seed_key TEXT UNIQUE, status TEXT NOT NULL CHECK(status IN ('Draft','Published')), updated_at TEXT NOT NULL, json TEXT NOT NULL CHECK(json_valid(json)))`,
    `CREATE TABLE IF NOT EXISTS yoga_sections (id TEXT PRIMARY KEY, flow_id TEXT NOT NULL REFERENCES yoga_flows(id) ON DELETE CASCADE, sort_order INTEGER NOT NULL CHECK(sort_order>=0), title TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS yoga_blocks (id TEXT PRIMARY KEY, owner_id TEXT REFERENCES users(id), seed_key TEXT UNIQUE, name TEXT NOT NULL, json TEXT NOT NULL CHECK(json_valid(json)))`,
    `CREATE TABLE IF NOT EXISTS yoga_steps (id TEXT PRIMARY KEY, section_id TEXT REFERENCES yoga_sections(id) ON DELETE CASCADE, block_id TEXT REFERENCES yoga_blocks(id) ON DELETE CASCADE, pose_id TEXT REFERENCES yoga_poses(id), sort_order INTEGER NOT NULL CHECK(sort_order>=0), json TEXT NOT NULL CHECK(json_valid(json)), CHECK((section_id IS NOT NULL AND block_id IS NULL) OR (section_id IS NULL AND block_id IS NOT NULL)))`,
    `CREATE TABLE IF NOT EXISTS yoga_assignments (id TEXT PRIMARY KEY, flow_id TEXT NOT NULL REFERENCES yoga_flows(id), client_id TEXT NOT NULL REFERENCES clients(id), assigned_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, json TEXT NOT NULL CHECK(json_valid(json)))`,
    `CREATE TABLE IF NOT EXISTS yoga_completions (id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL UNIQUE REFERENCES yoga_assignments(id), client_id TEXT NOT NULL REFERENCES clients(id), completed_at TEXT NOT NULL, json TEXT NOT NULL CHECK(json_valid(json)))`,
    `CREATE INDEX IF NOT EXISTS yoga_flow_owner_status ON yoga_flows(owner_id,status)`,
    `CREATE INDEX IF NOT EXISTS yoga_sections_flow ON yoga_sections(flow_id,sort_order)`,
    `CREATE INDEX IF NOT EXISTS yoga_steps_section ON yoga_steps(section_id,sort_order)`,
    `CREATE INDEX IF NOT EXISTS yoga_steps_block ON yoga_steps(block_id,sort_order)`,
    `CREATE INDEX IF NOT EXISTS yoga_steps_pose ON yoga_steps(pose_id)`,
    `CREATE INDEX IF NOT EXISTS yoga_assignments_client ON yoga_assignments(client_id)`,
    `CREATE INDEX IF NOT EXISTS yoga_assignments_flow ON yoga_assignments(flow_id)`,
    `INSERT OR IGNORE INTO yoga_migrations(version,applied_at) VALUES (1,datetime('now'))`,
  ]) db.exec(sql);
}
