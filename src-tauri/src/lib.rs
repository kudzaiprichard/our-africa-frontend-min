mod database;

use tauri::Manager;

#[tauri::command]
fn toggle_fullscreen(window: tauri::Window) -> Result<bool, String> {
    let is_fullscreen = window.is_fullscreen()
        .map_err(|e| format!("Failed to check fullscreen status: {}", e))?;

    window.set_fullscreen(!is_fullscreen)
        .map_err(|e| format!("Failed to toggle fullscreen: {}", e))?;

    Ok(!is_fullscreen)
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

      // Start in fullscreen mode
      let window = app.get_webview_window("main").unwrap();
      let _ = window.set_fullscreen(true);

      Ok(())
    })
    .plugin(tauri_plugin_sql::Builder::default().build())
    .invoke_handler(tauri::generate_handler![toggle_fullscreen])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
