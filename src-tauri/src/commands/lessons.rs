use crate::commands::get_connection;
use rusqlite::params;
use serde_json::Value as JsonValue;

// ============================================================================
// MODULE COMMANDS
// ============================================================================

#[tauri::command]
pub fn save_module(db_path: String, module_data: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let module: JsonValue = serde_json::from_str(&module_data)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO modules
         (id, course_id, title, description, order_index, content_count, has_quiz, created_at, updated_at, last_synced_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, datetime('now'))",
        params![
            module["id"].as_str(),
            module["course_id"].as_str(),
            module["title"].as_str(),
            module["description"].as_str(),
            module["order"].as_i64().or(module["order_index"].as_i64()),
            module["content_count"].as_i64(),
            module["has_quiz"].as_bool(),
            module["created_at"].as_str(),
            module["updated_at"].as_str(),
        ],
    )
    .map_err(|e| format!("Failed to save module: {}", e))?;

    Ok("Module saved successfully".to_string())
}

#[tauri::command]
pub fn save_modules_bulk(db_path: String, modules_data: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let modules: Vec<JsonValue> = serde_json::from_str(&modules_data)
        .map_err(|e| format!("Invalid JSON array: {}", e))?;

    let mut count = 0;
    for module in modules {
        conn.execute(
            "INSERT OR REPLACE INTO modules
             (id, course_id, title, description, order_index, content_count, has_quiz, created_at, updated_at, last_synced_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, datetime('now'))",
            params![
                module["id"].as_str(),
                module["course_id"].as_str(),
                module["title"].as_str(),
                module["description"].as_str(),
                module["order"].as_i64().or(module["order_index"].as_i64()),
                module["content_count"].as_i64(),
                module["has_quiz"].as_bool(),
                module["created_at"].as_str(),
                module["updated_at"].as_str(),
            ],
        )
        .map_err(|e| format!("Failed to save module: {}", e))?;
        count += 1;
    }

    Ok(format!("{} modules saved successfully", count))
}

#[tauri::command]
pub fn get_course_modules(db_path: String, course_id: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT json_object(
                'id', id,
                'course_id', course_id,
                'title', title,
                'description', description,
                'order', order_index,
                'content_count', content_count,
                'has_quiz', has_quiz,
                'created_at', created_at,
                'updated_at', updated_at
             ) FROM modules WHERE course_id = ?1 ORDER BY order_index ASC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let modules: Vec<String> = stmt
        .query_map(params![course_id], |row| row.get(0))
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let modules_json = format!("[{}]", modules.join(","));
    Ok(modules_json)
}

#[tauri::command]
pub fn get_module_by_id(db_path: String, module_id: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let module_json: String = conn
        .query_row(
            "SELECT json_object(
                'id', id,
                'course_id', course_id,
                'title', title,
                'description', description,
                'order', order_index,
                'content_count', content_count,
                'has_quiz', has_quiz,
                'created_at', created_at,
                'updated_at', updated_at
             ) FROM modules WHERE id = ?1",
            params![module_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Module not found: {}", e))?;

    Ok(module_json)
}

// ============================================================================
// CONTENT BLOCK COMMANDS (Quill JSON)
// ============================================================================

#[tauri::command]
pub fn save_content_block(db_path: String, content_data: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let content: JsonValue = serde_json::from_str(&content_data)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO content_blocks
         (id, module_id, title, content_data, order_index, created_at, updated_at, last_synced_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))",
        params![
            content["id"].as_str(),
            content["module_id"].as_str(),
            content["title"].as_str(),
            serde_json::to_string(&content["content_data"]).ok(),
            content["order"].as_i64().or(content["order_index"].as_i64()),
            content["created_at"].as_str(),
            content["updated_at"].as_str(),
        ],
    )
    .map_err(|e| format!("Failed to save content block: {}", e))?;

    Ok("Content block saved successfully".to_string())
}

#[tauri::command]
pub fn save_content_blocks_bulk(db_path: String, contents_data: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let contents: Vec<JsonValue> = serde_json::from_str(&contents_data)
        .map_err(|e| format!("Invalid JSON array: {}", e))?;

    let mut count = 0;
    for content in contents {
        conn.execute(
            "INSERT OR REPLACE INTO content_blocks
             (id, module_id, title, content_data, order_index, created_at, updated_at, last_synced_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))",
            params![
                content["id"].as_str(),
                content["module_id"].as_str(),
                content["title"].as_str(),
                serde_json::to_string(&content["content_data"]).ok(),
                content["order"].as_i64().or(content["order_index"].as_i64()),
                content["created_at"].as_str(),
                content["updated_at"].as_str(),
            ],
        )
        .map_err(|e| format!("Failed to save content block: {}", e))?;
        count += 1;
    }

    Ok(format!("{} content blocks saved successfully", count))
}

