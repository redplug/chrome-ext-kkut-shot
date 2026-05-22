# Mac Mini Background Setup

Use the Mac mini as the always-on analyzer. It checks configured YouTube channels, updates `data/answers.json`, commits the result, and pushes to GitHub.

## 1. Clone and Install Tools

```bash
git clone https://github.com/redplug/chrome-ext-kkut-shot.git
cd chrome-ext-kkut-shot
brew install python@3.12 ffmpeg gh
brew install uv yt-dlp
./scripts/setup_macmini.sh
```

`yt-dlp` uses `ffmpeg` to cut and convert the outro audio.

If `python3` points to Python 3.14 or to a PEP 668 externally-managed distribution, `venv` creation can fail with an `ensurepip` error. `scripts/setup_macmini.sh` avoids this by creating `.venv` with `uv` and installing dependencies via `uv pip`.

## 2. Configure Channels

```bash
cp config/channels.example.json config/channels.json
```

Edit `config/channels.json`:

```json
{
  "channels": [
    {
      "name": "Target YouTuber",
      "channelId": "UCxxxxxxxxxxxxxxxxxxxxxx"
    }
  ],
  "captureSeconds": 20,
  "maxVideosPerRun": 5
}
```

The target videos need a chapter or description line such as `07:22 아웃트로`.

## 3. Run Manually

```bash
source .venv/bin/activate
git pull
python3 scripts/update_answers.py --commit --push
```

The first run downloads the Whisper model and can take longer. Check `data/answers.json` after the run.

## 4. Schedule Once Per Day

Create `~/Library/LaunchAgents/com.kkut-shot.update.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.kkut-shot.update</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>cd /Users/YOUR_USER/chrome-ext-kkut-shot && source .venv/bin/activate && git pull && python3 scripts/update_answers.py --commit --push</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>6</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/tmp/kkut-shot.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/kkut-shot.err</string>
</dict>
</plist>
```

Load it:

```bash
launchctl load ~/Library/LaunchAgents/com.kkut-shot.update.plist
launchctl start com.kkut-shot.update
```

Replace `/Users/YOUR_USER/chrome-ext-kkut-shot` with the real clone path.
