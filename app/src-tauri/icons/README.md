# Icons

This folder must contain the Tauri bundle icons. Generate them once with:

```bash
cd app
npx @tauri-apps/cli icon ./icon-source.png
```

Where `icon-source.png` is a 1024×1024 PNG of the Savehop logo
(teal "S" on dark background — `#22d3b8` on `#0f1117`).

The CLI will create:

- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns`
- `icon.ico`
- Plus Windows store assets

These are required for the `tauri build` step to succeed and are checked in
on the `release` workflow via the `tauri-action`. If you fork the repo and
strip the icons, run the command above before the first release tag.