#[tauri::command]
pub fn get_module_content(db_path: String, module_id: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT json_object(
                'id', id,
                'module_id', module_id,
                'title', title,
                'content_data', json(content_data),
                'order', order_index,
                'created_at', created_at,
                'updated_at', updated_at
             ) FROM content_blocks WHERE module_id = ?1 ORDER BY order_index ASC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let contents: Vec<String> = stmt
        .query_map(params![module_id], |row| row.get(0))
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let contents_json = format!("[{}]", contents.join(","));
    Ok(contents_json)
}

#[tauri::command]
pub fn get_content_block_by_id(db_path: String, content_id: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let content_json: String = conn
        .query_row(
            "SELECT json_object(
                'id', id,
                'module_id', module_id,
                'title', title,
                'content_data', json(content_data),
                'order', order_index,
                'created_at', created_at,
                'updated_at', updated_at
             ) FROM content_blocks WHERE id = ?1",
            params![content_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Content block not found: {}", e))?;

    Ok(content_json)
}

// ============================================================================
// QUIZ COMMANDS
// ============================================================================

#[tauri::command]
pub fn save_quiz(db_path: String, quiz_data: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let quiz: JsonValue = serde_json::from_str(&quiz_data)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    // Generate timestamps if not provided (for student-facing DTOs)
    let now = chrono::Utc::now().to_rfc3339();
    let created_at = quiz["created_at"].as_str().unwrap_or(&now);
    let updated_at = quiz["updated_at"].as_str().unwrap_or(&now);

    conn.execute(
        "INSERT OR REPLACE INTO quizzes
         (id, title, description, quiz_type, module_id, course_id, time_limit_minutes,
          pass_mark_percentage, max_attempts, attempt_reset_hours, shuffle_questions,
          question_count, student_best_score, student_attempts_count, student_can_attempt,
          student_passed, created_at, updated_at, last_synced_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, datetime('now'))",
        params![
            quiz["id"].as_str(),
            quiz["title"].as_str(),
            quiz["description"].as_str(),
            quiz["quiz_type"].as_str(),
            quiz["module_id"].as_str(),
            quiz["course_id"].as_str(),
            quiz["time_limit_minutes"].as_i64(),
            quiz["pass_mark_percentage"].as_f64(),
            quiz["max_attempts"].as_i64(),
            quiz["attempt_reset_hours"].as_i64(),
            quiz["shuffle_questions"].as_bool(),
            quiz["question_count"].as_i64(),
            quiz["student_best_score"].as_f64(),
            quiz["student_attempts_count"].as_i64(),
            quiz["student_can_attempt"].as_bool(),
            quiz["student_passed"].as_bool(),
            created_at,
            updated_at,
        ],
    )
    .map_err(|e| format!("Failed to save quiz: {}", e))?;

    Ok("Quiz saved successfully".to_string())
}

#[tauri::command]
pub fn get_module_quiz(db_path: String, module_id: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let quiz_json: String = conn
        .query_row(
            "SELECT json_object(
                'id', id,
                'title', title,
                'description', description,
                'quiz_type', quiz_type,
                'module_id', module_id,
                'time_limit_minutes', time_limit_minutes,
                'pass_mark_percentage', pass_mark_percentage,
                'max_attempts', max_attempts,
                'attempt_reset_hours', attempt_reset_hours,
                'shuffle_questions', shuffle_questions,
                'question_count', question_count,
                'student_best_score', student_best_score,
                'student_attempts_count', student_attempts_count,
                'student_can_attempt', student_can_attempt,
                'student_passed', student_passed
             ) FROM quizzes WHERE module_id = ?1",
            params![module_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Quiz not found: {}", e))?;

    Ok(quiz_json)
}

#[tauri::command]
pub fn get_quiz_by_id(db_path: String, quiz_id: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let quiz_json: String = conn
        .query_row(
            "SELECT json_object(
                'id', id,
                'title', title,
                'description', description,
                'quiz_type', quiz_type,
                'module_id', module_id,
                'course_id', course_id,
                'time_limit_minutes', time_limit_minutes,
                'pass_mark_percentage', pass_mark_percentage,
                'max_attempts', max_attempts,
                'attempt_reset_hours', attempt_reset_hours,
                'shuffle_questions', shuffle_questions,
                'question_count', question_count,
                'student_best_score', student_best_score,
                'student_attempts_count', student_attempts_count,
                'student_can_attempt', student_can_attempt,
                'student_passed', student_passed,
                'created_at', created_at,
                'updated_at', updated_at
             ) FROM quizzes WHERE id = ?1",
            params![quiz_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Quiz not found: {}", e))?;

    Ok(quiz_json)
}

// ============================================================================
// QUESTION COMMANDS
// ============================================================================

#[tauri::command]
pub fn save_question(db_path: String, question_data: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let question: JsonValue = serde_json::from_str(&question_data)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    // Generate timestamps if not provided
    let now = chrono::Utc::now().to_rfc3339();
    let created_at = question["created_at"].as_str().unwrap_or(&now);
    let updated_at = question["updated_at"].as_str().unwrap_or(&now);

    conn.execute(
        "INSERT OR REPLACE INTO questions
         (id, quiz_id, question_text, image_url, image_file_id, order_index, points, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            question["id"].as_str(),
            question["quiz_id"].as_str(),
            question["question_text"].as_str(),
            question["image_url"].as_str(),
            question["image_file_id"].as_str(),
            question["order"].as_i64().or(question["order_index"].as_i64()),
            question["points"].as_f64(),
            created_at,
            updated_at,
        ],
    )
    .map_err(|e| format!("Failed to save question: {}", e))?;

    // Save options if provided
    if let Some(options) = question["options"].as_array() {
        for option in options {
            conn.execute(
                "INSERT OR REPLACE INTO question_options
                 (id, question_id, option_text, is_correct, order_index)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    option["id"].as_str(),
                    question["id"].as_str(),
                    option["option_text"].as_str(),
                    option["is_correct"].as_bool(),
                    option["order"].as_i64().or(option["order_index"].as_i64()),
                ],
            )
            .map_err(|e| format!("Failed to save option: {}", e))?;
        }
    }

    Ok("Question saved successfully".to_string())
}

#[tauri::command]
pub fn save_questions_bulk(db_path: String, questions_data: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let questions: Vec<JsonValue> = serde_json::from_str(&questions_data)
        .map_err(|e| format!("Invalid JSON array: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();
    let mut count = 0;

    for question in questions {
        // Generate timestamps if not provided
        let created_at = question["created_at"].as_str().unwrap_or(&now);
        let updated_at = question["updated_at"].as_str().unwrap_or(&now);

        conn.execute(
            "INSERT OR REPLACE INTO questions
             (id, quiz_id, question_text, image_url, image_file_id, order_index, points, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                question["id"].as_str(),
                question["quiz_id"].as_str(),
                question["question_text"].as_str(),
                question["image_url"].as_str(),
                question["image_file_id"].as_str(),
                question["order"].as_i64().or(question["order_index"].as_i64()),
                question["points"].as_f64(),
                created_at,
                updated_at,
            ],
        )
        .map_err(|e| format!("Failed to save question: {}", e))?;

        // Save options
        if let Some(options) = question["options"].as_array() {
            for option in options {
                conn.execute(
                    "INSERT OR REPLACE INTO question_options
                     (id, question_id, option_text, is_correct, order_index)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![
                        option["id"].as_str(),
                        question["id"].as_str(),
                        option["option_text"].as_str(),
                        option["is_correct"].as_bool(),
                        option["order"].as_i64().or(option["order_index"].as_i64()),
                    ],
                )
                .map_err(|e| format!("Failed to save option: {}", e))?;
            }
        }
        count += 1;
    }

    Ok(format!("{} questions saved successfully", count))
}

#[tauri::command]
pub fn get_quiz_questions(db_path: String, quiz_id: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT json_object(
                'id', q.id,
                'quiz_id', q.quiz_id,
                'question_text', q.question_text,
                'image_url', q.image_url,
                'image_file_id', q.image_file_id,
                'order', q.order_index,
                'points', q.points,
                'options', (
                    SELECT json_group_array(
                        json_object(
                            'id', o.id,
                            'option_text', o.option_text,
                            'is_correct', o.is_correct,
                            'order', o.order_index
                        )
                    )
                    FROM question_options o
                    WHERE o.question_id = q.id
                    ORDER BY o.order_index
                )
             ) FROM questions q
             WHERE q.quiz_id = ?1
             ORDER BY q.order_index ASC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let questions: Vec<String> = stmt
        .query_map(params![quiz_id], |row| row.get(0))
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let questions_json = format!("[{}]", questions.join(","));
    Ok(questions_json)
}
