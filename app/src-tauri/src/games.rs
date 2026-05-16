pub struct KnownGame {
    pub name: &'static str,
    pub exe: &'static str,
    pub save_path: &'static str,
}

/// Hard-coded database of save locations for popular co-op titles on Windows.
/// `%APPDATA%\..\LocalLow` resolves to the LocalLow folder which has no direct env var.
pub const GAMES: &[KnownGame] = &[
    KnownGame {
        name: "Subnautica 2",
        exe: "Subnautica2.exe",
        save_path: r"%APPDATA%\..\LocalLow\Unknown Worlds\Subnautica2",
    },
    KnownGame {
        name: "Subnautica",
        exe: "Subnautica.exe",
        save_path: r"%APPDATA%\..\LocalLow\Unknown Worlds\Subnautica",
    },
    KnownGame {
        name: "Stardew Valley",
        exe: "Stardew Valley.exe",
        save_path: r"%APPDATA%\StardewValley\Saves",
    },
    KnownGame {
        name: "Valheim",
        exe: "valheim.exe",
        save_path: r"%APPDATA%\..\LocalLow\IronGate\Valheim\worlds_local",
    },
    KnownGame {
        name: "Satisfactory",
        exe: "FactoryGame.exe",
        save_path: r"%LOCALAPPDATA%\FactoryGame\Saved\SaveGames",
    },
    KnownGame {
        name: "Minecraft Java",
        exe: "javaw.exe",
        save_path: r"%APPDATA%\.minecraft\saves",
    },
    KnownGame {
        name: "Terraria",
        exe: "Terraria.exe",
        save_path: r"%USERPROFILE%\Documents\My Games\Terraria\Worlds",
    },
    KnownGame {
        name: "Schedule I",
        exe: "Schedule I.exe",
        save_path: r"%APPDATA%\..\LocalLow\TVGS\Schedule I",
    },
    KnownGame {
        name: "Raft",
        exe: "Raft.exe",
        save_path: r"%APPDATA%\..\LocalLow\Redbeet Interactive\Raft\User",
    },
    KnownGame {
        name: "The Planet Crafter",
        exe: "Planet Crafter.exe",
        save_path: r"%APPDATA%\..\LocalLow\MijuGames\Planet Crafter",
    },
];

pub fn find_known_game(exe_name: &str) -> Option<&'static KnownGame> {
    let needle = exe_name.to_lowercase();
    GAMES.iter().find(|g| g.exe.to_lowercase() == needle)
}
