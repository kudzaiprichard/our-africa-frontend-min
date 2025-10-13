use crate::commands::get_connection;
use rusqlite::params;

// ============================================================================
// SYNC QUEUE COMMANDS
// ============================================================================

#[tauri::command]
pub fn add_to_sync_queue(
    db_path: String,
    operation_type: String,
    table_name: String,
    record_id: String,
    data: String,
) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    conn.execute(
        "INSERT INTO sync_queue (operation_type, table_name, record_id, data, created_at, retry_count)
         VALUES (?1, ?2, ?3, ?4, datetime('now'), 0)",
        params![operation_type, table_name, record_id, data],
    )
    .map_err(|e| format!("Failed to add to sync queue: {}", e))?;

    Ok("Added to sync queue successfully".to_string())
}

#[tauri::command]
pub fn get_sync_queue(db_path: String, limit: Option<i64>) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let limit_value = limit.unwrap_or(100);

    let mut stmt = conn
        .prepare(
            "SELECT json_object(
                'id', id,
                'operation_type', operation_type,
                'table_name', table_name,
                'record_id', record_id,
                'data', json(data),
                'created_at', created_at,
                'retry_count', retry_count,
                'last_retry_at', last_retry_at,
                'error_message', error_message
             ) FROM sync_queue
             ORDER BY created_at ASC
             LIMIT ?1",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let items: Vec<String> = stmt
        .query_map(params![limit_value], |row| row.get(0))
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let items_json = format!("[{}]", items.join(","));
    Ok(items_json)
}

#[tauri::command]
pub fn get_sync_queue_count(db_path: String) -> Result<i64, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM sync_queue", [], |row| row.get(0))
        .map_err(|e| format!("Failed to count sync queue: {}", e))?;

    Ok(count)
}

#[tauri::command]
pub fn remove_from_sync_queue(db_path: String, sync_id: i64) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    conn.execute("DELETE FROM sync_queue WHERE id = ?1", params![sync_id])
        .map_err(|e| format!("Failed to remove from sync queue: {}", e))?;

    Ok("Removed from sync queue successfully".to_string())
}

#[tauri::command]
pub fn remove_multiple_from_sync_queue(db_path: String, sync_ids: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let ids: Vec<i64> = serde_json::from_str(&sync_ids)
        .map_err(|e| format!("Invalid JSON array: {}", e))?;

    let mut count = 0;
    for id in ids {
        conn.execute("DELETE FROM sync_queue WHERE id = ?1", params![id])
            .map_err(|e| format!("Failed to remove item: {}", e))?;
        count += 1;
    }

    Ok(format!("{} items removed from sync queue", count))
}

#[tauri::command]
pub fn update_sync_queue_retry(
    db_path: String,
    sync_id: i64,
    error_message: Option<String>,
) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    conn.execute(
        "UPDATE sync_queue
         SET retry_count = retry_count + 1, last_retry_at = datetime('now'), error_message = ?1
         WHERE id = ?2",
        params![error_message, sync_id],
    )
    .map_err(|e| format!("Failed to update sync queue: {}", e))?;

    Ok("Sync queue updated successfully".to_string())
}

#[tauri::command]
pub fn clear_sync_queue(db_path: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    conn.execute("DELETE FROM sync_queue", [])
        .map_err(|e| format!("Failed to clear sync queue: {}", e))?;

    Ok("Sync queue cleared successfully".to_string())
}

#[tauri::command]
pub fn get_sync_queue_by_table(db_path: String, table_name: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT json_object(
                'id', id,
                'operation_type', operation_type,
                'table_name', table_name,
                'record_id', record_id,
                'data', json(data),
                'created_at', created_at,
                'retry_count', retry_count,
                'last_retry_at', last_retry_at,
                'error_message', error_message
             ) FROM sync_queue
             WHERE table_name = ?1
             ORDER BY created_at ASC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let items: Vec<String> = stmt
        .query_map(params![table_name], |row| row.get(0))
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let items_json = format!("[{}]", items.join(","));
    Ok(items_json)
}

// ============================================================================
// APP METADATA COMMANDS (for sync tracking)
// ============================================================================

#[tauri::command]
pub fn set_app_metadata(db_path: String, key: String, value: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO app_metadata (key, value, updated_at)
         VALUES (?1, ?2, datetime('now'))",
        params![key, value],
    )
    .map_err(|e| format!("Failed to set metadata: {}", e))?;

    Ok("Metadata set successfully".to_string())
}

#[tauri::command]
pub fn get_app_metadata(db_path: String, key: String) -> Result<Option<String>, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let value: Option<String> = conn
        .query_row(
            "SELECT value FROM app_metadata WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .ok();

    Ok(value)
}

#[tauri::command]
pub fn get_all_app_metadata(db_path: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT json_object(
                'key', key,
                'value', value,
                'updated_at', updated_at
             ) FROM app_metadata",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let metadata: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let metadata_json = format!("[{}]", metadata.join(","));
    Ok(metadata_json)
}

#[tauri::command]
pub fn set_last_sync_time(db_path: String) -> Result<String, String> {
    let now = chrono::Utc::now().to_rfc3339();
    set_app_metadata(db_path, "last_full_sync".to_string(), now)
}

#[tauri::command]
pub fn get_last_sync_time(db_path: String) -> Result<Option<String>, String> {
    get_app_metadata(db_path, "last_full_sync".to_string())
}

#[tauri::command]
pub fn set_offline_mode(db_path: String, is_offline: bool) -> Result<String, String> {
    set_app_metadata(db_path, "is_offline_mode".to_string(), is_offline.to_string())
}

#[tauri::command]
pub fn is_offline_mode(db_path: String) -> Result<bool, String> {
    let value = get_app_metadata(db_path, "is_offline_mode".to_string())?;
    Ok(value.unwrap_or_else(|| "false".to_string()) == "true")
}
