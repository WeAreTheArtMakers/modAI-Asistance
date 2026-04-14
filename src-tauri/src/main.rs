#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    env,
    error::Error,
    fs::{self, File},
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::{Duration, Instant},
};

use tauri::{image::Image, Manager, WebviewUrl, WebviewWindowBuilder};

struct ServerState(Mutex<Option<Child>>);

fn main() {
    install_panic_hook();

    let app = tauri::Builder::default()
        .setup(|app| {
            let runtime_dir = resolve_runtime_dir(app.handle())?;
            let port = resolve_port();

            let child = ensure_server_running(&runtime_dir, port)?;
            app.manage(ServerState(Mutex::new(child)));

            let url_text = format!("http://127.0.0.1:{port}");
            let url = url_text.parse().map_err(|error| {
                let message = format!("failed to parse app url: {error}");
                std::io::Error::new(std::io::ErrorKind::Other, message)
            })?;

            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title("modAI")
                .inner_size(1280.0, 860.0)
                .min_inner_size(960.0, 720.0)
                .resizable(true)
                .build()?;

            if let Some(window_icon) = load_window_icon(app.handle())? {
                window.set_icon(window_icon)?;
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build modAI Tauri app");

    app.run(|app_handle, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            if let Some(state) = app_handle.try_state::<ServerState>() {
                if let Ok(mut child_slot) = state.0.lock() {
                    if let Some(mut child) = child_slot.take() {
                        let _ = child.kill();
                    }
                }
            }
        }
    });
}

fn resolve_port() -> u16 {
    env::var("MODAI_WEB_PORT")
        .ok()
        .or_else(|| env::var("PORT").ok())
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or_else(find_available_port)
}

fn find_available_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .ok()
        .and_then(|listener| listener.local_addr().ok().map(|address| address.port()))
        .unwrap_or(8787)
}

fn resolve_runtime_dir(app: &tauri::AppHandle) -> Result<PathBuf, Box<dyn Error>> {
    if let Some(custom) = env::var_os("MODAI_RUNTIME_DIR") {
        let runtime_dir = PathBuf::from(custom);
        if runtime_dir.exists() {
            return Ok(runtime_dir);
        }
    }

    if let Ok(executable_path) = env::current_exe() {
        if let Some(executable_dir) = executable_path.parent() {
            let sibling_runtime = executable_dir.join("runtime");
            if sibling_runtime.exists() {
                return Ok(sibling_runtime);
            }
        }
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        let bundled_runtime = resource_dir.join("runtime");
        if bundled_runtime.exists() {
            return Ok(bundled_runtime);
        }
    }

    let workspace_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::Other, "workspace root not found"))?
        .to_path_buf();
    Ok(workspace_root)
}

fn load_window_icon(app: &tauri::AppHandle) -> Result<Option<Image<'static>>, Box<dyn Error>> {
    let resource_dir = match app.path().resource_dir() {
        Ok(path) => path,
        Err(_) => return Ok(None),
    };
    let icon_path = resource_dir.join("modAI.png");
    if !icon_path.exists() {
        return Ok(None);
    }
    Ok(Some(Image::from_path(icon_path)?))
}

fn ensure_server_running(runtime_dir: &Path, port: u16) -> Result<Option<Child>, Box<dyn Error>> {
    if server_healthy(port) {
        return Ok(None);
    }

    let node_bin = find_node_binary()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "Node.js 22+ not found on PATH"))?;
    let state_dir = resolve_state_dir(runtime_dir)?;
    let workspace_dir = resolve_workspace_dir(runtime_dir);
    let server_entry = runtime_dir.join("modai").join("src").join("web").join("server.mjs");
    let log_path = state_dir.join("tauri-web.log");
    let stdout = File::create(&log_path)?;
    let stderr = stdout.try_clone()?;

    let child = Command::new(node_bin)
        .arg(server_entry)
        .arg("--port")
        .arg(port.to_string())
        .current_dir(&workspace_dir)
        .env("MODAI_PARENT_PID", std::process::id().to_string())
        .env("MODAI_WEB_PORT", port.to_string())
        .env("MODAI_WORKSPACE_DIR", &workspace_dir)
        .env("MODAI_RUNTIME_DIR", runtime_dir)
        .env("PATH", resolve_path_env())
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr))
        .spawn()?;

    wait_for_health(port, Duration::from_secs(20))?;
    Ok(Some(child))
}

