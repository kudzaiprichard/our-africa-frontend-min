use crate::commands::get_connection;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthToken {
    pub token: String,
    pub token_type: String,
    pub expires_at: String,
    pub created_at: String,
    pub is_refresh_token: bool,
}

#[tauri::command]
pub fn save_auth_tokens(
    db_path: String,
    access_token: String,
    access_expires_at: String,
    refresh_token: String,
    refresh_expires_at: String,
) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    // Clear existing tokens
    conn.execute("DELETE FROM auth_tokens", [])
        .map_err(|e| format!("Failed to clear old tokens: {}", e))?;

    // Insert access token
    conn.execute(
        "INSERT INTO auth_tokens (token, token_type, expires_at, created_at, is_refresh_token)
         VALUES (?1, ?2, ?3, datetime('now'), 0)",
        params![access_token, "Bearer", access_expires_at],
    )
    .map_err(|e| format!("Failed to save access token: {}", e))?;

    // Insert refresh token
    conn.execute(
        "INSERT INTO auth_tokens (token, token_type, expires_at, created_at, is_refresh_token)
         VALUES (?1, ?2, ?3, datetime('now'), 1)",
        params![refresh_token, "Bearer", refresh_expires_at],
    )
    .map_err(|e| format!("Failed to save refresh token: {}", e))?;

    Ok("Tokens saved successfully".to_string())
}

#[tauri::command]
pub fn get_auth_tokens(db_path: String) -> Result<(Option<AuthToken>, Option<AuthToken>), String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    // Get access token
    let access_token = conn
        .query_row(
            "SELECT token, token_type, expires_at, created_at FROM auth_tokens
             WHERE is_refresh_token = 0 ORDER BY created_at DESC LIMIT 1",
            [],
            |row| {
                Ok(AuthToken {
                    token: row.get(0)?,
                    token_type: row.get(1)?,
                    expires_at: row.get(2)?,
                    created_at: row.get(3)?,
                    is_refresh_token: false,
                })
            },
        )
        .ok();

    // Get refresh token
    let refresh_token = conn
        .query_row(
            "SELECT token, token_type, expires_at, created_at FROM auth_tokens
             WHERE is_refresh_token = 1 ORDER BY created_at DESC LIMIT 1",
            [],
            |row| {
                Ok(AuthToken {
                    token: row.get(0)?,
                    token_type: row.get(1)?,
                    expires_at: row.get(2)?,
                    created_at: row.get(3)?,
                    is_refresh_token: true,
                })
            },
        )
        .ok();

    Ok((access_token, refresh_token))
}

#[tauri::command]
pub fn clear_auth_tokens(db_path: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    conn.execute("DELETE FROM auth_tokens", [])
        .map_err(|e| format!("Failed to clear tokens: {}", e))?;

    // Also clear user data on logout
    conn.execute("DELETE FROM users", [])
        .map_err(|e| format!("Failed to clear user data: {}", e))?;

    Ok("Tokens and user data cleared successfully".to_string())
}

#[tauri::command]
pub fn check_token_expired(expires_at: String) -> Result<bool, String> {
    // Parse ISO 8601 datetime and compare with current time
    // Returns true if expired
    use chrono::{DateTime, Utc};

    let expiry = DateTime::parse_from_rfc3339(&expires_at)
        .map_err(|e| format!("Invalid datetime format: {}", e))?;

    let now = Utc::now();

    Ok(now > expiry)
}

#[tauri::command]
pub fn save_user(db_path: String, user_data: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let user: JsonValue = serde_json::from_str(&user_data)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    // Generate full_name if not provided
    let full_name = user["full_name"].as_str()
        .map(|s| s.to_string())
        .or_else(|| {
            let first = user["first_name"].as_str()?;
            let last = user["last_name"].as_str()?;
            Some(format!("{} {}", first, last).trim().to_string())
        })
        .ok_or("Missing full_name, first_name, or last_name")?;

    conn.execute(
        "INSERT OR REPLACE INTO users
         (id, email, first_name, middle_name, last_name, full_name, bio, phone_number,
          role, is_active, profile_image_url, profile_image_file_id, created_at, updated_at, last_synced_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, datetime('now'))",
        params![
            user["id"].as_str(),
            user["email"].as_str(),
            user["first_name"].as_str(),
            user["middle_name"].as_str(),
            user["last_name"].as_str(),
            full_name,
            user["bio"].as_str(),
            user["phone_number"].as_str(),
            user["role"].as_str(),
            user["is_active"].as_bool(),
            user["profile_image_url"].as_str(),
            user["profile_image_file_id"].as_str(),
            user["created_at"].as_str(),
            user["updated_at"].as_str(),
        ],
    )
    .map_err(|e| format!("Failed to save user: {}", e))?;

    Ok("User saved successfully".to_string())
}

#[tauri::command]
pub fn get_current_user(db_path: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let user_json: String = conn
        .query_row(
            "SELECT json_object(
                'id', id,
                'email', email,
                'first_name', first_name,
                'middle_name', middle_name,
                'last_name', last_name,
                'full_name', full_name,
                'bio', bio,
                'phone_number', phone_number,
                'role', role,
                'is_active', is_active,
                'profile_image_url', profile_image_url,
                'profile_image_file_id', profile_image_file_id,
                'created_at', created_at,
                'updated_at', updated_at
             ) FROM users LIMIT 1",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("User not found: {}", e))?;

    Ok(user_json)
}

#[tauri::command]
pub fn get_user_by_email(db_path: String, email: String) -> Result<String, String> {
    let conn = get_connection(&db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let user_json: String = conn
        .query_row(
            "SELECT json_object(
                'id', id,
                'email', email,
                'first_name', first_name,
                'middle_name', middle_name,
                'last_name', last_name,
                'full_name', full_name,
                'bio', bio,
                'phone_number', phone_number,
                'role', role,
                'is_active', is_active,
                'profile_image_url', profile_image_url,
                'profile_image_file_id', profile_image_file_id,
                'created_at', created_at,
                'updated_at', updated_at
             ) FROM users WHERE email = ?1 LIMIT 1",
            [&email],
            |row| row.get(0),
        )
        .map_err(|e| format!("User with email '{}' not found: {}", email, e))?;

    Ok(user_json)
}
