use crate::commands::get_connection;
use rusqlite::params;
use serde_json::Value as JsonValue;

// ============================================================================
// OFFLINE SESSION COMMANDS
// ============================================================================

#[tauri::command]
pub fn save_offline_session(db_path: String, session_data: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let session: JsonValue = serde_json::from_str(&session_data)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO offline_sessions
         (id, student_id, course_id, downloaded_at, expires_at, package_version,
          presigned_url_expiry_days, last_synced_at, sync_count, is_deleted,
          created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            session["id"].as_str(),
            session["student_id"].as_str(),
            session["course_id"].as_str(),
            session["downloaded_at"].as_str(),
            session["expires_at"].as_str(),
            session["package_version"].as_str().unwrap_or("v1"),
            session["presigned_url_expiry_days"].as_i64().unwrap_or(7),
            session["last_synced_at"].as_str(),
            session["sync_count"].as_i64().unwrap_or(0),
            session["is_deleted"].as_bool().unwrap_or(false),
            session["created_at"].as_str(),
            session["updated_at"].as_str(),
        ],
    )
    .map_err(|e| format!("Failed to save offline session: {}", e))?;

    Ok("Offline session saved successfully".to_string())
}

#[tauri::command]
pub fn get_offline_session_by_id(db_path: String, session_id: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let session_json: String = conn
        .query_row(
            "SELECT json_object(
                'id', os.id,
                'student_id', os.student_id,
                'course_id', os.course_id,
                'downloaded_at', os.downloaded_at,
                'expires_at', os.expires_at,
                'package_version', os.package_version,
                'presigned_url_expiry_days', os.presigned_url_expiry_days,
                'last_synced_at', os.last_synced_at,
                'sync_count', os.sync_count,
                'is_deleted', os.is_deleted,
                'created_at', os.created_at,
                'updated_at', os.updated_at,
                'is_expired', CASE WHEN datetime(os.expires_at) < datetime('now') THEN 1 ELSE 0 END,
                'is_valid', CASE
                    WHEN os.is_deleted = 1 THEN 0
                    WHEN datetime(os.expires_at) < datetime('now') THEN 0
                    ELSE 1
                END
             ) FROM offline_sessions os
             WHERE os.id = ?1",
            params![session_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Offline session not found: {}", e))?;

    Ok(session_json)
}

#[tauri::command]
pub fn get_student_offline_sessions(
    db_path: String,
    student_id: String,
    course_id: Option<String>,
    active_only: bool,
) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let query = if let Some(ref cid) = course_id {
        if active_only {
            "SELECT json_object(
                'id', os.id,
                'student_id', os.student_id,
                'course_id', os.course_id,
                'course_title', c.title,
                'downloaded_at', os.downloaded_at,
                'expires_at', os.expires_at,
                'package_version', os.package_version,
                'presigned_url_expiry_days', os.presigned_url_expiry_days,
                'last_synced_at', os.last_synced_at,
                'sync_count', os.sync_count,
                'is_deleted', os.is_deleted,
                'created_at', os.created_at,
                'updated_at', os.updated_at,
                'is_expired', CASE WHEN datetime(os.expires_at) < datetime('now') THEN 1 ELSE 0 END,
                'is_valid', CASE
                    WHEN os.is_deleted = 1 THEN 0
                    WHEN datetime(os.expires_at) < datetime('now') THEN 0
                    ELSE 1
                END
             ) FROM offline_sessions os
             LEFT JOIN courses c ON os.course_id = c.id
             WHERE os.student_id = ?1 AND os.course_id = ?2
               AND os.is_deleted = 0
               AND datetime(os.expires_at) >= datetime('now')
             ORDER BY os.downloaded_at DESC"
        } else {
            "SELECT json_object(
                'id', os.id,
                'student_id', os.student_id,
                'course_id', os.course_id,
                'course_title', c.title,
                'downloaded_at', os.downloaded_at,
                'expires_at', os.expires_at,
                'package_version', os.package_version,
                'presigned_url_expiry_days', os.presigned_url_expiry_days,
                'last_synced_at', os.last_synced_at,
                'sync_count', os.sync_count,
                'is_deleted', os.is_deleted,
                'created_at', os.created_at,
                'updated_at', os.updated_at,
                'is_expired', CASE WHEN datetime(os.expires_at) < datetime('now') THEN 1 ELSE 0 END,
                'is_valid', CASE
                    WHEN os.is_deleted = 1 THEN 0
                    WHEN datetime(os.expires_at) < datetime('now') THEN 0
                    ELSE 1
                END
             ) FROM offline_sessions os
             LEFT JOIN courses c ON os.course_id = c.id
             WHERE os.student_id = ?1 AND os.course_id = ?2 AND os.is_deleted = 0
             ORDER BY os.downloaded_at DESC"
        }
    } else {
        if active_only {
            "SELECT json_object(
                'id', os.id,
                'student_id', os.student_id,
                'course_id', os.course_id,
                'course_title', c.title,
                'downloaded_at', os.downloaded_at,
                'expires_at', os.expires_at,
                'package_version', os.package_version,
                'presigned_url_expiry_days', os.presigned_url_expiry_days,
                'last_synced_at', os.last_synced_at,
                'sync_count', os.sync_count,
                'is_deleted', os.is_deleted,
                'created_at', os.created_at,
                'updated_at', os.updated_at,
                'is_expired', CASE WHEN datetime(os.expires_at) < datetime('now') THEN 1 ELSE 0 END,
                'is_valid', CASE
                    WHEN os.is_deleted = 1 THEN 0
                    WHEN datetime(os.expires_at) < datetime('now') THEN 0
                    ELSE 1
                END
             ) FROM offline_sessions os
             LEFT JOIN courses c ON os.course_id = c.id
             WHERE os.student_id = ?1
               AND os.is_deleted = 0
               AND datetime(os.expires_at) >= datetime('now')
             ORDER BY os.downloaded_at DESC"
        } else {
            "SELECT json_object(
                'id', os.id,
                'student_id', os.student_id,
                'course_id', os.course_id,
                'course_title', c.title,
                'downloaded_at', os.downloaded_at,
                'expires_at', os.expires_at,
                'package_version', os.package_version,
                'presigned_url_expiry_days', os.presigned_url_expiry_days,
                'last_synced_at', os.last_synced_at,
                'sync_count', os.sync_count,
                'is_deleted', os.is_deleted,
                'created_at', os.created_at,
                'updated_at', os.updated_at,
                'is_expired', CASE WHEN datetime(os.expires_at) < datetime('now') THEN 1 ELSE 0 END,
                'is_valid', CASE
                    WHEN os.is_deleted = 1 THEN 0
                    WHEN datetime(os.expires_at) < datetime('now') THEN 0
                    ELSE 1
                END
             ) FROM offline_sessions os
             LEFT JOIN courses c ON os.course_id = c.id
             WHERE os.student_id = ?1 AND os.is_deleted = 0
             ORDER BY os.downloaded_at DESC"
        }
    };

    let mut stmt = conn
        .prepare(query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let sessions: Vec<String> = if let Some(cid) = course_id {
        stmt.query_map(params![student_id, cid], |row| row.get(0))
            .map_err(|e| format!("Query failed: {}", e))?
            .filter_map(|r| r.ok())
            .collect()
    } else {
        stmt.query_map(params![student_id], |row| row.get(0))
            .map_err(|e| format!("Query failed: {}", e))?
            .filter_map(|r| r.ok())
            .collect()
    };

    let sessions_json = format!("[{}]", sessions.join(","));
    Ok(sessions_json)
}

