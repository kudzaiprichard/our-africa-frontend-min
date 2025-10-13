use crate::commands::get_connection;
use rusqlite::params;
use serde_json::Value as JsonValue;

#[tauri::command]
pub fn save_course(db_path: String, course_data: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let course: JsonValue = serde_json::from_str(&course_data)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO courses
         (id, title, description, image_url, image_file_id, created_by, is_published,
          module_count, enrollment_count, categories, categories_display, level, duration,
          created_at, updated_at, last_synced_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, datetime('now'))",
        params![
            course["id"].as_str(),
            course["title"].as_str(),
            course["description"].as_str(),
            course["image_url"].as_str(),
            course["image_file_id"].as_str(),
            course["created_by"].as_str(),
            course["is_published"].as_bool(),
            course["module_count"].as_i64(),
            course["enrollment_count"].as_i64(),
            serde_json::to_string(&course["categories"]).ok(),
            serde_json::to_string(&course["categories_display"]).ok(),
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
        conn.execute(
            "INSERT OR REPLACE INTO courses
             (id, title, description, image_url, image_file_id, created_by, is_published,
              module_count, enrollment_count, categories, categories_display, level, duration,
              created_at, updated_at, last_synced_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, datetime('now'))",
            params![
                course["id"].as_str(),
                course["title"].as_str(),
                course["description"].as_str(),
                course["image_url"].as_str(),
                course["image_file_id"].as_str(),
                course["created_by"].as_str(),
                course["is_published"].as_bool(),
                course["module_count"].as_i64(),
                course["enrollment_count"].as_i64(),
                serde_json::to_string(&course["categories"]).ok(),
                serde_json::to_string(&course["categories_display"]).ok(),
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
                'id', id,
                'title', title,
                'description', description,
                'image_url', image_url,
                'is_published', is_published,
                'module_count', module_count,
                'enrollment_count', enrollment_count,
                'categories', json(categories),
                'categories_display', json(categories_display),
                'level', level,
                'duration', duration,
                'created_at', created_at,
                'updated_at', updated_at
             ) FROM courses ORDER BY created_at DESC",
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
                'image_url', c.image_url,
                'is_published', c.is_published,
                'module_count', c.module_count,
                'categories', json(c.categories),
                'categories_display', json(c.categories_display),
                'level', c.level,
                'duration', c.duration,
                'enrollment_status', e.status,
                'enrolled_at', e.enrolled_at
             ) FROM courses c
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
                'id', id,
                'title', title,
                'description', description,
                'image_url', image_url,
                'image_file_id', image_file_id,
                'created_by', created_by,
                'is_published', is_published,
                'module_count', module_count,
                'enrollment_count', enrollment_count,
                'categories', json(categories),
                'categories_display', json(categories_display),
                'level', level,
                'duration', duration,
                'created_at', created_at,
                'updated_at', updated_at
             ) FROM courses WHERE id = ?1",
            params![course_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Course not found: {}", e))?;

    Ok(course_json)
}

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
                    'image_url', c.image_url,
                    'is_published', c.is_published,
                    'module_count', c.module_count,
                    'categories', json(c.categories),
                    'level', c.level,
                    'duration', c.duration
                )
             ) FROM enrollments e
             JOIN courses c ON e.course_id = c.id
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
