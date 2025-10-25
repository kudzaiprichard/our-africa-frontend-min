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

    // ✅ ADDED: New fields for content progress tracking
    conn.execute(
        "INSERT OR REPLACE INTO module_progress
         (id, enrollment_id, module_id, status, started_at, completed_at,
          auto_completed, content_completion_percentage, completed_content_count, total_content_count,
          created_at, updated_at, last_synced_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, datetime('now'))",
        params![
            progress["id"].as_str(),
            progress["enrollment_id"].as_str(),
            progress["module_id"].as_str(),
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

    let summary_json: String = conn
        .query_row(
            "SELECT json_object(
                'total_modules', COUNT(*),
                'completed_modules', SUM(CASE WHEN mp.status = 'completed' THEN 1 ELSE 0 END),
                'in_progress_modules', SUM(CASE WHEN mp.status = 'in_progress' THEN 1 ELSE 0 END),
                'not_started_modules', SUM(CASE WHEN mp.status = 'not_started' THEN 1 ELSE 0 END),
                'completion_percentage',
                    ROUND(CAST(SUM(CASE WHEN mp.status = 'completed' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100, 2)
             ) FROM module_progress mp
             WHERE mp.enrollment_id = ?1",
            params![enrollment_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to get summary: {}", e))?;

    Ok(summary_json)
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
    enrollment_id: String,
    content_id: String,
) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();
    let progress_id = format!("cp_{}_{}", enrollment_id, content_id);

    conn.execute(
        "INSERT OR REPLACE INTO content_progress
         (id, enrollment_id, content_id, is_completed, viewed_at, created_at, updated_at, last_synced_at)
         VALUES (?1, ?2, ?3, 0, ?4, ?5, ?6, datetime('now'))
         ON CONFLICT(enrollment_id, content_id) DO UPDATE SET
            viewed_at = ?4,
            updated_at = ?6,
            last_synced_at = datetime('now')",
        params![progress_id, enrollment_id, content_id, &now, &now, &now],
    )
    .map_err(|e| format!("Failed to mark content as viewed: {}", e))?;

    Ok("Content marked as viewed successfully".to_string())
}

#[tauri::command]
pub fn mark_content_as_completed(
    db_path: String,
    enrollment_id: String,
    content_id: String,
) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();
    let progress_id = format!("cp_{}_{}", enrollment_id, content_id);

    conn.execute(
        "INSERT OR REPLACE INTO content_progress
         (id, enrollment_id, content_id, is_completed, completed_at, created_at, updated_at, last_synced_at)
         VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6, datetime('now'))
         ON CONFLICT(enrollment_id, content_id) DO UPDATE SET
            is_completed = 1,
            completed_at = ?4,
            updated_at = ?6,
            last_synced_at = datetime('now')",
        params![progress_id, enrollment_id, content_id, &now, &now, &now],
    )
    .map_err(|e| format!("Failed to mark content as completed: {}", e))?;

    Ok("Content marked as completed successfully".to_string())
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
