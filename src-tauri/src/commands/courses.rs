use crate::commands::get_connection;
use rusqlite::params;
use serde_json::Value as JsonValue;

// ============================================================================
// COURSE COMMANDS
// ============================================================================

#[tauri::command]
pub fn save_course(db_path: String, course_data: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let course: JsonValue = serde_json::from_str(&course_data)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    // Handle the image object if it exists (CourseBasic has image?: CourseMediaBasic | null)
    let image_id = if let Some(image) = course.get("image").and_then(|v| v.as_object()) {
        image.get("id").and_then(|v| v.as_str())
    } else {
        course["image_id"].as_str()
    };

    conn.execute(
        "INSERT OR REPLACE INTO courses
         (id, title, description, image_id, created_by, is_published,
          module_count, enrollment_count, category, level, duration,
          created_at, updated_at, last_synced_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, datetime('now'))",
        params![
            course["id"].as_str(),
            course["title"].as_str(),
            course["description"].as_str(),
            image_id,
            course["created_by"].as_str(),
            course["is_published"].as_bool(),
            course["module_count"].as_i64(),
            course["enrollment_count"].as_i64(),
            course["category"].as_str(),
            course["level"].as_str(),
            course["duration"].as_i64(),
            course["created_at"].as_str(),
            course["updated_at"].as_str(),
        ],
    )
    .map_err(|e| format!("Failed to save course: {}", e))?;

    Ok("Course saved successfully".to_string())
}

#[tauri::command]
pub fn save_courses_bulk(db_path: String, courses_data: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let courses: Vec<JsonValue> = serde_json::from_str(&courses_data)
        .map_err(|e| format!("Invalid JSON array: {}", e))?;

    let mut count = 0;
    for course in courses {
        // Handle the image object if it exists
        let image_id = if let Some(image) = course.get("image").and_then(|v| v.as_object()) {
            image.get("id").and_then(|v| v.as_str())
        } else {
            course["image_id"].as_str()
        };

        conn.execute(
            "INSERT OR REPLACE INTO courses
             (id, title, description, image_id, created_by, is_published,
              module_count, enrollment_count, category, level, duration,
              created_at, updated_at, last_synced_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, datetime('now'))",
            params![
                course["id"].as_str(),
                course["title"].as_str(),
                course["description"].as_str(),
                image_id,
                course["created_by"].as_str(),
                course["is_published"].as_bool(),
                course["module_count"].as_i64(),
                course["enrollment_count"].as_i64(),
                course["category"].as_str(),
                course["level"].as_str(),
                course["duration"].as_i64(),
                course["created_at"].as_str(),
                course["updated_at"].as_str(),
            ],
        )
        .map_err(|e| format!("Failed to save course: {}", e))?;
        count += 1;
    }

    Ok(format!("{} courses saved successfully", count))
}

#[tauri::command]
pub fn get_all_courses(db_path: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT json_object(
                'id', c.id,
                'title', c.title,
                'description', c.description,
                'image', CASE
                    WHEN cm.id IS NOT NULL THEN json_object(
                        'id', cm.id,
                        'file_id', cm.file_id,
                        'filename', cm.filename,
                        'media_type', cm.media_type,
                        'public_url', cm.public_url,
                        'size_bytes', cm.size_bytes,
                        'uploaded_by', cm.uploaded_by,
                        'created_at', cm.created_at
                    )
                    ELSE NULL
                END,
                'is_published', c.is_published,
                'module_count', c.module_count,
                'enrollment_count', c.enrollment_count,
                'category', c.category,
                'level', c.level,
                'duration', c.duration,
                'created_at', c.created_at,
                'updated_at', c.updated_at
             ) FROM courses c
             LEFT JOIN course_media cm ON c.image_id = cm.id
             ORDER BY c.created_at DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let courses: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let courses_json = format!("[{}]", courses.join(","));
    Ok(courses_json)
}

#[tauri::command]
pub fn get_enrolled_courses(db_path: String, student_id: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT json_object(
                'id', c.id,
                'title', c.title,
                'description', c.description,
                'image', CASE
                    WHEN cm.id IS NOT NULL THEN json_object(
                        'id', cm.id,
                        'file_id', cm.file_id,
                        'filename', cm.filename,
                        'media_type', cm.media_type,
                        'public_url', cm.public_url,
                        'size_bytes', cm.size_bytes,
                        'uploaded_by', cm.uploaded_by,
                        'created_at', cm.created_at
                    )
                    ELSE NULL
                END,
                'is_published', c.is_published,
                'module_count', c.module_count,
                'enrollment_count', c.enrollment_count,
                'category', c.category,
                'level', c.level,
                'duration', c.duration,
                'enrollment_status', e.status,
                'enrolled_at', e.enrolled_at
             ) FROM courses c
             LEFT JOIN course_media cm ON c.image_id = cm.id
             JOIN enrollments e ON c.id = e.course_id
             WHERE e.student_id = ?1
             ORDER BY e.enrolled_at DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let courses: Vec<String> = stmt
        .query_map(params![student_id], |row| row.get(0))
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let courses_json = format!("[{}]", courses.join(","));
    Ok(courses_json)
}

