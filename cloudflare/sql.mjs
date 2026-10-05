// Keep the shared API synchronous. SQL cursors never cross an await boundary.
export function durableDatabase(storage) {
  const rows = (query, args) => storage.sql.exec(query, ...args).toArray();
  return {
    exec(query) { storage.sql.exec(query).toArray(); },
    prepare(query) {
      return {
        get(...args) { return rows(query, args)[0]; },
        all(...args) { return rows(query, args); },
        run(...args) { rows(query, args); },
      };
    },
    transaction(callback) { return storage.transactionSync(callback); },
  };
}
