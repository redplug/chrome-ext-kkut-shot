#!/usr/bin/env python3
import argparse
import json
import re
import subprocess
import tempfile
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANSWERS_PATH = ROOT / "data" / "answers.json"
CHANNELS_PATH = ROOT / "config" / "channels.json"
OUTRO_KEYWORDS = ("아웃트로", "엔딩", "마무리", "outro", "ending")
TARGET_PATTERNS = (
    re.compile(r"끄+\s*읕"),
    re.compile(r"끝"),
    re.compile(r"끗"),
)


def run(command):
    return subprocess.run(command, check=True, text=True, capture_output=True)


def load_json(path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def fetch_channel_videos(channel_id):
    url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    with urllib.request.urlopen(url, timeout=20) as response:
        xml = response.read()

    root = ET.fromstring(xml)
    ns = {
        "atom": "http://www.w3.org/2005/Atom",
        "yt": "http://www.youtube.com/xml/schemas/2015",
    }
    videos = []
    for entry in root.findall("atom:entry", ns):
        video_id = entry.findtext("yt:videoId", namespaces=ns)
        title = entry.findtext("atom:title", namespaces=ns) or ""
        published = entry.findtext("atom:published", namespaces=ns) or ""
        if video_id:
            videos.append({
                "videoId": video_id,
                "title": title,
                "publishedAt": published,
                "url": f"https://www.youtube.com/watch?v={video_id}",
            })
    return videos


def fetch_video_info(url):
    result = run(["yt-dlp", "--dump-json", "--skip-download", url])
    return json.loads(result.stdout)


def is_short_video(info):
    duration = info.get("duration")
    webpage_url = (info.get("webpage_url") or "").lower()
    if "/shorts/" in webpage_url:
        return True
    if isinstance(duration, (int, float)) and duration <= 70:
        return True
    return False


def parse_timestamp(value):
    parts = [int(part) for part in value.split(":")]
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    return None


def find_outro_time(info):
    for chapter in info.get("chapters") or []:
        title = (chapter.get("title") or "").lower()
        if any(keyword in title for keyword in OUTRO_KEYWORDS):
            return float(chapter["start_time"]), chapter.get("title") or "chapter"

    description = info.get("description") or ""
    pattern = re.compile(r"(?P<time>(?:\d{1,2}:)?\d{1,2}:\d{2})\s+(?P<label>.+)")
    for line in description.splitlines():
        match = pattern.search(line.strip())
        if not match:
            continue
        label = match.group("label")
        if any(keyword in label.lower() for keyword in OUTRO_KEYWORDS):
            return float(parse_timestamp(match.group("time"))), label

    return None, None


def download_audio_section(url, start, duration):
    end = start + duration
    tempdir = tempfile.TemporaryDirectory()
    directory = Path(tempdir.name)
    output_template = str(directory / "%(id)s.%(ext)s")
    run([
        "yt-dlp",
        "--quiet",
        "--no-warnings",
        "-x",
        "--audio-format",
        "wav",
        "--download-sections",
        f"*{start}-{end}",
        "-o",
        output_template,
        url,
    ])
    wav_files = list(directory.glob("*.wav"))
    if not wav_files:
        tempdir.cleanup()
        raise RuntimeError("yt-dlp did not produce a wav file.")
    return tempdir, wav_files[0]


def transcribe(path):
    from faster_whisper import WhisperModel

    model = WhisperModel("small", device="cpu", compute_type="int8")
    segments, _info = model.transcribe(
        str(path),
        language="ko",
        vad_filter=True,
        word_timestamps=True,
    )
    return list(segments)


def find_kkut(segments, capture_start):
    segment_candidates = []
    word_candidates = []
    transcript = []

    for segment in segments:
        text = (segment.text or "").strip()
        if text:
            transcript.append(text)

        for word in getattr(segment, "words", None) or []:
            token = (word.word or "").strip()
            if any(pattern.search(token) for pattern in TARGET_PATTERNS):
                word_candidates.append({
                    "answerTime": capture_start + float(word.start),
                    "relativeTime": float(word.start),
                    "matchedText": token,
                })

        if any(pattern.search(text) for pattern in TARGET_PATTERNS):
            segment_candidates.append({
                "answerTime": capture_start + float(segment.start),
                "relativeTime": float(segment.start),
                "matchedText": text,
            })

    candidates = word_candidates or segment_candidates
    if not candidates:
        return None, " ".join(transcript)

    return min(candidates, key=lambda item: item["relativeTime"]), " ".join(transcript)


def update_video(video, channel, answers, capture_seconds, force=False):
    video_id = video["videoId"]
    if video_id in answers["videos"] and not force:
        return False

    print(f"Checking {video_id}: {video['title']}")
    info = fetch_video_info(video["url"])
    if is_short_video(info):
        print("  skipped: short video")
        return False
    outro_time, outro_label = find_outro_time(info)
    if outro_time is None:
        print("  skipped: no outro chapter")
        return False

    tempdir, audio_path = download_audio_section(video["url"], outro_time, capture_seconds)
    try:
        candidate, transcript = find_kkut(transcribe(audio_path), outro_time)
    finally:
        tempdir.cleanup()

    if not candidate:
        print("  skipped: no 끝 candidate")
        return False

    answers["videos"][video_id] = {
        "answerTime": round(candidate["answerTime"], 3),
        "channelId": channel["channelId"],
        "channelName": channel.get("name", ""),
        "confidence": "candidate",
        "detectedAt": datetime.now(timezone.utc).isoformat(),
        "matchedText": candidate["matchedText"],
        "outroLabel": outro_label,
        "outroTime": round(outro_time, 3),
        "publishedAt": video.get("publishedAt", ""),
        "title": info.get("title") or video["title"],
        "transcript": transcript,
        "url": video["url"],
    }
    print(f"  saved: {answers['videos'][video_id]['answerTime']}s")
    return True


def git_commit_and_push(message, push):
    run(["git", "add", "data/answers.json"])
    diff = subprocess.run(["git", "diff", "--cached", "--quiet"])
    if diff.returncode == 0:
        print("No data changes to commit.")
        return
    run(["git", "commit", "-m", message])
    if push:
        run(["git", "push"])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default=str(CHANNELS_PATH))
    parser.add_argument("--answers", default=str(ANSWERS_PATH))
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--commit", action="store_true")
    parser.add_argument("--push", action="store_true")
    args = parser.parse_args()

    config = load_json(Path(args.config), None)
    if not config:
        raise SystemExit("Missing config/channels.json. Copy config/channels.example.json first.")

    answers = load_json(Path(args.answers), {"version": 1, "updatedAt": None, "videos": {}})
    capture_seconds = int(config.get("captureSeconds", 20))
    max_videos = int(config.get("maxVideosPerRun", 5))
    changed = False

    for channel in config.get("channels", []):
        videos = fetch_channel_videos(channel["channelId"])[:max_videos]
        for video in videos:
            changed = update_video(video, channel, answers, capture_seconds, args.force) or changed

    if changed:
        answers["updatedAt"] = datetime.now(timezone.utc).isoformat()
        write_json(Path(args.answers), answers)
        if args.commit or args.push:
            git_commit_and_push("Update Kkut Shot answers", args.push)
    else:
        print("No new answers.")


if __name__ == "__main__":
    main()