#[tauri::command]
pub fn update_offline_session_sync_info(
    db_path: String,
    session_id: String,
) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE offline_sessions
         SET last_synced_at = ?1, sync_count = sync_count + 1, updated_at = ?2
         WHERE id = ?3",
        params![now, now, session_id],
    )
    .map_err(|e| format!("Failed to update sync info: {}", e))?;

    Ok("Offline session sync info updated successfully".to_string())
}

#[tauri::command]
pub fn delete_offline_session(db_path: String, session_id: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();

    // Soft delete
    conn.execute(
        "UPDATE offline_sessions SET is_deleted = 1, updated_at = ?1 WHERE id = ?2",
        params![now, session_id],
    )
    .map_err(|e| format!("Failed to delete offline session: {}", e))?;

    Ok("Offline session deleted successfully".to_string())
}

#[tauri::command]
pub fn hard_delete_offline_session(db_path: String, session_id: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    // Hard delete (permanent)
    conn.execute(
        "DELETE FROM offline_sessions WHERE id = ?1",
        params![session_id],
    )
    .map_err(|e| format!("Failed to hard delete offline session: {}", e))?;

    Ok("Offline session permanently deleted".to_string())
}

#[tauri::command]
pub fn count_active_offline_sessions(
    db_path: String,
    student_id: Option<String>,
) -> Result<i64, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let count: i64 = if let Some(sid) = student_id {
        conn.query_row(
            "SELECT COUNT(*) FROM offline_sessions
             WHERE student_id = ?1
               AND is_deleted = 0
               AND datetime(expires_at) >= datetime('now')",
            params![sid],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count sessions: {}", e))?
    } else {
        conn.query_row(
            "SELECT COUNT(*) FROM offline_sessions
             WHERE is_deleted = 0
               AND datetime(expires_at) >= datetime('now')",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count sessions: {}", e))?
    };

    Ok(count)
}

