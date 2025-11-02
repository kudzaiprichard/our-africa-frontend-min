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
// CONTENT BLOCK COMMANDS
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
    println!("🔍 ========================================");
    println!("🔍 get_module_content CALLED");
    println!("🔍 ========================================");
    println!("🔍 module_id: {}", module_id);

    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    // ✅ STEP 1: Get the course_id from module
    println!("📦 STEP 1: Getting course_id from module...");
    let course_id: String = conn
        .query_row(
            "SELECT course_id FROM modules WHERE id = ?1",
            params![module_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Module not found: {}", e))?;
    println!("📦 Found course_id: {}", course_id);

    // ✅ STEP 2: Get the enrollment_id for this course
    println!("👤 STEP 2: Getting enrollment_id...");
    let enrollment_id: Result<String, rusqlite::Error> = conn.query_row(
        "SELECT e.id FROM enrollments e
         JOIN users u ON e.student_id = u.id
         WHERE e.course_id = ?1
         ORDER BY e.created_at DESC
         LIMIT 1",
        params![course_id],
        |row| row.get(0),
    );

    if let Ok(ref enroll_id) = enrollment_id {
        println!("👤 Found enrollment_id: {}", enroll_id);
    } else {
        println!("⚠️ No enrollment found for this course");
    }

    // ✅ STEP 3: Debug - Check ALL content_progress for this enrollment
    if let Ok(ref enroll_id) = enrollment_id {
        println!("🔍 STEP 3: Checking ALL content_progress for enrollment {}...", enroll_id);

        let debug_stmt = conn.prepare(
            "SELECT cp.id, cp.content_id, cp.is_completed, cp.completed_at, cb.module_id
             FROM content_progress cp
             LEFT JOIN content_blocks cb ON cp.content_id = cb.id
             WHERE cp.enrollment_id = ?1
             ORDER BY cp.updated_at DESC"
        );

        if let Ok(mut stmt) = debug_stmt {
            let rows = stmt.query_map(params![enroll_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?
                ))
            });

            if let Ok(rows) = rows {
                let all_progress: Vec<_> = rows.filter_map(|r| r.ok()).collect();
                println!("📊 Total content_progress records: {}", all_progress.len());

                for (idx, (id, content_id, is_completed, completed_at, mod_id)) in all_progress.iter().enumerate() {
                    println!("   Progress {}: id={}, content_id={}, module_id={:?}, is_completed={}, at={:?}",
                        idx + 1, id, content_id, mod_id, is_completed, completed_at);
                }
            }
        }

        // ✅ STEP 4: Specifically check content_progress for THIS module
        println!("🔍 STEP 4: Checking content_progress for THIS module {}...", module_id);

        let module_progress_stmt = conn.prepare(
            "SELECT cp.content_id, cp.is_completed, cp.completed_at
             FROM content_progress cp
             JOIN content_blocks cb ON cp.content_id = cb.id
             WHERE cb.module_id = ?1 AND cp.enrollment_id = ?2"
        );

        if let Ok(mut stmt) = module_progress_stmt {
            let rows = stmt.query_map(params![module_id, enroll_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, Option<String>>(2)?
                ))
            });

            if let Ok(rows) = rows {
                let module_progress: Vec<_> = rows.filter_map(|r| r.ok()).collect();
                println!("📊 Content progress for THIS module: {}", module_progress.len());

                for (content_id, is_completed, completed_at) in module_progress.iter() {
                    println!("   📝 Content: {} | Completed: {} | At: {:?}",
                        content_id, is_completed, completed_at);
                }
            }
        }
    }

    // ✅ STEP 5: Query content blocks WITH progress (if enrollment exists)
    println!("📚 STEP 5: Querying content blocks with progress...");

    let query = if let Ok(ref enroll_id) = enrollment_id {
        println!("📚 Using LEFT JOIN with enrollment_id: {}", enroll_id);
        format!(
            "SELECT json_object(
                'id', cb.id,
                'module_id', cb.module_id,
                'title', cb.title,
                'content_data', json(cb.content_data),
                'order', cb.order_index,
                'created_at', cb.created_at,
                'updated_at', cb.updated_at,
                'progress', CASE
                    WHEN cp.id IS NOT NULL THEN json_object(
                        'id', cp.id,
                        'enrollment_id', cp.enrollment_id,
                        'content_id', cp.content_id,
                        'is_completed', cp.is_completed,
                        'viewed_at', cp.viewed_at,
                        'completed_at', cp.completed_at,
                        'created_at', cp.created_at,
                        'updated_at', cp.updated_at
                    )
                    ELSE NULL
                END
             ) FROM content_blocks cb
             LEFT JOIN content_progress cp
                ON cb.id = cp.content_id
                AND cp.enrollment_id = '{}'
             WHERE cb.module_id = ?1
             ORDER BY cb.order_index ASC",
            enroll_id
        )
    } else {
        println!("📚 No enrollment - returning content without progress");
        "SELECT json_object(
            'id', cb.id,
            'module_id', cb.module_id,
            'title', cb.title,
            'content_data', json(cb.content_data),
            'order', cb.order_index,
            'created_at', cb.created_at,
            'updated_at', cb.updated_at,
            'progress', NULL
         ) FROM content_blocks cb
         WHERE cb.module_id = ?1
         ORDER BY cb.order_index ASC".to_string()
    };

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let contents: Vec<String> = stmt
        .query_map(params![module_id], |row| row.get(0))
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    println!("📚 Found {} content blocks", contents.len());

    // ✅ STEP 6: Debug - Parse and log each content block
    println!("🔍 STEP 6: Parsing returned content blocks...");
    for (idx, content_json) in contents.iter().enumerate() {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(content_json) {
            let id = parsed["id"].as_str().unwrap_or("unknown");
            let has_progress = !parsed["progress"].is_null();
            let is_completed = parsed["progress"]["is_completed"].as_i64().unwrap_or(0);
            let completed_at = parsed["progress"]["completed_at"].as_str();

            println!("   Content {}: id={}, has_progress={}, is_completed={}, at={:?}",
                idx + 1, id, has_progress, is_completed, completed_at);
        }
    }

    let contents_json = format!("[{}]", contents.join(","));

    println!("✅ ========================================");
    println!("✅ get_module_content COMPLETE");
    println!("✅ Returning {} content blocks", contents.len());
    println!("✅ ========================================");

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
// QUIZ COMMANDS (WITHOUT student-specific fields)
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

    // ✅ REMOVED student-specific fields - they're calculated at runtime from quiz_attempts
    conn.execute(
        "INSERT OR REPLACE INTO quizzes
         (id, title, description, quiz_type, module_id, course_id, time_limit_minutes,
          pass_mark_percentage, max_attempts, attempt_reset_hours, shuffle_questions,
          question_count, created_at, updated_at, last_synced_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, datetime('now'))",
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

    // ✅ Returns base quiz data WITHOUT student-specific fields
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
                'created_at', created_at,
                'updated_at', updated_at
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

    // ✅ Returns base quiz data WITHOUT student-specific fields
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
                'created_at', created_at,
                'updated_at', updated_at
             ) FROM quizzes WHERE id = ?1",
            params![quiz_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Quiz not found: {}", e))?;

    Ok(quiz_json)
}

#[tauri::command]
pub fn get_course_final_exam(db_path: String, course_id: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    // ✅ Returns base quiz data WITHOUT student-specific fields
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
                'created_at', created_at,
                'updated_at', updated_at
             ) FROM quizzes
             WHERE course_id = ?1 AND quiz_type = 'final_exam'
             LIMIT 1",
            params![course_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Final exam not found: {}", e))?;

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
         (id, quiz_id, question_text, image_url, order_index, points, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            question["id"].as_str(),
            question["quiz_id"].as_str(),
            question["question_text"].as_str(),
            question["image_url"].as_str(),
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
             (id, quiz_id, question_text, image_url, order_index, points, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                question["id"].as_str(),
                question["quiz_id"].as_str(),
                question["question_text"].as_str(),
                question["image_url"].as_str(),
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
                'order', q.order_index,
                'points', q.points,
                'options', (
                    SELECT json_group_array(
                        json_object(
                            'id', o.id,
                            'question_id', o.question_id,
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
