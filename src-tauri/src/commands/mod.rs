pub mod auth;
pub mod courses;
pub mod lessons;
pub mod progress;
pub mod sync;

use rusqlite::{Connection, Result as SqliteResult};

// Helper function used by all command modules
pub fn get_connection(db_path: &str) -> SqliteResult<Connection> {
    Connection::open(db_path)
}