#[tauri::command]
pub fn delete_expired_offline_sessions(db_path: String, days_old: i64) -> Result<i64, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();

    let count = conn.execute(
        "UPDATE offline_sessions
         SET is_deleted = 1, updated_at = ?1
         WHERE datetime(expires_at) < datetime('now', ?2 || ' days')
           AND is_deleted = 0",
        params![now, format!("-{}", days_old)],
    )
    .map_err(|e| format!("Failed to delete expired sessions: {}", e))?;

    Ok(count as i64)
}

// ============================================================================
// MEDIA CACHE COMMANDS
// ============================================================================

#[tauri::command]
pub fn save_media_cache(db_path: String, cache_data: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let cache: JsonValue = serde_json::from_str(&cache_data)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO media_cache
         (media_id, course_id, filename, media_type, local_file_path, size_bytes,
          downloaded_at, presigned_url, presigned_url_expires_at, is_downloaded, download_progress)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            cache["media_id"].as_str(),
            cache["course_id"].as_str(),
            cache["filename"].as_str(),
            cache["media_type"].as_str(),
            cache["local_file_path"].as_str(),
            cache["size_bytes"].as_i64(),
            cache["downloaded_at"].as_str(),
            cache["presigned_url"].as_str(),
            cache["presigned_url_expires_at"].as_str(),
            cache["is_downloaded"].as_bool().unwrap_or(false),
            cache["download_progress"].as_i64().unwrap_or(0),
        ],
    )
    .map_err(|e| format!("Failed to save media cache: {}", e))?;

    Ok("Media cache saved successfully".to_string())
}

#[tauri::command]
pub fn get_media_cache_by_course(db_path: String, course_id: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT json_object(
                'id', id,
                'media_id', media_id,
                'course_id', course_id,
                'filename', filename,
                'media_type', media_type,
                'local_file_path', local_file_path,
                'size_bytes', size_bytes,
                'downloaded_at', downloaded_at,
                'presigned_url', presigned_url,
                'presigned_url_expires_at', presigned_url_expires_at,
                'is_downloaded', is_downloaded,
                'download_progress', download_progress
             ) FROM media_cache
             WHERE course_id = ?1
             ORDER BY downloaded_at DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let cache_items: Vec<String> = stmt
        .query_map(params![course_id], |row| row.get(0))
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let cache_json = format!("[{}]", cache_items.join(","));
    Ok(cache_json)
}

#[tauri::command]
pub fn get_media_cache_by_media_id(db_path: String, media_id: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let cache_json: String = conn
        .query_row(
            "SELECT json_object(
                'id', id,
                'media_id', media_id,
                'course_id', course_id,
                'filename', filename,
                'media_type', media_type,
                'local_file_path', local_file_path,
                'size_bytes', size_bytes,
                'downloaded_at', downloaded_at,
                'presigned_url', presigned_url,
                'presigned_url_expires_at', presigned_url_expires_at,
                'is_downloaded', is_downloaded,
                'download_progress', download_progress
             ) FROM media_cache WHERE media_id = ?1",
            params![media_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Media cache not found: {}", e))?;

    Ok(cache_json)
}

#[tauri::command]
pub fn update_media_download_progress(
    db_path: String,
    media_id: String,
    progress: i64,
    is_downloaded: bool,
) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    conn.execute(
        "UPDATE media_cache
         SET download_progress = ?1, is_downloaded = ?2
         WHERE media_id = ?3",
        params![progress, is_downloaded, media_id],
    )
    .map_err(|e| format!("Failed to update download progress: {}", e))?;

    Ok("Download progress updated successfully".to_string())
}

