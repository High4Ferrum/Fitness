// Additive and idempotent; existing accounts and records remain untouched.
export function migratePasswordRecovery(db) {
 db.exec(`CREATE TABLE IF NOT EXISTS password_resets (
   token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
 ); CREATE INDEX IF NOT EXISTS password_resets_expiry ON password_resets(expires_at);
 CREATE INDEX IF NOT EXISTS password_resets_user ON password_resets(user_id);`);
}
