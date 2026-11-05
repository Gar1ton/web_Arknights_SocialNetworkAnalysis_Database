//! The offline edition of the site: a window around the static build embedded in this one file.
//! The page gets no IPC permissions and its CSP allows no network; links leave through the system browser.
#![windows_subsystem = "windows"]

use tauri::{webview::NewWindowResponse, Url, WebviewUrl, WebviewWindowBuilder};

const APP_HOST: &str = "tauri.localhost";

fn is_app(url: &Url) -> bool {
    matches!(url.scheme(), "about" | "blob" | "data") || url.host_str() == Some(APP_HOST)
}

/// Links the page really has: the project's pages, the licence and the contact address.
fn open_outside(url: &Url) {
    if matches!(url.scheme(), "http" | "https" | "mailto") {
        let _ = open::that_detached(url.as_str());
    }
}

fn message_box(text: &str, caption: &str) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};
    let wide = |s: &str| s.encode_utf16().chain([0]).collect::<Vec<u16>>();
    unsafe {
        MessageBoxW(
            std::ptr::null_mut(),
            wide(text).as_ptr(),
            wide(caption).as_ptr(),
            MB_OK | MB_ICONERROR,
        );
    }
}

fn main() {
    // Without the runtime the window would die silently, since a GUI program has no console.
    if tauri::webview_version().is_err() {
        message_box(
            "这台电脑缺少 Microsoft Edge WebView2 运行库，无法打开。\n请从微软官网安装后重试（Windows 11 通常已自带）。\n\nThis computer lacks the Microsoft Edge WebView2 Runtime. Please install it from Microsoft and try again.",
            "方舟关系图谱",
        );
        return;
    }
    tauri::Builder::default()
        .setup(|app| {
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("方舟关系图谱")
                .inner_size(1440.0, 900.0)
                .zoom_hotkeys_enabled(true)
                .disable_drag_drop_handler()
                .on_navigation(|url| {
                    let inside = is_app(url);
                    if !inside {
                        open_outside(url);
                    }
                    inside
                })
                .on_new_window(|url, _| {
                    open_outside(&url);
                    NewWindowResponse::Deny
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("the window could not start");
}
