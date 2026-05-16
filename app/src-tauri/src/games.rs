pub struct KnownGame {
    pub name: &'static str,
    pub exe: &'static str,
    pub save_path: &'static str,
    /// Optional MS Store / Xbox Game Pass package family name fragment.
    /// If present and the folder `%LOCALAPPDATA%\Packages\<this>*` exists,
    /// the game is considered installed even when the .exe is in protected WindowsApps.
    pub xbox_package: Option<&'static str>,
}

/// Hard-coded database of save locations for popular co-op titles on Windows.
/// `%APPDATA%\..\LocalLow` resolves to the LocalLow folder which has no direct env var.
pub const GAMES: &[KnownGame] = &[
    KnownGame {
        name: "Subnautica 2",
        exe: "Subnautica2.exe",
        save_path: r"%LOCALAPPDATA%\Subnautica2\Saved",
        xbox_package: Some("UnknownWorldsEntertainmen.Subnautica2"),
    },
    KnownGame {
        name: "Subnautica",
        exe: "Subnautica.exe",
        save_path: r"%APPDATA%\..\LocalLow\Unknown Worlds\Subnautica",
        xbox_package: None,
    },
    KnownGame {
        name: "Stardew Valley",
        exe: "Stardew Valley.exe",
        save_path: r"%APPDATA%\StardewValley\Saves",
        xbox_package: None,
    },
    KnownGame {
        name: "Valheim",
        exe: "valheim.exe",
        save_path: r"%APPDATA%\..\LocalLow\IronGate\Valheim\worlds_local",
        xbox_package: None,
    },
    KnownGame {
        name: "Satisfactory",
        exe: "FactoryGame.exe",
        save_path: r"%LOCALAPPDATA%\FactoryGame\Saved\SaveGames",
        xbox_package: None,
    },
    KnownGame {
        name: "Minecraft Java",
        exe: "javaw.exe",
        save_path: r"%APPDATA%\.minecraft\saves",
        xbox_package: None,
    },
    KnownGame {
        name: "Terraria",
        exe: "Terraria.exe",
        save_path: r"%USERPROFILE%\Documents\My Games\Terraria\Worlds",
        xbox_package: None,
    },
    KnownGame {
        name: "Schedule I",
        exe: "Schedule I.exe",
        save_path: r"%APPDATA%\..\LocalLow\TVGS\Schedule I",
        xbox_package: None,
    },
    KnownGame {
        name: "Raft",
        exe: "Raft.exe",
        save_path: r"%APPDATA%\..\LocalLow\Redbeet Interactive\Raft\User",
        xbox_package: None,
    },
    KnownGame {
        name: "The Planet Crafter",
        exe: "Planet Crafter.exe",
        save_path: r"%APPDATA%\..\LocalLow\MijuGames\Planet Crafter",
        xbox_package: None,
    },
];

pub fn find_known_game(exe_name: &str) -> Option<&'static KnownGame> {
    let needle = exe_name.to_lowercase();
    GAMES.iter().find(|g| g.exe.to_lowercase() == needle)
}
