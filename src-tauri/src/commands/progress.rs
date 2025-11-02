use crate::commands::get_connection;
use rusqlite::params;
use serde_json::Value as JsonValue;

// ============================================================================
// MODULE PROGRESS COMMANDS
// ============================================================================
#[tauri::command]
pub fn save_module_progress(db_path: String, progress_data: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let progress: JsonValue = serde_json::from_str(&progress_data)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    let enrollment_id = progress["enrollment_id"].as_str()
        .ok_or_else(|| "Missing enrollment_id".to_string())?;
    let module_id = progress["module_id"].as_str()
        .ok_or_else(|| "Missing module_id".to_string())?;

    // ✅ Save/update module progress
    conn.execute(
        "INSERT OR REPLACE INTO module_progress
         (id, enrollment_id, module_id, status, started_at, completed_at,
          auto_completed, content_completion_percentage, completed_content_count, total_content_count,
          created_at, updated_at, last_synced_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, datetime('now'))",
        params![
            progress["id"].as_str(),
            enrollment_id,
            module_id,
            progress["status"].as_str(),
            progress["started_at"].as_str(),
            progress["completed_at"].as_str(),
            progress["auto_completed"].as_bool().unwrap_or(false),
            progress["content_completion_percentage"].as_f64().unwrap_or(0.0),
            progress["completed_content_count"].as_i64().unwrap_or(0),
            progress["total_content_count"].as_i64().unwrap_or(0),
            progress["created_at"].as_str(),
            progress["updated_at"].as_str(),
        ],
    )
    .map_err(|e| format!("Failed to save module progress: {}", e))?;

    // ✅ UPDATE ENROLLMENT TIMESTAMP - This moves course to "In Progress"
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE enrollments
         SET updated_at = ?1
         WHERE id = ?2",
        params![&now, enrollment_id],
    )
    .map_err(|e| format!("Failed to update enrollment timestamp: {}", e))?;

    Ok("Module progress saved successfully".to_string())
}

#[tauri::command]
pub fn get_enrollment_progress(db_path: String, enrollment_id: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT json_object(
                'id', mp.id,
                'enrollment_id', mp.enrollment_id,
                'module_id', mp.module_id,
                'status', mp.status,
                'started_at', mp.started_at,
                'completed_at', mp.completed_at,
                'auto_completed', mp.auto_completed,
                'content_completion_percentage', mp.content_completion_percentage,
                'completed_content_count', mp.completed_content_count,
                'total_content_count', mp.total_content_count,
                'created_at', mp.created_at,
                'updated_at', mp.updated_at,
                'module', json_object(
                    'id', m.id,
                    'title', m.title,
                    'description', m.description,
                    'order', m.order_index,
                    'content_count', m.content_count,
                    'has_quiz', m.has_quiz
                )
             ) FROM module_progress mp
             JOIN modules m ON mp.module_id = m.id
             WHERE mp.enrollment_id = ?1
             ORDER BY m.order_index ASC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let progress: Vec<String> = stmt
        .query_map(params![enrollment_id], |row| row.get(0))
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let progress_json = format!("[{}]", progress.join(","));
    Ok(progress_json)
}

#[tauri::command]
pub fn update_module_status(
    db_path: String,
    module_progress_id: String,
    status: String,
) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();

    match status.as_str() {
        "in_progress" => {
            conn.execute(
                "UPDATE module_progress SET status = ?1, started_at = ?2, updated_at = ?3, last_synced_at = datetime('now')
                 WHERE id = ?4",
                params![status, now, now, module_progress_id],
            )
            .map_err(|e| format!("Failed to update status: {}", e))?;
        }
        "completed" => {
            conn.execute(
                "UPDATE module_progress SET status = ?1, completed_at = ?2, updated_at = ?3, last_synced_at = datetime('now')
                 WHERE id = ?4",
                params![status, now, now, module_progress_id],
            )
            .map_err(|e| format!("Failed to update status: {}", e))?;
        }
        _ => {
            conn.execute(
                "UPDATE module_progress SET status = ?1, updated_at = ?2, last_synced_at = datetime('now')
                 WHERE id = ?3",
                params![status, now, module_progress_id],
            )
            .map_err(|e| format!("Failed to update status: {}", e))?;
        }
    }

    Ok("Module status updated successfully".to_string())
}

