# Offline edition

A Windows build of the site that needs no install and no network. It is the same page in a WebView2 window (Tauri 2).

## What differs from the website

- Only the published data and the page that shows it are embedded. The relation inference code is not part of this repository or of the build.
- No analytics beacon and no report endpoint (`vite --mode offline`). The report form stays visible but says it cannot send from here.
- The page has no IPC permissions, and its CSP allows no network. Links open in the system browser.

## Build

```
npm run build:exe
```

This writes `release/ArknightsRelationAtlas/` and a zip of it. The exe needs `WebView2Loader.dll` beside it, because the MinGW target cannot link the loader statically. `scripts/audit_release.py` runs on the web files and on the exe, and fails the build on unknown data fields, run or model identifiers, machine paths, outside addresses, image metadata or evidence quotes.

## Toolchain

The build runs from WSL without root. `scripts/build_exe.sh` sources `$WIN_CROSS/env.sh` (default `~/.local/share/win-cross`), which has to put these on `PATH`:

- Rust with the `x86_64-pc-windows-gnu` target (rustup, in `~/.cargo`).
- `x86_64-w64-mingw32-gcc` and `x86_64-w64-mingw32-windres`: Ubuntu's `gcc-mingw-w64-x86-64-win32` and `binutils-mingw-w64-x86-64` with their dependencies, unpacked by `apt-get download` and `dpkg-deb -x`. The `gcc` name is a small wrapper around `x86_64-w64-mingw32-gcc-win32`.
- `cc` for build scripts on the host. A host C compiler does the job; without one, a wrapper around unpacked `clang-21`, `lld-21`, `libc6-dev` and `libgcc-15-dev` works: `clang --sysroot=PREFIX --gcc-toolchain=PREFIX/usr -fuse-ld=lld`.

## Limits

- The WebView2 runtime is required. Windows 11 ships it. Without it the program shows a message box and exits.
- The exe is unsigned, so a downloaded copy triggers SmartScreen.
- It is a snapshot: new data means a new build.
