#!/usr/bin/env bash
# Installs the build tools into desktop/toolchain (git-ignored). Needs no root, and writes nothing outside that folder.
# WSL: Rust through rustup, and Ubuntu's MinGW and clang unpacked from their packages, to cross-build for Windows.
# macOS: Rust through rustup, with the Xcode command line tools already installed.
set -euo pipefail
scripts="$(cd "$(dirname "$0")" && pwd)"
. "$scripts/env.sh"
RUST=1.99.1
LLVM=21
GCC=15
root="$toolchain/root"
mkdir -p "$toolchain/debs" "$root" "$toolchain/bin"

if [ "$(uname)" = Darwin ]; then
  targets="aarch64-apple-darwin x86_64-apple-darwin"
else
  targets="x86_64-pc-windows-gnu"
fi
if [ ! -x "$CARGO_HOME/bin/rustup" ]; then
  curl -sSf https://sh.rustup.rs -o "$toolchain/rustup-init.sh"
  sh "$toolchain/rustup-init.sh" -y --profile minimal --default-toolchain "$RUST" --no-modify-path
  rm "$toolchain/rustup-init.sh"
fi
# shellcheck disable=SC2086
rustup target add $targets
if [ "$(uname)" = Darwin ]; then
  xcode-select -p >/dev/null || { echo "install the Xcode command line tools: xcode-select --install" >&2; exit 1; }
  rustc --version
  exit 0
fi

cd "$toolchain/debs"
apt-get download -q \
  gcc-mingw-w64-x86-64-win32 gcc-mingw-w64-x86-64-win32-runtime gcc-mingw-w64-base \
  binutils-mingw-w64-x86-64 binutils-mingw-w64-base mingw-w64-x86-64-dev mingw-w64-common \
  libisl23 libmpc3 libmpfr6 libgmp10 \
  "clang-$LLVM" "lld-$LLVM" "libllvm$LLVM" "libclang-cpp$LLVM" "libclang1-$LLVM" "libclang-common-$LLVM-dev" \
  libc6 libc6-dev linux-libc-dev libcrypt-dev libgcc-s1 "libgcc-$GCC-dev"
for deb in *.deb; do dpkg-deb -x "$deb" "$root"; done
cd "$toolchain"
rm -rf debs

# libc.so names these absolute paths, which the sysroot then resolves under root/.
mkdir -p "$root/lib64" "$root/lib"
ln -sfn ../usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2 "$root/lib64/ld-linux-x86-64.so.2"
ln -sfn ../usr/lib/x86_64-linux-gnu "$root/lib/x86_64-linux-gnu"

# The libraries stay off the environment of everything but these two compilers.
cat > bin/cc <<WRAPPER
#!/bin/sh
root="\$(dirname "\$0")/../root"
root="\$(cd "\$root" && pwd)"
LD_LIBRARY_PATH="\$root/usr/lib/x86_64-linux-gnu:\$root/usr/lib/llvm-$LLVM/lib" \\
  exec "\$root/usr/lib/llvm-$LLVM/bin/clang" --sysroot="\$root" --gcc-toolchain="\$root/usr" -fuse-ld=lld "\$@"
WRAPPER
cat > bin/x86_64-w64-mingw32-gcc <<'WRAPPER'
#!/bin/sh
root="$(dirname "$0")/../root"
root="$(cd "$root" && pwd)"
LD_LIBRARY_PATH="$root/usr/lib/x86_64-linux-gnu" exec "$root/usr/bin/x86_64-w64-mingw32-gcc-win32" "$@"
WRAPPER
chmod +x bin/*

rustc --version
x86_64-w64-mingw32-gcc --version | head -1
cc --version | head -1
du -sh "$toolchain"