#[tauri::command]
pub fn get_course_by_id(db_path: String, course_id: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let course_json: String = conn
        .query_row(
            "SELECT json_object(
                'id', c.id,
                'title', c.title,
                'description', c.description,
                'image', CASE
                    WHEN cm.id IS NOT NULL THEN json_object(
                        'id', cm.id,
                        'file_id', cm.file_id,
                        'filename', cm.filename,
                        'media_type', cm.media_type,
                        'public_url', cm.public_url,
                        'size_bytes', cm.size_bytes,
                        'uploaded_by', cm.uploaded_by,
                        'created_at', cm.created_at
                    )
                    ELSE NULL
                END,
                'image_id', c.image_id,
                'created_by', c.created_by,
                'is_published', c.is_published,
                'module_count', c.module_count,
                'enrollment_count', c.enrollment_count,
                'category', c.category,
                'level', c.level,
                'duration', c.duration,
                'created_at', c.created_at,
                'updated_at', c.updated_at
             ) FROM courses c
             LEFT JOIN course_media cm ON c.image_id = cm.id
             WHERE c.id = ?1",
            params![course_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Course not found: {}", e))?;

    Ok(course_json)
}

// ============================================================================
// COURSE MEDIA COMMANDS
// ============================================================================

#[tauri::command]
pub fn save_course_media(db_path: String, media_data: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let media: JsonValue = serde_json::from_str(&media_data)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO course_media
         (id, file_id, filename, media_type, public_url, size_bytes, uploaded_by, created_at, last_synced_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))",
        params![
            media["id"].as_str(),
            media["file_id"].as_str(),
            media["filename"].as_str(),
            media["media_type"].as_str(),
            media["public_url"].as_str(),
            media["size_bytes"].as_i64(),
            media["uploaded_by"].as_str(),
            media["created_at"].as_str(),
        ],
    )
    .map_err(|e| format!("Failed to save course media: {}", e))?;

    Ok("Course media saved successfully".to_string())
}

// ============================================================================
// ENROLLMENT COMMANDS
// ============================================================================

#[tauri::command]
pub fn save_enrollment(db_path: String, enrollment_data: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let enrollment: JsonValue = serde_json::from_str(&enrollment_data)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO enrollments
         (id, student_id, course_id, status, enrolled_at, completed_at, created_at, updated_at, last_synced_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))",
        params![
            enrollment["id"].as_str(),
            enrollment["student_id"].as_str(),
            enrollment["course_id"].as_str(),
            enrollment["status"].as_str(),
            enrollment["enrolled_at"].as_str(),
            enrollment["completed_at"].as_str(),
            enrollment["created_at"].as_str(),
            enrollment["updated_at"].as_str(),
        ],
    )
    .map_err(|e| format!("Failed to save enrollment: {}", e))?;

    Ok("Enrollment saved successfully".to_string())
}

#[tauri::command]
pub fn get_user_enrollments(db_path: String, student_id: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT json_object(
                'id', e.id,
                'student_id', e.student_id,
                'course_id', e.course_id,
                'status', e.status,
                'enrolled_at', e.enrolled_at,
                'completed_at', e.completed_at,
                'created_at', e.created_at,
                'updated_at', e.updated_at,
                'course', json_object(
                    'id', c.id,
                    'title', c.title,
                    'description', c.description,
                    'image', CASE
                        WHEN cm.id IS NOT NULL THEN json_object(
                            'id', cm.id,
                            'file_id', cm.file_id,
                            'filename', cm.filename,
                            'media_type', cm.media_type,
                            'public_url', cm.public_url,
                            'size_bytes', cm.size_bytes,
                            'uploaded_by', cm.uploaded_by,
                            'created_at', cm.created_at
                        )
                        ELSE NULL
                    END,
                    'is_published', c.is_published,
                    'module_count', c.module_count,
                    'enrollment_count', c.enrollment_count,
                    'category', c.category,
                    'level', c.level,
                    'duration', c.duration,
                    'created_at', c.created_at,
                    'updated_at', c.updated_at
                )
             ) FROM enrollments e
             JOIN courses c ON e.course_id = c.id
             LEFT JOIN course_media cm ON c.image_id = cm.id
             WHERE e.student_id = ?1
             ORDER BY e.enrolled_at DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let enrollments: Vec<String> = stmt
        .query_map(params![student_id], |row| row.get(0))
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let enrollments_json = format!("[{}]", enrollments.join(","));
    Ok(enrollments_json)
}

#[tauri::command]
pub fn check_enrollment_exists(
    db_path: String,
    student_id: String,
    course_id: String,
) -> Result<bool, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM enrollments WHERE student_id = ?1 AND course_id = ?2",
            params![student_id, course_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Query failed: {}", e))?;

    Ok(count > 0)
}
