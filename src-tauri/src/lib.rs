// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod api;

use api::get_weather; //获取Ip地址的天气
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::UpdaterExt;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match update(handle).await {
                    Ok(_) => println!("更新检查完成"),
                    Err(e) => eprintln!("更新检查失败: {}", e),
                }
            });
            Ok(())
        })
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = show_window(app);
        }))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, get_weather])
        .plugin(tauri_plugin_window_state::Builder::default().build())
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

// 添加更新函数
async fn update(app: tauri::AppHandle) -> tauri_plugin_updater::Result<()> {
    if let Some(update) = app.updater()?.check().await? {
        let mut downloaded = 0;

        // alternatively we could also call update.download() and update.install() separately
        update
            .download_and_install(
                |chunk_length, content_length| {
                    downloaded += chunk_length;
                    println!("downloaded {downloaded} from {content_length:?}");
                },
                || {
                    println!("download finished");
                },
            )
            .await?;

        println!("update installed");
        app.restart();
    }

    Ok(())
}
