mod games;
mod scan;

use std::fs;
use std::io::{Cursor, Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use sysinfo::System;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::CompressionMethod;

use scan::DetectedGame;

#[derive(Default)]
struct GameWatch {
    running: AtomicBool,
}

struct AppState {
    watch: Mutex<GameWatch>,
}

#[derive(Clone, Serialize)]
struct GameEventPayload {
    executable: String,
}

// ──────────────────────────── Save IO ────────────────────────────

#[tauri::command]
async fn read_save(path: String) -> Result<Vec<u8>, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("File not found: {}", path));
    }
    fs::read(p).map_err(|e| format!("Failed to read save: {}", e))
}

#[tauri::command]
async fn write_save(path: String, data: Vec<u8>) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create dir: {}", e))?;
        }
    }
    if p.exists() {
        let backup = format!("{}.savehop-backup", path);
        let _ = fs::copy(p, &backup);
    }
    fs::write(p, &data).map_err(|e| format!("Failed to write save: {}", e))?;
    Ok(())
}

#[tauri::command]
async fn read_save_folder(path: String) -> Result<Vec<u8>, String> {
    let root = Path::new(&path);
    if !root.exists() {
        return Err(format!("Folder not found: {}", path));
    }
    if !root.is_dir() {
        return Err(format!("Path is not a folder: {}", path));
    }

    let mut buf = Vec::new();
    {
        let cursor = Cursor::new(&mut buf);
        let mut zip = zip::ZipWriter::new(cursor);
        let options = SimpleFileOptions::default()
            .compression_method(CompressionMethod::Deflated)
            .unix_permissions(0o644);

        for entry in WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
            let p = entry.path();
            let rel = match p.strip_prefix(root) {
                Ok(r) => r,
                Err(_) => continue,
            };
            if rel.as_os_str().is_empty() {
                continue;
            }
            // Normalise separators to forward slashes for cross-platform zip entries
            let name = rel.to_string_lossy().replace('\\', "/");

            if entry.file_type().is_dir() {
                zip.add_directory(&name, options)
                    .map_err(|e| format!("zip add_directory: {}", e))?;
            } else if entry.file_type().is_file() {
                zip.start_file(&name, options)
                    .map_err(|e| format!("zip start_file: {}", e))?;
                let data =
                    fs::read(p).map_err(|e| format!("read {}: {}", p.display(), e))?;
                zip.write_all(&data)
                    .map_err(|e| format!("zip write: {}", e))?;
            }
        }

        zip.finish().map_err(|e| format!("zip finish: {}", e))?;
    }
    Ok(buf)
}

#[tauri::command]
async fn write_save_folder(path: String, data: Vec<u8>) -> Result<(), String> {
    let root = Path::new(&path);

    // Back up existing folder by renaming it (atomic, fast).
    if root.exists() {
        let backup = format!("{}.savehop-backup", path);
        let _ = fs::remove_dir_all(&backup);
        if let Err(e) = fs::rename(root, &backup) {
            return Err(format!("Failed to backup existing folder: {}", e));
        }
    }
    fs::create_dir_all(root).map_err(|e| format!("create_dir_all: {}", e))?;

    let cursor = Cursor::new(data);
    let mut zip =
        zip::ZipArchive::new(cursor).map_err(|e| format!("zip open: {}", e))?;
    for i in 0..zip.len() {
        let mut entry = zip
            .by_index(i)
            .map_err(|e| format!("zip by_index({}): {}", i, e))?;
        let name = entry.name().to_string();
        // Defend against zip-slip: reject any entry that resolves outside `root`.
        let entry_path = root.join(&name);
        if !entry_path.starts_with(root) {
            return Err(format!("Refusing to extract suspicious path: {}", name));
        }

        if entry.is_dir() || name.ends_with('/') {
            fs::create_dir_all(&entry_path)
                .map_err(|e| format!("mkdir {}: {}", entry_path.display(), e))?;
        } else {
            if let Some(parent) = entry_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("mkdir {}: {}", parent.display(), e))?;
            }
            let mut buf = Vec::with_capacity(entry.size() as usize);
            entry
                .read_to_end(&mut buf)
                .map_err(|e| format!("read entry {}: {}", name, e))?;
            fs::write(&entry_path, &buf)
                .map_err(|e| format!("write {}: {}", entry_path.display(), e))?;
        }
    }
    Ok(())
}

// ──────────────────────────── Game detection ────────────────────────────

#[tauri::command]
async fn detect_games() -> Result<Vec<DetectedGame>, String> {
    // detect_games is purely filesystem walking — push it off the main thread.
    let result = tauri::async_runtime::spawn_blocking(scan::detect_games)
        .await
        .map_err(|e| format!("scan task: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn resolve_save_path(path: String) -> Result<String, String> {
    Ok(scan::expand_path(&path))
}

// ──────────────────────────── Process watch ────────────────────────────

#[tauri::command]
fn start_game_watch(
    app: AppHandle,
    state: State<'_, AppState>,
    executable: String,
) -> Result<(), String> {
    {
        let watch = state.watch.lock().map_err(|e| e.to_string())?;
        if watch.running.swap(true, Ordering::SeqCst) {
            return Ok(());
        }
    }

    let app_for_thread = app.clone();
    let exe = executable.clone();

    std::thread::spawn(move || {
        let mut sys = System::new();
        let mut was_running = false;
        let needle = exe.to_lowercase();

        loop {
            let st: State<AppState> = app_for_thread.state();
            let stop = {
                let w = st.watch.lock().unwrap();
                !w.running.load(Ordering::SeqCst)
            };
            if stop {
                break;
            }

            sys.refresh_processes();
            let running_now = sys.processes().values().any(|p| {
                let n = p.name().to_lowercase();
                n == needle || n.contains(&needle)
            });

            if running_now && !was_running {
                was_running = true;
                let _ = app_for_thread.emit(
                    "savehop:game-started",
                    GameEventPayload {
                        executable: exe.clone(),
                    },
                );
            } else if !running_now && was_running {
                was_running = false;
                let _ = app_for_thread.emit(
                    "savehop:game-stopped",
                    GameEventPayload {
                        executable: exe.clone(),
                    },
                );
            }

            std::thread::sleep(Duration::from_secs(2));
        }
    });

    Ok(())
}

#[tauri::command]
fn stop_game_watch(state: State<'_, AppState>) -> Result<(), String> {
    let watch = state.watch.lock().map_err(|e| e.to_string())?;
    watch.running.store(false, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
    Ok(())
}

// ──────────────────────────── Entrypoint ────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            watch: Mutex::new(GameWatch::default()),
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .setup(|app| {
            let open = MenuItem::with_id(app, "open", "Open Savehop", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;

            let _tray = TrayIconBuilder::with_id("savehop-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Savehop")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "open" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.unminimize();
                            let _ = win.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.unminimize();
                            let _ = win.set_focus();
                        }
                    }
                })
                .build(app)?;

            let args: Vec<String> = std::env::args().collect();
            if args.iter().any(|a| a == "--minimized") {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.hide();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_save,
            write_save,
            read_save_folder,
            write_save_folder,
            detect_games,
            resolve_save_path,
            start_game_watch,
            stop_game_watch,
            show_main_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running savehop");
}
