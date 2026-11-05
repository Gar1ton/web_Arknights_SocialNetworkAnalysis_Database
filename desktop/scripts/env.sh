# Puts the tools from desktop/toolchain on PATH. Source it; setup_toolchain.sh fills that folder.
toolchain="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/toolchain"
export RUSTUP_HOME="$toolchain/rustup"
export CARGO_HOME="$toolchain/cargo"
export PATH="$toolchain/bin:$toolchain/root/usr/bin:$CARGO_HOME/bin:$PATH"