#[tauri::command]
pub fn delete_media_cache_by_course(db_path: String, course_id: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    conn.execute(
        "DELETE FROM media_cache WHERE course_id = ?1",
        params![course_id],
    )
    .map_err(|e| format!("Failed to delete media cache: {}", e))?;

    Ok("Media cache deleted successfully".to_string())
}

// ============================================================================
// OFFLINE PROGRESS BATCH COMMANDS
// ============================================================================

#[tauri::command]
pub fn save_offline_progress_batch(db_path: String, batch_data: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let batch: JsonValue = serde_json::from_str(&batch_data)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO offline_progress_batch
         (session_id, course_id, batch_data, created_at, synced, synced_at)
         VALUES (?1, ?2, ?3, ?4, 0, NULL)",
        params![
            batch["session_id"].as_str(),
            batch["course_id"].as_str(),
            serde_json::to_string(&batch["batch_data"]).ok(),
            now,
        ],
    )
    .map_err(|e| format!("Failed to save progress batch: {}", e))?;

    Ok("Offline progress batch saved successfully".to_string())
}

#[tauri::command]
pub fn get_unsynced_progress_batches(db_path: String, limit: Option<i64>) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let limit_value = limit.unwrap_or(50);

    let mut stmt = conn
        .prepare(
            "SELECT json_object(
                'id', id,
                'session_id', session_id,
                'course_id', course_id,
                'batch_data', json(batch_data),
                'created_at', created_at,
                'synced', synced,
                'synced_at', synced_at
             ) FROM offline_progress_batch
             WHERE synced = 0
             ORDER BY created_at ASC
             LIMIT ?1",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let batches: Vec<String> = stmt
        .query_map(params![limit_value], |row| row.get(0))
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let batches_json = format!("[{}]", batches.join(","));
    Ok(batches_json)
}

#[tauri::command]
pub fn mark_batch_as_synced(db_path: String, batch_id: i64) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE offline_progress_batch SET synced = 1, synced_at = ?1 WHERE id = ?2",
        params![now, batch_id],
    )
    .map_err(|e| format!("Failed to mark batch as synced: {}", e))?;

    Ok("Progress batch marked as synced".to_string())
}

#[tauri::command]
pub fn delete_synced_progress_batches(db_path: String, days_old: i64) -> Result<i64, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let count = conn.execute(
        "DELETE FROM offline_progress_batch
         WHERE synced = 1
           AND datetime(synced_at) < datetime('now', ?1 || ' days')",
        params![format!("-{}", days_old)],
    )
    .map_err(|e| format!("Failed to delete synced batches: {}", e))?;

    Ok(count as i64)
}

#[tauri::command]
pub fn get_offline_session_statistics(db_path: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let stats_json: String = conn
        .query_row(
            "SELECT json_object(
                'total_sessions', (SELECT COUNT(*) FROM offline_sessions WHERE is_deleted = 0),
                'active_sessions', (SELECT COUNT(*) FROM offline_sessions
                                    WHERE is_deleted = 0 AND datetime(expires_at) >= datetime('now')),
                'expired_sessions', (SELECT COUNT(*) FROM offline_sessions
                                     WHERE is_deleted = 0 AND datetime(expires_at) < datetime('now')),
                'total_media_cached', (SELECT COUNT(*) FROM media_cache),
                'media_downloaded', (SELECT COUNT(*) FROM media_cache WHERE is_downloaded = 1),
                'unsynced_batches', (SELECT COUNT(*) FROM offline_progress_batch WHERE synced = 0)
             )",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to get statistics: {}", e))?;

    Ok(stats_json)
}
