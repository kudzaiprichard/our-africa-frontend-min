use tauri::{AppHandle, Manager};
use std::fs;
use rusqlite::{Connection, Result};

pub fn get_database_path(app: &AppHandle) -> Result<String, String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    let db_path = app_data_dir.join("app.db");

    Ok(db_path.to_string_lossy().to_string())
}

pub fn initialize_database(app: &AppHandle) -> Result<(), String> {
    let db_path = get_database_path(app)?;

    println!("Creating database at: {}", db_path);

    // Create database connection
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Read and execute migration SQL
    let migration_sql = include_str!("../migrations/001_initial.sql");

    conn.execute_batch(migration_sql)
        .map_err(|e| format!("Failed to execute migration: {}", e))?;

    println!("Database created successfully at: {}", db_path);

    Ok(())
}
