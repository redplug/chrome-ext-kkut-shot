# Kkut Shot

Kkut Shot is a Chrome extension plus a Mac mini background job for playing a timing game around the exact moment a YouTube video says "끝!".

## Architecture

The extension does not run speech recognition. A Mac mini periodically analyzes new videos and publishes detected answer times to `data/answers.json`. The extension downloads that JSON from GitHub and uses the current YouTube video ID to enable the in-page `끝! 찍기` button.

```text
Mac mini cron/launchd
→ YouTube RSS
→ yt-dlp outro audio clip
→ faster-whisper "끝" detection
→ data/answers.json
→ git commit/push
→ Chrome extension fetches GitHub JSON
```

## Repository Layout

- `manifest.json`: Chrome extension manifest.
- `src/content/`: YouTube overlay and timing game.
- `src/popup/`: popup UI for configuring and refreshing `answers.json`.
- `src/shared/`: shared time formatting helpers.
- `scripts/update_answers.py`: Mac mini background updater.
- `config/channels.example.json`: channel configuration template.
- `data/answers.json`: published answer database.
- `docs/`: setup and operation guides.

## Development Checks

```bash
python3 -m json.tool manifest.json
node --check src/content/youtube.js
node --check src/popup/popup.js
node --check src/shared/time.js
PYTHONPYCACHEPREFIX=.pycache python3 -m py_compile scripts/update_answers.py
```

## Guides

- [Mac mini background setup](docs/MACMINI_SETUP.md)
- [Chrome extension install guide](docs/EXTENSION_INSTALL.md)
- [GitHub publishing guide](docs/GITHUB_PUBLISHING.md)
