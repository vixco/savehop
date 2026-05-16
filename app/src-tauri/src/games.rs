pub struct KnownGame {
    pub name: &'static str,
    /// One or more executable names by which the running process is identified.
    /// Most titles have a single binary, but some ship different exes per
    /// storefront (e.g. Steam's `Maine-Win64-Shipping.exe` vs Xbox's
    /// `Maine-WinGDK-Shipping.exe`). Comparison is case-insensitive.
    pub exes: &'static [&'static str],
    pub save_path: &'static str,
    /// Optional MS Store / Xbox Game Pass package family name fragment.
    /// If present and the folder `%LOCALAPPDATA%\Packages\<this>*` exists,
    /// the game is considered installed even when the .exe is in protected
    /// WindowsApps. The Steam-folder save path is still what we present to
    /// the user — Xbox WGS save containers (sandboxed under Packages\) are
    /// opaque blobs that we deliberately don't try to sync.
    pub xbox_package: Option<&'static str>,
}

/// Hard-coded database of save locations for popular co-op titles on Windows.
/// `%APPDATA%\..\LocalLow` resolves to the LocalLow folder which has no
/// direct env var. Paths are verified against PCGamingWiki, official wikis
/// and Reddit threads.
pub const GAMES: &[KnownGame] = &[
    // ── Survival / open-world co-op ───────────────────────────────────
    KnownGame {
        name: "Subnautica 2",
        exes: &["Subnautica2.exe"],
        save_path: r"%LOCALAPPDATA%\Subnautica2\Saved\SaveGames",
        xbox_package: Some("UnknownWorldsEntertainmen.Subnautica2"),
    },
    KnownGame {
        name: "Subnautica",
        exes: &["Subnautica.exe"],
        save_path: r"%APPDATA%\..\LocalLow\Unknown Worlds\Subnautica\Subnautica\SavedGames",
        xbox_package: Some("UnknownWorldsEntertainmen.GAMEPREVIEWSubnautica"),
    },
    KnownGame {
        name: "Valheim",
        exes: &["valheim.exe"],
        save_path: r"%APPDATA%\..\LocalLow\IronGate\Valheim\worlds_local",
        xbox_package: None,
    },
    KnownGame {
        name: "Raft",
        exes: &["Raft.exe"],
        save_path: r"%APPDATA%\..\LocalLow\Redbeet Interactive\Raft\User",
        xbox_package: None,
    },
    KnownGame {
        name: "Grounded",
        exes: &["Maine-Win64-Shipping.exe", "Maine-WinGDK-Shipping.exe"],
        save_path: r"%USERPROFILE%\Saved Games\Grounded",
        xbox_package: Some("Microsoft.Maine"),
    },
    KnownGame {
        name: "Sons of the Forest",
        exes: &["SonsOfTheForest.exe"],
        save_path: r"%APPDATA%\..\LocalLow\Endnight\SonsOfTheForest\Saves",
        xbox_package: None,
    },
    KnownGame {
        name: "The Forest",
        exes: &["TheForest.exe", "TheForest32.exe"],
        save_path: r"%APPDATA%\..\LocalLow\SKS\TheForest",
        xbox_package: None,
    },
    KnownGame {
        name: "Project Zomboid",
        exes: &["ProjectZomboid64.exe"],
        save_path: r"%USERPROFILE%\Zomboid\Saves",
        xbox_package: None,
    },
    KnownGame {
        name: "7 Days to Die",
        exes: &["7DaysToDie.exe"],
        save_path: r"%APPDATA%\7DaysToDie\Saves",
        xbox_package: None,
    },
    KnownGame {
        name: "Palworld",
        exes: &["Palworld-Win64-Shipping.exe", "Palworld-WinGDK-Shipping.exe"],
        save_path: r"%LOCALAPPDATA%\Pal\Saved\SaveGames",
        xbox_package: Some("PocketpairInc.Palworld"),
    },
    KnownGame {
        name: "V Rising",
        exes: &["VRising.exe"],
        save_path: r"%APPDATA%\..\LocalLow\Stunlock Studios\VRising\Saves",
        xbox_package: None,
    },
    KnownGame {
        name: "Enshrouded",
        exes: &["enshrouded.exe"],
        save_path: r"%USERPROFILE%\Saved Games\Enshrouded",
        xbox_package: None,
    },
    KnownGame {
        name: "Astroneer",
        exes: &["Astro-Win64-Shipping.exe"],
        save_path: r"%LOCALAPPDATA%\Astro\Saved\SaveGames",
        xbox_package: Some("SystemEraSoftworks.Astroneer"),
    },
    KnownGame {
        name: "Core Keeper",
        exes: &["CoreKeeper.exe"],
        save_path: r"%APPDATA%\..\LocalLow\Pugstorm\Core Keeper\Steam",
        xbox_package: None,
    },
    KnownGame {
        name: "The Planet Crafter",
        exes: &["Planet Crafter.exe"],
        save_path: r"%APPDATA%\..\LocalLow\MijuGames\Planet Crafter",
        xbox_package: None,
    },

    // ── Factory / builder / sandbox ───────────────────────────────────
    KnownGame {
        name: "Satisfactory",
        // Post-1.0 Steam ships FactoryGameSteam.exe; Epic and Xbox still use FactoryGame.exe.
        exes: &["FactoryGameSteam.exe", "FactoryGame.exe"],
        save_path: r"%LOCALAPPDATA%\FactoryGame\Saved\SaveGames",
        xbox_package: Some("CoffeeStainStudios.Satisfactory"),
    },
    KnownGame {
        name: "Factorio",
        exes: &["factorio.exe"],
        save_path: r"%APPDATA%\Factorio\saves",
        xbox_package: None,
    },
    KnownGame {
        name: "Stardew Valley",
        exes: &["Stardew Valley.exe"],
        save_path: r"%APPDATA%\StardewValley\Saves",
        xbox_package: None,
    },
    KnownGame {
        name: "Terraria",
        // Sync only `Worlds` — `Players` holds personal character files that
        // each friend should keep local. tModLoader users need a custom path.
        exes: &["Terraria.exe"],
        save_path: r"%USERPROFILE%\Documents\My Games\Terraria\Worlds",
        xbox_package: None,
    },
    KnownGame {
        name: "Minecraft Java",
        // NOTE: javaw.exe is a generic Java host used by many apps. Auto-sleep
        // detection by exe name alone is fuzzy here. Third-party launchers
        // (Prism, MultiMC, Modrinth App, CurseForge, Lunar) store saves under
        // <instance>/.minecraft/saves and need a manual save-path override.
        exes: &["javaw.exe"],
        save_path: r"%APPDATA%\.minecraft\saves",
        xbox_package: None,
    },

    // ── Other ─────────────────────────────────────────────────────────
    KnownGame {
        name: "Schedule I",
        exes: &["Schedule I.exe"],
        save_path: r"%APPDATA%\..\LocalLow\TVGS\Schedule I",
        xbox_package: None,
    },
];

pub fn find_known_game(exe_name: &str) -> Option<&'static KnownGame> {
    let needle = exe_name.to_lowercase();
    GAMES
        .iter()
        .find(|g| g.exes.iter().any(|e| e.to_lowercase() == needle))
}
