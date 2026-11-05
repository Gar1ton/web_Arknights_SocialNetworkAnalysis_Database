//! The offline edition of the site: a window around the static build embedded in this one file.
//! The page gets no IPC permissions and its CSP allows no network; links leave through the system browser.
#![windows_subsystem = "windows"]

use tauri::{webview::NewWindowResponse, Url, WebviewUrl, WebviewWindowBuilder};

/// The page is served from http://tauri.localhost on Windows and tauri://localhost on macOS.
fn is_app(url: &Url) -> bool {
    matches!(url.scheme(), "about" | "blob" | "data" | "tauri") || url.host_str() == Some("tauri.localhost")
}

/// Links the page really has: the project's pages, the licence and the contact address.
fn open_outside(url: &Url) {
    if matches!(url.scheme(), "http" | "https" | "mailto") {
        let _ = open::that_detached(url.as_str());
    }
}

/// Without the runtime the window would die silently, since a GUI program has no console.
#[cfg(windows)]
fn webview_available() -> bool {
    use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};
    if tauri::webview_version().is_ok() {
        return true;
    }
    let wide = |s: &str| s.encode_utf16().chain([0]).collect::<Vec<u16>>();
    let text = "这台电脑缺少 Microsoft Edge WebView2 运行库，无法打开。\n请从微软官网安装后重试（Windows 11 通常已自带）。\n\nThis computer lacks the Microsoft Edge WebView2 Runtime. Please install it from Microsoft and try again.";
    unsafe {
        MessageBoxW(
            std::ptr::null_mut(),
            wide(text).as_ptr(),
            wide("方舟关系图谱").as_ptr(),
            MB_OK | MB_ICONERROR,
        );
    }
    false
}

/// macOS always has WebKit.
#[cfg(not(windows))]
fn webview_available() -> bool {
    true
}

fn main() {
    if !webview_available() {
        return;
    }
    tauri::Builder::default()
        .setup(|app| {
            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("方舟关系图谱")
                .inner_size(1440.0, 900.0)
                // Elsewhere this needs a page permission, which the page deliberately does not have.
                .zoom_hotkeys_enabled(cfg!(windows))
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
                });
            // WebKit cancels downloads unless a handler exists; the default target is the Downloads folder.
            #[cfg(target_os = "macos")]
            let window = window.on_download(|_, _| true);
            window.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("the window could not start");
}
