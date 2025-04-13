// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod api;

use api::get_weather; //获取Ip地址的天气
use tauri::{AppHandle, Manager};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = show_window(app);
        }))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, get_weather])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn show_window(app: &AppHandle) {
    let windows = app.webview_windows();

    let window = windows.values().next().expect("Sorry, no window found");

    // 如果窗口最小化，先取消最小化
    if let Ok(true) = window.is_minimized() {
        let _ = window.unminimize();
    }

    // 确保窗口可见
    let _ = window.show();

    // 设置焦点
    let _ = window.set_focus().expect("Can't Bring Window to Focus");
}
