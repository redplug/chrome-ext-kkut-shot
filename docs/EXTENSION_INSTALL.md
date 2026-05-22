# Chrome Extension Install Guide

Use this on any Mac or PC that only needs to play the timing game.

## 1. Download the Extension

```bash
git clone https://github.com/redplug/chrome-ext-kkut-shot.git
```

If you are not using Git, download the repository ZIP from GitHub and unzip it.

## 2. Load in Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the `chrome-ext-kkut-shot` folder.

## 3. Configure the Data URL

Open a YouTube video, then open the Kkut Shot extension popup. Enter the raw GitHub data URL:

```text
https://raw.githubusercontent.com/redplug/chrome-ext-kkut-shot/main/data/answers.json
```

Click `정답 데이터 새로고침`.

## 4. Play

If the current video ID exists in `answers.json`, the YouTube page overlay enables `끝! 찍기`. Press it when you think the video says "끝!". The extension records how many seconds early or late you were.
