mod database;
mod commands;

use tauri::Manager;

#[tauri::command]
fn toggle_fullscreen(window: tauri::Window) -> Result<bool, String> {
    let is_fullscreen = window.is_fullscreen()
        .map_err(|e| format!("Failed to check fullscreen status: {}", e))?;

    window.set_fullscreen(!is_fullscreen)
        .map_err(|e| format!("Failed to toggle fullscreen: {}", e))?;

    Ok(!is_fullscreen)
}

#[tauri::command]
fn get_database_path(app: tauri::AppHandle) -> Result<String, String> {
    database::get_database_path(&app)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Initialize database
      database::initialize_database(&app.handle())?;

      // Get the window
      let window = app.get_webview_window("main").unwrap();

      // Open DevTools in debug mode
      #[cfg(debug_assertions)]
      {
        window.open_devtools();
      }

      // TEMPORARILY disabled fullscreen for debugging - change back to true when done
      let _ = window.set_fullscreen(false);

      Ok(())
    })
    .plugin(tauri_plugin_sql::Builder::default().build())
    .invoke_handler(tauri::generate_handler![
      toggle_fullscreen,
      get_database_path,

      // ========== AUTH COMMANDS ==========
      commands::auth::save_auth_tokens,
      commands::auth::get_auth_tokens,
      commands::auth::clear_auth_tokens,
      commands::auth::check_token_expired,
      commands::auth::save_user,
      commands::auth::get_current_user,
      commands::auth::get_user_by_email,

      // ========== COURSE COMMANDS ==========
      commands::courses::save_course,
      commands::courses::save_courses_bulk,
      commands::courses::get_all_courses,
      commands::courses::get_enrolled_courses,
      commands::courses::get_course_by_id,
      commands::courses::save_course_media,  // ✅ ADDED: New command for course media
      commands::courses::save_enrollment,
      commands::courses::get_user_enrollments,
      commands::courses::check_enrollment_exists,

      // ========== LESSON COMMANDS (Modules, Content, Quizzes, Questions) ==========
      commands::lessons::save_module,
      commands::lessons::save_modules_bulk,
      commands::lessons::get_course_modules,
      commands::lessons::get_module_by_id,
      commands::lessons::save_content_block,
      commands::lessons::save_content_blocks_bulk,
      commands::lessons::get_module_content,
      commands::lessons::get_content_block_by_id,
      commands::lessons::save_quiz,
      commands::lessons::get_module_quiz,
      commands::lessons::get_quiz_by_id,
      commands::lessons::get_course_final_exam,
      commands::lessons::save_question,
      commands::lessons::save_questions_bulk,
      commands::lessons::get_quiz_questions,

      // ========== PROGRESS COMMANDS (Module Progress, Content Progress, Quiz Attempts) ==========
      commands::progress::save_module_progress,
      commands::progress::get_enrollment_progress,
      commands::progress::update_module_status,
      commands::progress::get_course_progress_summary,
      // Content Progress 
      commands::progress::save_content_progress,
      commands::progress::get_content_progress,
      commands::progress::get_content_progress_by_content_id,
      commands::progress::mark_content_as_viewed,
      commands::progress::mark_content_as_completed,
      // Quiz Attempts
      commands::progress::save_quiz_attempt,
      commands::progress::get_quiz_attempts,
      commands::progress::get_quiz_attempt_by_id,
      commands::progress::update_quiz_attempt_status,
      commands::progress::save_quiz_answer,
      commands::progress::get_attempt_answers,
      commands::progress::calculate_attempt_score,
      commands::progress::get_best_quiz_score,

      // ========== SYNC COMMANDS ==========
      commands::sync::add_to_sync_queue,
      commands::sync::get_sync_queue,
      commands::sync::get_sync_queue_count,
      commands::sync::remove_from_sync_queue,
      commands::sync::remove_multiple_from_sync_queue,
      commands::sync::update_sync_queue_retry,
      commands::sync::clear_sync_queue,
      commands::sync::get_sync_queue_by_table,
      commands::sync::set_app_metadata,
      commands::sync::get_app_metadata,
      commands::sync::get_all_app_metadata,
      commands::sync::set_last_sync_time,
      commands::sync::get_last_sync_time,
      commands::sync::set_offline_mode,
      commands::sync::is_offline_mode,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