fn resolve_state_dir(runtime_dir: &Path) -> Result<PathBuf, Box<dyn Error>> {
    let state_dir = if let Some(custom) = env::var_os("MODAI_HOME") {
        PathBuf::from(custom)
    } else if let Some(home) = env::var_os("HOME") {
        PathBuf::from(home).join(".modai")
    } else {
        runtime_dir.join(".modai")
    };

    fs::create_dir_all(&state_dir)?;
    Ok(state_dir)
}

fn install_panic_hook() {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        if let Some(crash_log) = resolve_crash_log_path() {
            if let Some(parent) = crash_log.parent() {
                let _ = fs::create_dir_all(parent);
            }

            if let Ok(mut file) = File::options().create(true).append(true).open(crash_log) {
                let _ = writeln!(
                    file,
                    "[{}] {}",
                    chrono_like_timestamp(),
                    panic_info
                );
            }
        }

        previous(panic_info);
    }));
}

fn resolve_crash_log_path() -> Option<PathBuf> {
    if let Some(custom) = env::var_os("MODAI_HOME") {
        return Some(PathBuf::from(custom).join("crash.log"));
    }

    env::var_os("HOME").map(|home| PathBuf::from(home).join(".modai").join("crash.log"))
}

fn chrono_like_timestamp() -> String {
    match std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) {
        Ok(duration) => format!("{}", duration.as_secs()),
        Err(_) => "0".to_string(),
    }
}

fn resolve_workspace_dir(runtime_dir: &Path) -> PathBuf {
    if let Some(custom) = env::var_os("MODAI_WORKSPACE_DIR") {
        return PathBuf::from(custom);
    }

    if let Some(home) = env::var_os("HOME") {
        return PathBuf::from(home);
    }

    runtime_dir.to_path_buf()
}

fn resolve_path_env() -> String {
    let base = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";
    match env::var("PATH") {
        Ok(existing) if !existing.is_empty() => format!("{base}:{existing}"),
        _ => base.to_string(),
    }
}

fn find_node_binary() -> Option<PathBuf> {
    if let Some(custom) = env::var_os("MODAI_NODE_BIN") {
        let path = PathBuf::from(custom);
        if path.exists() {
            return Some(path);
        }
    }

    if let Some(paths) = env::var_os("PATH") {
        for dir in env::split_paths(&paths) {
            let candidate = dir.join("node");
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    let fallback_paths = [
        "/opt/homebrew/bin/node",
        "/usr/local/bin/node",
        "/usr/bin/node",
    ];

    fallback_paths
        .iter()
        .map(PathBuf::from)
        .find(|candidate| candidate.exists())
}

fn wait_for_health(port: u16, timeout: Duration) -> Result<(), Box<dyn Error>> {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if server_healthy(port) {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(500));
    }

    Err(std::io::Error::new(
        std::io::ErrorKind::TimedOut,
        "modAI local server did not become healthy in time",
    )
    .into())
}

fn server_healthy(port: u16) -> bool {
    let address = format!("127.0.0.1:{port}");
    let mut stream = match TcpStream::connect(address) {
        Ok(stream) => stream,
        Err(_) => return false,
    };

    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));

    if stream
        .write_all(b"GET /health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
        .is_err()
    {
        return false;
    }

    let mut response = String::new();
    if stream.read_to_string(&mut response).is_err() {
        return false;
    }

    response.contains("\"ok\": true") || response.contains("\"ok\":true")
}
