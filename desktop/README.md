# Offline edition

A build of the site for Windows and macOS that needs no install and no network. It is the same page in a native window (Tauri 2): WebView2 on Windows, WebKit on macOS. The version comes from `package.json`.

## What differs from the website

- Only the published data and the page that shows it are embedded. The relation inference code is not part of this repository or of the build.
- No analytics beacon and no report endpoint (`vite --mode offline`). The report form stays visible but says it cannot send from here.
- The home page lists the edition's version in its project section.
- The page has no IPC permissions, and its CSP allows no network. Links open in the system browser.

## Layout

| Path | What it is |
| --- | --- |
| `src/`, `build.rs`, `Cargo.*`, `tauri.conf.json`, `icons/` | The window around the page |
| `scripts/setup_toolchain.sh`, `scripts/env.sh` | Install and use the build tools |
| `scripts/build_exe.sh`, `scripts/build_mac.sh` | Compile and assemble a release |
| `scripts/audit_release.py` | The check a release must pass |
| `scripts/make_icons.py` | Draws `icons/` from the site's favicon |
| `toolchain/`, `dist/`, `target/`, `gen/`, `release/` | Generated and git-ignored; safe to delete |

## Build

Each command runs from the repository root and needs no admin rights. `setup:desktop` is needed once per machine and installs into `desktop/toolchain`.

```
npm run setup:desktop
npm run build:exe    # Windows, cross-built on WSL
npm run build:mac    # macOS, on a Mac
```

Results land in `desktop/release/`, zipped and named by version. The Windows exe needs `WebView2Loader.dll` beside it, because the MinGW target cannot link the loader statically. The macOS app is one universal `.app`. Without a Mac, run the `desktop-mac` workflow by hand on GitHub or push a `desktop-v*` tag; its artifact can be downloaded by any signed-in GitHub user.

`audit_release.py` runs on the web files and on the binary, and fails the build on unknown data fields, run or model identifiers, machine paths, outside addresses, image metadata or evidence quotes. Evidence quotes are only checked where `work/view_data.json` exists, so not on the GitHub runner.

## Limits

- Windows needs the WebView2 runtime, which Windows 11 ships. Without it the program shows a message box and exits.
- macOS 11.3 or later. The app has no Developer ID, so the first open needs right-click > Open or System Settings > Privacy & Security. Removing that warning needs an Apple Developer account and notarization.
- Safari's engine is not Chromium: the macOS edition has to be checked by eye on a Mac. Cmd +/- page zoom is not available there, because it would need a page permission.
- The Windows exe is unsigned, so a downloaded copy triggers SmartScreen.
- It is a snapshot: new data means a new build.
