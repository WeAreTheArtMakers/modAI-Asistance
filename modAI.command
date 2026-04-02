#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

if [[ "$#" -eq 0 ]]; then
  set -- chat
fi

exec "$ROOT_DIR/bin/modai" "$@"
