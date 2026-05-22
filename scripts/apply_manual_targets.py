#!/usr/bin/env python3
import argparse
import json
import re
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANSWERS_PATH = ROOT / "data" / "answers.json"
TARGETS_PATH = ROOT / "config" / "manual_targets.json"
TARGET_PATTERNS = (
    re.compile(r"끄+\s*읕"),
    re.compile(r"(?<![가-힣])끝[!?]?(?![가-힣])"),
    re.compile(r"(?<![가-힣])끗[!?]?(?![가-힣])"),
)
VTT_TIME_RE = re.compile(
    r"(?P<h>\d{2}):(?P<m>\d{2}):(?P<s>\d{2})\.(?P<ms>\d{3})\s+-->\s+"
    r"(?P<h2>\d{2}):(?P<m2>\d{2}):(?P<s2>\d{2})\.(?P<ms2>\d{3})"
)


def run(command):
    return subprocess.run(command, check=True, text=True, capture_output=True)


def load_json(path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def is_kkut_token(text):
    token = (text or "").strip()
    return any(pattern.search(token) for pattern in TARGET_PATTERNS)


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def parse_timestamp(value):
    parts = [int(part) for part in value.split(":")]
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    raise ValueError(f"Invalid timestamp: {value}")


def download_audio_section(url, start, end):
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


def timestamp_to_seconds(text):
    h, m, s = text.split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def find_subtitle_hint_time(url, target_time):
    tempdir = tempfile.TemporaryDirectory()
    directory = Path(tempdir.name)
    output_template = str(directory / "%(id)s.%(ext)s")
    run([
        "yt-dlp",
        "--quiet",
        "--no-warnings",
        "--skip-download",
        "--write-auto-sub",
        "--sub-langs",
        "ko",
        "--sub-format",
        "vtt",
        "-o",
        output_template,
        url,
    ])

    vtts = list(directory.glob("*.ko.vtt"))
    if not vtts:
        tempdir.cleanup()
        return None, ""

    text = vtts[0].read_text(encoding="utf-8", errors="ignore")
    lines = text.splitlines()
    cues = []
    i = 0
    while i < len(lines):
        match = VTT_TIME_RE.search(lines[i].strip())
        if not match:
            i += 1
            continue
        start = timestamp_to_seconds(f"{match.group('h')}:{match.group('m')}:{match.group('s')}.{match.group('ms')}")
        i += 1
        cue_text_parts = []
        while i < len(lines) and lines[i].strip():
            cue_text_parts.append(lines[i].strip())
            i += 1
        cue_text = " ".join(cue_text_parts)
        if is_kkut_token(cue_text):
            cues.append((start, cue_text))
        i += 1

    tempdir.cleanup()
    if not cues:
        return None, ""
    best = min(cues, key=lambda item: abs(item[0] - target_time))
    return best[0], best[1]


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


def find_candidate(segments, base_start, target_time):
    segment_candidates = []
    word_candidates = []
    transcript = []

    for segment in segments:
        text = (segment.text or "").strip()
        if text:
            transcript.append(text)
        for word in getattr(segment, "words", None) or []:
            token = (word.word or "").strip()
            if is_kkut_token(token):
                word_candidates.append({
                    "answerTime": base_start + float(word.start),
                    "relativeTime": float(word.start),
                    "matchedText": token,
                })

        if is_kkut_token(text):
            segment_candidates.append({
                "answerTime": base_start + float(segment.start),
                "relativeTime": float(segment.start),
                "matchedText": text,
            })

    candidates = word_candidates or segment_candidates
    if not candidates:
        return None, " ".join(transcript)
    return min(candidates, key=lambda item: abs(item["answerTime"] - target_time)), " ".join(transcript)


def apply_target(answers, target):
    video_id = target["videoId"]
    entry = answers.get("videos", {}).get(video_id)
    if not entry:
        print(f"{video_id}: skipped (missing in answers.json)")
        return False

    target_time = parse_timestamp(target["targetTime"])
    window = int(target.get("windowSeconds", 14))
    subtitle_time, subtitle_text = find_subtitle_hint_time(url=entry["url"], target_time=target_time)
    coarse_time = subtitle_time if subtitle_time is not None else target_time
    start = max(0, coarse_time - window)
    end = coarse_time + window
    url = entry["url"]

    tempdir, audio_path = download_audio_section(url, start, end)
    try:
        candidate, transcript = find_candidate(transcribe(audio_path), start, target_time)
    finally:
        tempdir.cleanup()

    if candidate:
        answer_time = round(candidate["answerTime"], 3)
        matched_text = candidate["matchedText"]
        confidence = "subtitle_plus_pattern"
    else:
        answer_time = round(float(target_time), 3)
        matched_text = f"MANUAL_TARGET_{target['targetTime']}"
        confidence = "manual_target_fallback"

    entry["answerTime"] = answer_time
    entry["matchedText"] = matched_text
    entry["confidence"] = confidence
    entry["transcript"] = transcript
    entry["detectedAt"] = datetime.now(timezone.utc).isoformat()
    hint = f", subtitle={round(subtitle_time,3)}" if subtitle_time is not None else ", subtitle=none"
    print(f"{video_id}: saved {answer_time}s ({confidence}{hint})")
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--targets", default=str(TARGETS_PATH))
    parser.add_argument("--answers", default=str(ANSWERS_PATH))
    args = parser.parse_args()

    targets = load_json(Path(args.targets), None)
    if not targets:
        raise SystemExit("Missing config/manual_targets.json. Copy manual_targets.example.json first.")

    answers = load_json(Path(args.answers), {"version": 1, "updatedAt": None, "videos": {}})
    changed = False
    for target in targets.get("targets", []):
        changed = apply_target(answers, target) or changed

    if changed:
        answers["updatedAt"] = datetime.now(timezone.utc).isoformat()
        write_json(Path(args.answers), answers)
    else:
        print("No changes.")


if __name__ == "__main__":
    main()
