use serde_json::{json, Value};
use tauri::command;
use tauri::AppHandle;

#[command]
pub fn get_package_info(app_handle: AppHandle) -> Value {
    let info = app_handle.package_info();
    json!({
        "name": info.name,
        "version": info.version.to_string()
    })
}
