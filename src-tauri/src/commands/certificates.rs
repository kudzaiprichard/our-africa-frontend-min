// src-tauri/src/commands/certificates.rs

use tauri::{AppHandle, Manager};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveFileResult {
    pub success: bool,
    pub file_path: Option<String>,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveMultipleResult {
    pub success: bool,
    pub folder_path: Option<String>,
    pub files_saved: Vec<String>,
    pub message: String,
}

/// Save a single certificate file with native save dialog
#[tauri::command]
pub async fn save_certificate_file(
    app: AppHandle,
    filename: String,
    base64_data: String,
) -> Result<SaveFileResult, String> {
    use tauri_plugin_dialog::{DialogExt, FilePath};

    // Show save dialog
    let file_path = app
        .dialog()
        .file()
        .set_file_name(&filename)
        .add_filter("PDF Files", &["pdf"])
        .add_filter("PNG Files", &["png"])
        .blocking_save_file();

    match file_path {
        Some(FilePath::Path(path)) => {
            // Decode base64 data
            let bytes = base64::decode(&base64_data)
                .map_err(|e| format!("Failed to decode base64: {}", e))?;

            // Write file
            fs::write(&path, bytes)
                .map_err(|e| format!("Failed to write file: {}", e))?;

            Ok(SaveFileResult {
                success: true,
                file_path: Some(path.to_string_lossy().to_string()),
                message: format!("File saved successfully to: {}", path.display()),
            })
        }
        _ => Ok(SaveFileResult {
            success: false,
            file_path: None,
            message: "Save cancelled by user".to_string(),
        }),
    }
}

/// Save multiple certificate files (certificate + transcript) to a chosen folder
#[tauri::command]
pub async fn save_multiple_certificates(
    app: AppHandle,
    files: Vec<(String, String)>, // Vec of (filename, base64_data)
) -> Result<SaveMultipleResult, String> {
    use tauri_plugin_dialog::{DialogExt, FilePath};

    // Show folder picker dialog
    let folder_path = app
        .dialog()
        .file()
        .blocking_pick_folder();

    match folder_path {
        Some(FilePath::Path(folder)) => {
            let mut saved_files = Vec::new();

            for (filename, base64_data) in files {
                // Decode base64
                let bytes = base64::decode(&base64_data)
                    .map_err(|e| format!("Failed to decode {}: {}", filename, e))?;

                // Create full file path
                let file_path = folder.join(&filename);

                // Write file
                fs::write(&file_path, bytes)
                    .map_err(|e| format!("Failed to write {}: {}", filename, e))?;

                saved_files.push(filename);
            }

            Ok(SaveMultipleResult {
                success: true,
                folder_path: Some(folder.to_string_lossy().to_string()),
                files_saved: saved_files,
                message: format!("Files saved successfully to: {}", folder.display()),
            })
        }
        _ => Ok(SaveMultipleResult {
            success: false,
            folder_path: None,
            files_saved: Vec::new(),
            message: "Save cancelled by user".to_string(),
        }),
    }
}

/// Get last save directory from app metadata
#[tauri::command]
pub fn get_last_save_directory(app: AppHandle) -> Result<Option<String>, String> {
    use crate::database::get_database_path;
    use rusqlite::Connection;

    let db_path = get_database_path(&app)?;
    let conn = Connection::open(db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    let result: Result<String, rusqlite::Error> = conn.query_row(
        "SELECT value FROM app_metadata WHERE key = 'last_save_directory'",
        [],
        |row| row.get(0),
    );

    match result {
        Ok(dir) => Ok(Some(dir)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

/// Set last save directory in app metadata
#[tauri::command]
pub fn set_last_save_directory(
    app: AppHandle,
    directory: String,
) -> Result<(), String> {
    use crate::database::get_database_path;
    use rusqlite::Connection;

    let db_path = get_database_path(&app)?;
    let conn = Connection::open(db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO app_metadata (key, value, updated_at)
         VALUES ('last_save_directory', ?1, datetime('now'))",
        [&directory],
    )
    .map_err(|e| format!("Failed to save directory: {}", e))?;

    Ok(())
}
