#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="$ROOT_DIR/.venv"

echo "[1/4] Checking required commands..."
for cmd in uv ffmpeg yt-dlp gh; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing command: $cmd"
    echo "Install with: brew install uv ffmpeg yt-dlp gh"
    exit 1
  fi
done

echo "[2/4] Recreating virtual environment with uv (Python 3.12)..."
rm -rf "$VENV_DIR"
uv venv --python 3.12 "$VENV_DIR"

echo "[3/4] Installing Python dependencies..."
uv pip install --python "$VENV_DIR/bin/python" -r "$ROOT_DIR/scripts/requirements.txt"

echo "[4/4] Verifying runtime..."
"$VENV_DIR/bin/python" --version
"$VENV_DIR/bin/python" -c "import faster_whisper; print('faster_whisper: ok')"

echo "Setup completed."
echo "Next:"
echo "  source .venv/bin/activate"
echo "  cp config/channels.example.json config/channels.json"
echo "  python scripts/update_answers.py"
