use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::Serialize;
use walkdir::WalkDir;

use crate::games::{KnownGame, GAMES};

#[derive(Clone, Serialize, Debug)]
pub struct DetectedGame {
    pub name: String,
    pub exe_path: String,
    pub save_path: String,
    pub save_path_exists: bool,
}

/// Public entry point — the Tauri command calls this.
pub fn detect_games() -> Vec<DetectedGame> {
    let roots = collect_scan_roots();
    let mut exe_map: HashMap<String, &'static KnownGame> = HashMap::new();
    for g in GAMES {
        exe_map.insert(g.exe.to_lowercase(), g);
    }

    let mut found: HashMap<&'static str, PathBuf> = HashMap::new();

    for root in &roots {
        for entry in WalkDir::new(root)
            .max_depth(6)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            if !entry.file_type().is_file() {
                continue;
            }
            if let Some(name) = entry.file_name().to_str() {
                let lc = name.to_lowercase();
                if let Some(game) = exe_map.get(&lc) {
                    found
                        .entry(game.name)
                        .or_insert_with(|| entry.path().to_path_buf());
                }
            }
        }
    }

    let mut out: Vec<DetectedGame> = found
        .into_iter()
        .map(|(name, exe_path)| {
            let game = GAMES.iter().find(|g| g.name == name).unwrap();
            let resolved = expand_path(game.save_path);
            let exists = !resolved.is_empty() && Path::new(&resolved).exists();
            DetectedGame {
                name: name.to_string(),
                exe_path: exe_path.to_string_lossy().into_owned(),
                save_path: resolved,
                save_path_exists: exists,
            }
        })
        .collect();

    out.sort_by(|a, b| a.name.cmp(&b.name));
    out
}