#[tauri::command]
pub fn get_course_progress_summary(
    db_path: String,
    enrollment_id: String,
) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    // ✅ FIXED: Get the course_id from enrollment
    let course_id: String = conn
        .query_row(
            "SELECT course_id FROM enrollments WHERE id = ?1",
            params![enrollment_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Enrollment not found: {}", e))?;

    // ✅ FIXED: Count ACTUAL modules from modules table, not just progress records
    let total_modules: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM modules WHERE course_id = ?1",
            params![course_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // ✅ Count progress from module_progress
    let completed_modules: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM module_progress
             WHERE enrollment_id = ?1 AND status = 'completed'",
            params![enrollment_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let in_progress_modules: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM module_progress
             WHERE enrollment_id = ?1 AND status = 'in_progress'",
            params![enrollment_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let not_started_modules = total_modules - completed_modules - in_progress_modules;

    // ✅ FIXED: Get last_accessed_at from most recent module_progress update
    let last_accessed_at: Option<String> = conn
        .query_row(
            "SELECT updated_at FROM module_progress
             WHERE enrollment_id = ?1
             ORDER BY updated_at DESC
             LIMIT 1",
            params![enrollment_id],
            |row| row.get(0),
        )
        .ok();

    // ✅ FIXED: Get last_accessed_module_id
    let last_accessed_module_id: Option<String> = conn
        .query_row(
            "SELECT module_id FROM module_progress
             WHERE enrollment_id = ?1
             ORDER BY updated_at DESC
             LIMIT 1",
            params![enrollment_id],
            |row| row.get(0),
        )
        .ok();

    // Calculate completion percentage
    let completion_percentage = if total_modules > 0 {
        ((completed_modules as f64 / total_modules as f64) * 100.0).round()
    } else {
        0.0
    };

    // ✅ Build JSON response with all required fields
    let summary = serde_json::json!({
        "total_modules": total_modules,
        "completed_modules": completed_modules,
        "in_progress_modules": in_progress_modules,
        "not_started_modules": not_started_modules,
        "completion_percentage": completion_percentage,
        "last_accessed_at": last_accessed_at,
        "last_accessed_module_id": last_accessed_module_id
    });

    Ok(summary.to_string())
}

// ============================================================================
// CONTENT PROGRESS COMMANDS (NEW - ADDED)
// ============================================================================

#[tauri::command]
pub fn save_content_progress(db_path: String, progress_data: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let progress: JsonValue = serde_json::from_str(&progress_data)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO content_progress
         (id, enrollment_id, content_id, is_completed, viewed_at, completed_at, created_at, updated_at, last_synced_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))",
        params![
            progress["id"].as_str(),
            progress["enrollment_id"].as_str(),
            progress["content_id"].as_str(),
            progress["is_completed"].as_bool().unwrap_or(false),
            progress["viewed_at"].as_str(),
            progress["completed_at"].as_str(),
            progress["created_at"].as_str(),
            progress["updated_at"].as_str(),
        ],
    )
    .map_err(|e| format!("Failed to save content progress: {}", e))?;

    Ok("Content progress saved successfully".to_string())
}

#[tauri::command]
pub fn get_content_progress(db_path: String, enrollment_id: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT json_object(
                'id', cp.id,
                'enrollment_id', cp.enrollment_id,
                'content_id', cp.content_id,
                'is_completed', cp.is_completed,
                'viewed_at', cp.viewed_at,
                'completed_at', cp.completed_at,
                'created_at', cp.created_at,
                'updated_at', cp.updated_at
             ) FROM content_progress cp
             WHERE cp.enrollment_id = ?1
             ORDER BY cp.created_at ASC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let progress: Vec<String> = stmt
        .query_map(params![enrollment_id], |row| row.get(0))
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let progress_json = format!("[{}]", progress.join(","));
    Ok(progress_json)
}

#[tauri::command]
pub fn get_content_progress_by_content_id(
    db_path: String,
    enrollment_id: String,
    content_id: String,
) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let progress_json: String = conn
        .query_row(
            "SELECT json_object(
                'id', id,
                'enrollment_id', enrollment_id,
                'content_id', content_id,
                'is_completed', is_completed,
                'viewed_at', viewed_at,
                'completed_at', completed_at,
                'created_at', created_at,
                'updated_at', updated_at
             ) FROM content_progress
             WHERE enrollment_id = ?1 AND content_id = ?2",
            params![enrollment_id, content_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Content progress not found: {}", e))?;

    Ok(progress_json)
}

#[tauri::command]
pub fn mark_content_as_viewed(
    db_path: String,
    content_id: String,
) -> Result<String, String> {
    println!("🔍 ========================================");
    println!("🔍 mark_content_as_viewed CALLED");
    println!("🔍 ========================================");
    println!("🔍 content_id: {}", content_id);

    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    // ✅ STEP 1: Get module_id from content_id
    println!("📦 STEP 1: Getting module_id from content_id...");
    let module_id: String = conn
        .query_row(
            "SELECT module_id FROM content_blocks WHERE id = ?1",
            params![content_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Content not found: {}", e))?;
    println!("📦 Found module_id: {}", module_id);

    // ✅ STEP 2: Get course_id from module_id
    println!("📚 STEP 2: Getting course_id from module_id...");
    let course_id: String = conn
        .query_row(
            "SELECT course_id FROM modules WHERE id = ?1",
            params![module_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Module not found: {}", e))?;
    println!("📚 Found course_id: {}", course_id);

    // ✅ STEP 3: Get current user's enrollment for this course
    println!("👤 STEP 3: Getting enrollment_id...");
    let enrollment_id: String = conn
        .query_row(
            "SELECT e.id FROM enrollments e
             JOIN users u ON e.student_id = u.id
             WHERE e.course_id = ?1
             ORDER BY e.created_at DESC
             LIMIT 1",
            params![course_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Enrollment not found: {}", e))?;
    println!("👤 Found enrollment_id: {}", enrollment_id);

    let now = chrono::Utc::now().to_rfc3339();
    let progress_id = format!("cp_{}_{}", enrollment_id, content_id);
    println!("🆔 Generated progress_id: {}", progress_id);

    // ✅ STEP 4: Check existing progress to preserve is_completed
    println!("🔍 STEP 4: Checking existing content_progress...");
    let existing: Option<(i64, Option<String>)> = conn
        .query_row(
            "SELECT is_completed, completed_at FROM content_progress
             WHERE enrollment_id = ?1 AND content_id = ?2",
            params![enrollment_id, content_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .ok();

    let (is_completed, completed_at) = if let Some((completed, at)) = existing {
        println!("📝 Existing progress found:");
        println!("   - is_completed: {}", completed);
        println!("   - completed_at: {:?}", at);
        (completed, at)
    } else {
        println!("📝 No existing progress found");
        (0, None)
    };

    // ✅ STEP 5: Save with PRESERVED is_completed status
    println!("💾 STEP 5: Saving content view (preserving is_completed={})...", is_completed);

    let rows_affected = if let Some(completed_at_value) = completed_at {
        // If already completed, preserve both is_completed AND completed_at
        conn.execute(
            "INSERT INTO content_progress
             (id, enrollment_id, content_id, is_completed, viewed_at, completed_at, created_at, updated_at, last_synced_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))
             ON CONFLICT(enrollment_id, content_id) DO UPDATE SET
                viewed_at = excluded.viewed_at,
                updated_at = excluded.updated_at,
                last_synced_at = datetime('now')",
            params![progress_id, enrollment_id, content_id, is_completed, &now, completed_at_value, &now, &now],
        )
    } else {
        // Not completed yet
        conn.execute(
            "INSERT INTO content_progress
             (id, enrollment_id, content_id, is_completed, viewed_at, created_at, updated_at, last_synced_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))
             ON CONFLICT(enrollment_id, content_id) DO UPDATE SET
                viewed_at = excluded.viewed_at,
                updated_at = excluded.updated_at,
                last_synced_at = datetime('now')",
            params![progress_id, enrollment_id, content_id, is_completed, &now, &now, &now],
        )
    }
    .map_err(|e| format!("Failed to mark content as viewed: {}", e))?;

    println!("💾 Rows affected: {}", rows_affected);

    // ✅ STEP 6: Verify the save
    println!("✅ STEP 6: Verifying save...");
    let verification: (i64, Option<String>) = conn
        .query_row(
            "SELECT is_completed, completed_at FROM content_progress
             WHERE enrollment_id = ?1 AND content_id = ?2",
            params![enrollment_id, content_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Failed to verify save: {}", e))?;

    println!("✅ Verified:");
    println!("   - is_completed: {}", verification.0);
    println!("   - completed_at: {:?}", verification.1);

    // ✅ STEP 7: Update enrollment timestamp
    println!("📅 STEP 7: Updating enrollment timestamp...");
    conn.execute(
        "UPDATE enrollments
         SET updated_at = ?1
         WHERE id = ?2",
        params![&now, enrollment_id],
    )
    .map_err(|e| format!("Failed to update enrollment timestamp: {}", e))?;
    println!("📅 Enrollment timestamp updated");

    println!("✅ ========================================");
    println!("✅ mark_content_as_viewed COMPLETE");
    println!("✅ ========================================");

    Ok("Content marked as viewed successfully".to_string())
}

#[tauri::command]
pub fn mark_content_as_completed(
    db_path: String,
    content_id: String,
) -> Result<String, String> {
    println!("🔍 ========================================");
    println!("🔍 mark_content_as_completed CALLED");
    println!("🔍 ========================================");
    println!("🔍 content_id: {}", content_id);

    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    // ✅ STEP 1: Get module_id from content_id
    println!("📦 STEP 1: Getting module_id from content_id...");
    let module_id: String = conn
        .query_row(
            "SELECT module_id FROM content_blocks WHERE id = ?1",
            params![content_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Content not found: {}", e))?;
    println!("📦 Found module_id: {}", module_id);

    // ✅ STEP 2: Get course_id from module_id
    println!("📚 STEP 2: Getting course_id from module_id...");
    let course_id: String = conn
        .query_row(
            "SELECT course_id FROM modules WHERE id = ?1",
            params![module_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Module not found: {}", e))?;
    println!("📚 Found course_id: {}", course_id);

    // ✅ STEP 3: Get current user's enrollment for this course
    println!("👤 STEP 3: Getting enrollment_id...");
    let enrollment_id: String = conn
        .query_row(
            "SELECT e.id FROM enrollments e
             JOIN users u ON e.student_id = u.id
             WHERE e.course_id = ?1
             ORDER BY e.created_at DESC
             LIMIT 1",
            params![course_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Enrollment not found: {}", e))?;
    println!("👤 Found enrollment_id: {}", enrollment_id);

    let now = chrono::Utc::now().to_rfc3339();
    let progress_id = format!("cp_{}_{}", enrollment_id, content_id);
    println!("🆔 Generated progress_id: {}", progress_id);

    // ✅ STEP 4: Check if content_progress already exists
    println!("🔍 STEP 4: Checking existing content_progress...");
    let existing: Option<(bool, Option<String>)> = conn
        .query_row(
            "SELECT is_completed, completed_at FROM content_progress
             WHERE enrollment_id = ?1 AND content_id = ?2",
            params![enrollment_id, content_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .ok();

    if let Some((is_completed, completed_at)) = existing {
        println!("📝 Existing progress found:");
        println!("   - is_completed: {}", is_completed);
        println!("   - completed_at: {:?}", completed_at);
    } else {
        println!("📝 No existing progress found - will INSERT");
    }

    // ✅ STEP 5: Mark content as completed (proper upsert WITHOUT WHERE clause)
    println!("💾 STEP 5: Saving content completion...");
    let rows_affected = conn.execute(
        "INSERT INTO content_progress
         (id, enrollment_id, content_id, is_completed, completed_at, created_at, updated_at, last_synced_at)
         VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6, datetime('now'))
         ON CONFLICT(enrollment_id, content_id) DO UPDATE SET
            is_completed = 1,
            completed_at = excluded.completed_at,
            updated_at = excluded.updated_at,
            last_synced_at = datetime('now')",
        params![progress_id, enrollment_id, content_id, &now, &now, &now],
    )
    .map_err(|e| format!("Failed to mark content as completed: {}", e))?;

    println!("💾 Rows affected: {}", rows_affected);

    // ✅ STEP 5.5: Verify the save
    println!("✅ STEP 5.5: Verifying save...");
    let verification: (bool, String) = conn
        .query_row(
            "SELECT is_completed, completed_at FROM content_progress
             WHERE enrollment_id = ?1 AND content_id = ?2",
            params![enrollment_id, content_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Failed to verify save: {}", e))?;

    println!("✅ Verified:");
    println!("   - is_completed: {}", verification.0);
    println!("   - completed_at: {}", verification.1);

    // ✅ STEP 6: Count total content blocks in this module
    println!("📊 STEP 6: Counting total content blocks...");
    let total_content: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM content_blocks WHERE module_id = ?1",
            params![module_id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    println!("📊 Total content blocks: {}", total_content);

    // ✅ STEP 7: Count completed content blocks for this module
    println!("📊 STEP 7: Counting completed content blocks...");
    let completed_content: i64 = conn
        .query_row(
            "SELECT COUNT(*)
             FROM content_progress cp
             JOIN content_blocks cb ON cp.content_id = cb.id
             WHERE cp.enrollment_id = ?1
               AND cb.module_id = ?2
               AND cp.is_completed = 1",
            params![enrollment_id, module_id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    println!("📊 Completed content blocks: {}", completed_content);

    // ✅ STEP 7.5: Debug - List all completed content IDs for this module
    println!("🔍 STEP 7.5: Listing all completed content for this module...");
    let mut stmt = conn
        .prepare(
            "SELECT cb.id, cp.is_completed, cp.completed_at
             FROM content_blocks cb
             LEFT JOIN content_progress cp ON cb.id = cp.content_id AND cp.enrollment_id = ?1
             WHERE cb.module_id = ?2
             ORDER BY cb.order_index"
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let content_list = stmt
        .query_map(params![enrollment_id, module_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<i64>>(1)?,
                row.get::<_, Option<String>>(2)?
            ))
        })
        .map_err(|e| format!("Query failed: {}", e))?;

    for (idx, content_row) in content_list.enumerate() {
        if let Ok((id, is_completed, completed_at)) = content_row {
            println!("   Content {}: id={}, completed={:?}, at={:?}",
                idx + 1, id, is_completed, completed_at);
        }
    }

    // ✅ STEP 8: Calculate completion percentage
    println!("📈 STEP 8: Calculating completion percentage...");
    let content_completion_percentage = if total_content > 0 {
        ((completed_content as f64 / total_content as f64) * 100.0).round()
    } else {
        0.0
    };
    println!("📈 Completion percentage: {}%", content_completion_percentage);

    // ✅ STEP 9: Update module_progress with content completion stats
    println!("📝 STEP 9: Updating module_progress...");
    conn.execute(
        "UPDATE module_progress
         SET content_completion_percentage = ?1,
             completed_content_count = ?2,
             total_content_count = ?3,
             updated_at = ?4,
             last_synced_at = datetime('now')
         WHERE enrollment_id = ?5 AND module_id = ?6",
        params![
            content_completion_percentage,
            completed_content,
            total_content,
            &now,
            enrollment_id,
            module_id
        ],
    )
    .map_err(|e| format!("Failed to update module progress: {}", e))?;
    println!("📝 Module progress updated");

    // ✅ STEP 10: Check if module should auto-complete
    println!("🎯 STEP 10: Checking if module should auto-complete...");
    let should_auto_complete = check_module_auto_completion(&conn, &enrollment_id, &module_id)?;
    println!("🎯 Should auto-complete: {}", should_auto_complete);

    if should_auto_complete {
        println!("🎉 Auto-completing module...");
        // Auto-complete the module
        conn.execute(
            "UPDATE module_progress
             SET status = 'completed',
                 completed_at = ?1,
                 auto_completed = 1,
                 updated_at = ?2,
                 last_synced_at = datetime('now')
             WHERE enrollment_id = ?3 AND module_id = ?4",
            params![&now, &now, enrollment_id, module_id],
        )
        .map_err(|e| format!("Failed to auto-complete module: {}", e))?;
        println!("🎉 Module auto-completed successfully");
    }

    // ✅ STEP 11: Update enrollment timestamp
    println!("📅 STEP 11: Updating enrollment timestamp...");
    conn.execute(
        "UPDATE enrollments
         SET updated_at = ?1
         WHERE id = ?2",
        params![&now, enrollment_id],
    )
    .map_err(|e| format!("Failed to update enrollment timestamp: {}", e))?;
    println!("📅 Enrollment timestamp updated");

    println!("✅ ========================================");
    println!("✅ mark_content_as_completed COMPLETE");
    println!("✅ ========================================");

    Ok("Content marked as completed successfully".to_string())
}

// ✅ Helper function remains the same
fn check_module_auto_completion(
    conn: &rusqlite::Connection,
    enrollment_id: &str,
    module_id: &str,
) -> Result<bool, String> {
    // Check if all content is completed
    let all_content_completed: bool = conn
        .query_row(
            "SELECT
                CASE
                    WHEN COUNT(*) = 0 THEN 0
                    WHEN COUNT(*) = COUNT(CASE WHEN cp.is_completed = 1 THEN 1 END) THEN 1
                    ELSE 0
                END as all_completed
             FROM content_blocks cb
             LEFT JOIN content_progress cp
                ON cb.id = cp.content_id
                AND cp.enrollment_id = ?1
             WHERE cb.module_id = ?2",
            params![enrollment_id, module_id],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !all_content_completed {
        return Ok(false);
    }

    // Check if module has a quiz
    let has_quiz: bool = conn
        .query_row(
            "SELECT has_quiz FROM modules WHERE id = ?1",
            params![module_id],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !has_quiz {
        // No quiz - can auto-complete
        return Ok(true);
    }

    // Check if quiz is passed
    let quiz_passed: bool = conn
        .query_row(
            "SELECT EXISTS(
                SELECT 1 FROM quiz_attempts qa
                JOIN quizzes q ON qa.quiz_id = q.id
                JOIN users u ON qa.student_id = u.id
                JOIN enrollments e ON u.id = e.student_id
                WHERE q.module_id = ?1
                  AND e.id = ?2
                  AND qa.status = 'completed'
                  AND qa.passed = 1
             )",
            params![module_id, enrollment_id],
            |row| row.get(0),
        )
        .unwrap_or(false);

    Ok(quiz_passed)
}

// ============================================================================
// QUIZ ATTEMPT COMMANDS
// ============================================================================

#[tauri::command]
pub fn save_quiz_attempt(db_path: String, attempt_data: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let attempt: JsonValue = serde_json::from_str(&attempt_data)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO quiz_attempts
         (id, student_id, quiz_id, attempt_number, status, started_at, completed_at,
          score, passed, time_remaining_seconds, created_at, updated_at, last_synced_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, datetime('now'))",
        params![
            attempt["id"].as_str(),
            attempt["student_id"].as_str(),
            attempt["quiz_id"].as_str(),
            attempt["attempt_number"].as_i64(),
            attempt["status"].as_str(),
            attempt["started_at"].as_str(),
            attempt["completed_at"].as_str(),
            attempt["score"].as_f64(),
            attempt["passed"].as_bool(),
            attempt["time_remaining_seconds"].as_i64(),
            attempt["created_at"].as_str(),
            attempt["updated_at"].as_str(),
        ],
    )
    .map_err(|e| format!("Failed to save quiz attempt: {}", e))?;

    Ok("Quiz attempt saved successfully".to_string())
}

#[tauri::command]
pub fn get_quiz_attempts(db_path: String, quiz_id: String, student_id: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT json_object(
                'id', id,
                'student_id', student_id,
                'quiz_id', quiz_id,
                'attempt_number', attempt_number,
                'status', status,
                'started_at', started_at,
                'completed_at', completed_at,
                'score', score,
                'passed', passed,
                'time_remaining_seconds', time_remaining_seconds,
                'created_at', created_at,
                'updated_at', updated_at
             ) FROM quiz_attempts
             WHERE quiz_id = ?1 AND student_id = ?2
             ORDER BY attempt_number DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let attempts: Vec<String> = stmt
        .query_map(params![quiz_id, student_id], |row| row.get(0))
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let attempts_json = format!("[{}]", attempts.join(","));
    Ok(attempts_json)
}

#[tauri::command]
pub fn get_quiz_attempt_by_id(db_path: String, attempt_id: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let attempt_json: String = conn
        .query_row(
            "SELECT json_object(
                'id', id,
                'student_id', student_id,
                'quiz_id', quiz_id,
                'attempt_number', attempt_number,
                'status', status,
                'started_at', started_at,
                'completed_at', completed_at,
                'score', score,
                'passed', passed,
                'time_remaining_seconds', time_remaining_seconds,
                'created_at', created_at,
                'updated_at', updated_at
             ) FROM quiz_attempts WHERE id = ?1",
            params![attempt_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Attempt not found: {}", e))?;

    Ok(attempt_json)
}

#[tauri::command]
pub fn update_quiz_attempt_status(
    db_path: String,
    attempt_id: String,
    status: String,
    score: Option<f64>,
    passed: Option<bool>,
) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();

    if status == "completed" {
        conn.execute(
            "UPDATE quiz_attempts
             SET status = ?1, completed_at = ?2, score = ?3, passed = ?4, updated_at = ?5, last_synced_at = datetime('now')
             WHERE id = ?6",
            params![status, now, score, passed, now, attempt_id],
        )
        .map_err(|e| format!("Failed to update attempt: {}", e))?;
    } else {
        conn.execute(
            "UPDATE quiz_attempts
             SET status = ?1, updated_at = ?2, last_synced_at = datetime('now')
             WHERE id = ?3",
            params![status, now, attempt_id],
        )
        .map_err(|e| format!("Failed to update attempt: {}", e))?;
    }

    Ok("Quiz attempt updated successfully".to_string())
}

// ============================================================================
// QUIZ ANSWER COMMANDS
// ============================================================================

#[tauri::command]
pub fn save_quiz_answer(db_path: String, answer_data: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let answer: JsonValue = serde_json::from_str(&answer_data)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    // ✅ Convert is_correct to explicit integer for SQLite
    let is_correct_value = match answer["is_correct"].as_i64() {
        Some(v) => v,
        None => match answer["is_correct"].as_bool() {
            Some(true) => 1,
            Some(false) => 0,
            None => 0
        }
    };

    conn.execute(
        "INSERT OR REPLACE INTO quiz_answers
         (id, attempt_id, question_id, selected_option_id, is_correct, points_earned, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            answer["id"].as_str(),
            answer["attempt_id"].as_str(),
            answer["question_id"].as_str(),
            answer["selected_option_id"].as_str(),
            is_correct_value,  // ✅ Explicit integer
            answer["points_earned"].as_f64(),
            answer["created_at"].as_str(),
            answer["updated_at"].as_str(),
        ],
    )
    .map_err(|e| format!("Failed to save quiz answer: {}", e))?;

    Ok("Quiz answer saved successfully".to_string())
}

#[tauri::command]
pub fn get_attempt_answers(db_path: String, attempt_id: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT json_object(
                'id', qa.id,
                'attempt_id', qa.attempt_id,
                'question_id', qa.question_id,
                'selected_option_id', qa.selected_option_id,
                'is_correct', qa.is_correct,
                'points_earned', qa.points_earned,
                'created_at', qa.created_at,
                'updated_at', qa.updated_at
             ) FROM quiz_answers qa
             JOIN questions q ON qa.question_id = q.id
             WHERE qa.attempt_id = ?1
             ORDER BY q.order_index ASC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let answers: Vec<String> = stmt
        .query_map(params![attempt_id], |row| row.get(0))
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let answers_json = format!("[{}]", answers.join(","));
    Ok(answers_json)
}

#[tauri::command]
pub fn calculate_attempt_score(db_path: String, attempt_id: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let score_json: String = conn
        .query_row(
            "SELECT json_object(
                'total_questions', COALESCE(COUNT(*), 0),
                'correct_answers', COALESCE(SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END), 0),
                'points_earned', COALESCE(SUM(points_earned), 0.0),
                'points_possible', COALESCE((
                    SELECT SUM(q.points)
                    FROM questions q
                    WHERE q.quiz_id = (
                        SELECT quiz_id FROM quiz_attempts WHERE id = ?1
                    )
                ), 0.0),
                'percentage', COALESCE(
                    ROUND(
                        CAST(COALESCE(SUM(points_earned), 0.0) AS FLOAT) /
                        NULLIF(COALESCE((
                            SELECT SUM(q.points)
                            FROM questions q
                            WHERE q.quiz_id = (
                                SELECT quiz_id FROM quiz_attempts WHERE id = ?1
                            )
                        ), 0.0), 0.0) * 100,
                        2
                    ),
                    0.0
                )
             ) FROM quiz_answers
             WHERE attempt_id = ?1",
            params![attempt_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to calculate score: {}", e))?;

    Ok(score_json)
}

#[tauri::command]
pub fn get_best_quiz_score(
    db_path: String,
    quiz_id: String,
    student_id: String,
) -> Result<Option<f64>, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let best_score: Option<f64> = conn
        .query_row(
            "SELECT MAX(score) FROM quiz_attempts
             WHERE quiz_id = ?1 AND student_id = ?2 AND status = 'completed'",
            params![quiz_id, student_id],
            |row| row.get(0),
        )
        .ok();

    Ok(best_score)
}