/// Build the list of directories worth walking.
fn collect_scan_roots() -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = Vec::new();

    // ── Steam libraries ────────────────────────────────────────────────
    let steam_candidates = [
        PathBuf::from(r"C:\Program Files (x86)\Steam"),
        PathBuf::from(r"C:\Program Files\Steam"),
    ];
    for steam in &steam_candidates {
        if steam.join("steamapps").exists() {
            // The default install itself
            roots.push(steam.join("steamapps").join("common"));
            // Parse libraryfolders.vdf for additional library locations
            let vdf = steam.join("steamapps").join("libraryfolders.vdf");
            if let Ok(content) = std::fs::read_to_string(&vdf) {
                for path in parse_libraryfolders_vdf(&content) {
                    let common = path.join("steamapps").join("common");
                    roots.push(common);
                }
            }
        }
    }

    // ── Xbox Game Pass / Microsoft Store ───────────────────────────────
    // The Xbox app installs into <drive>:\XboxGames\<Title>\Content\
    // WindowsApps is protected so we don't walk it, but XboxGames is readable.
    roots.push(PathBuf::from(r"C:\XboxGames"));
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        roots.push(PathBuf::from(local).join("Microsoft").join("WindowsApps"));
    }

    // ── Epic Games Launcher ────────────────────────────────────────────
    roots.push(PathBuf::from(r"C:\Program Files\Epic Games"));
    roots.push(PathBuf::from(r"C:\Program Files (x86)\Epic Games"));
    // Parse Epic manifests to discover non-default install directories
    if let Ok(programdata) = std::env::var("PROGRAMDATA") {
        let manifests = PathBuf::from(programdata)
            .join("Epic")
            .join("EpicGamesLauncher")
            .join("Data")
            .join("Manifests");
        if manifests.exists() {
            if let Ok(read) = std::fs::read_dir(&manifests) {
                for entry in read.flatten() {
                    if let Some(ext) = entry.path().extension() {
                        if ext == "item" {
                            if let Ok(text) = std::fs::read_to_string(entry.path()) {
                                if let Some(install) = extract_json_string(&text, "InstallLocation")
                                {
                                    roots.push(PathBuf::from(install));
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ── GOG ────────────────────────────────────────────────────────────
    roots.push(PathBuf::from(r"C:\GOG Games"));
    roots.push(PathBuf::from(r"C:\Program Files (x86)\GOG Galaxy\Games"));
    roots.push(PathBuf::from(r"C:\Program Files\GOG Galaxy\Games"));

    // ── Generic per-drive locations ────────────────────────────────────
    for drive in fixed_drives() {
        let d = format!("{}:\\", drive);
        roots.push(PathBuf::from(format!("{}Games", &d)));
        roots.push(PathBuf::from(format!("{}SteamLibrary\\steamapps\\common", &d)));
        roots.push(PathBuf::from(format!("{}Steam\\steamapps\\common", &d)));
        roots.push(PathBuf::from(format!("{}XboxGames", &d)));
        roots.push(PathBuf::from(format!("{}Epic Games", &d)));
        roots.push(PathBuf::from(format!("{}GOG Games", &d)));
        roots.push(PathBuf::from(format!("{}Program Files\\Epic Games", &d)));
        roots.push(PathBuf::from(format!("{}Program Files (x86)\\Steam\\steamapps\\common", &d)));
    }

    // De-duplicate + keep only existing
    let mut seen: std::collections::HashSet<PathBuf> = std::collections::HashSet::new();
    roots
        .into_iter()
        .filter(|p| {
            if !p.exists() {
                return false;
            }
            let canonical = std::fs::canonicalize(p).unwrap_or_else(|_| p.clone());
            seen.insert(canonical)
        })
        .collect()
}

/// Parse a Steam libraryfolders.vdf and return all `path` values found.
fn parse_libraryfolders_vdf(content: &str) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        // VDF lines look like:    "path"        "C:\\SteamLibrary"
        if let Some(rest) = trimmed.strip_prefix("\"path\"") {
            if let Some(first) = rest.find('"') {
                let after = &rest[first + 1..];
                if let Some(end) = after.find('"') {
                    let raw = &after[..end];
                    // VDF doubles backslashes
                    let cleaned = raw.replace("\\\\", "\\");
                    paths.push(PathBuf::from(cleaned));
                }
            }
        }
    }
    paths
}

/// Pull a top-level string field out of an Epic manifest JSON file without a JSON dep.
fn extract_json_string(text: &str, key: &str) -> Option<String> {
    let needle = format!("\"{}\"", key);
    let idx = text.find(&needle)?;
    let after = &text[idx + needle.len()..];
    let colon = after.find(':')?;
    let after = &after[colon + 1..];
    let q = after.find('"')?;
    let after = &after[q + 1..];
    let end = after.find('"')?;
    Some(after[..end].replace("\\\\", "\\"))
}

/// List currently mounted drive letters that look like fixed disks.
fn fixed_drives() -> Vec<char> {
    let mut drives = Vec::new();
    for c in 'A'..='Z' {
        let p = PathBuf::from(format!("{}:\\", c));
        if p.exists() {
            drives.push(c);
        }
    }
    drives
}

/// Expand %USERPROFILE%, %APPDATA%, %LOCALAPPDATA%, %PROGRAMDATA%, etc.
/// Also normalises a leading or embedded `\..\` segment cleanly.
pub fn expand_path(input: &str) -> String {
    let mut out = input.to_string();
    let vars = [
        "USERPROFILE",
        "APPDATA",
        "LOCALAPPDATA",
        "PROGRAMDATA",
        "PUBLIC",
        "HOMEDRIVE",
        "HOMEPATH",
        "TEMP",
        "TMP",
    ];
    for v in &vars {
        if out.contains(&format!("%{}%", v)) {
            if let Ok(val) = std::env::var(v) {
                out = out.replace(&format!("%{}%", v), &val);
            }
        }
    }
    // Normalise \..\ segments without requiring the path to exist
    normalize_path_segments(&out)
}

fn normalize_path_segments(input: &str) -> String {
    let path = PathBuf::from(input);
    let mut out = PathBuf::new();
    for comp in path.components() {
        use std::path::Component;
        match comp {
            Component::ParentDir => {
                out.pop();
            }
            Component::CurDir => {}
            other => out.push(other.as_os_str()),
        }
    }
    out.to_string_lossy().into_owned()
}
