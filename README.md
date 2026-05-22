# Kkut Shot

YouTube 영상에서 "끝!"이 나오는 정확한 시점을 맞추는 Chrome 확장 프로그램입니다. 정답 시간은 맥미니가 하루 한 번 분석해서 GitHub의 `data/answers.json`에 올리고, 확장 프로그램은 그 파일만 읽습니다.

## 동작 구조

```text
맥미니: 새 영상 확인 → 아웃트로 오디오 분석 → answers.json 업데이트 → GitHub push
크롬 확장: answers.json 다운로드 → 현재 영상 정답 조회 → 버튼 입력 오차 계산
```

## 개발용 맥에서 시작하기

```bash
git clone https://github.com/redplug/chrome-ext-kkut-shot.git
cd chrome-ext-kkut-shot
```

확장 프로그램 수정 후 기본 검사는 아래 명령으로 합니다.

```bash
python3 -m json.tool manifest.json
node --check src/content/youtube.js
node --check src/popup/popup.js
node --check src/shared/time.js
PYTHONPYCACHEPREFIX=.pycache python3 -m py_compile scripts/update_answers.py
```

## 맥미니 정답 분석기 설정

맥미니에서 저장소를 받고 필요한 도구를 설치합니다.

```bash
git clone https://github.com/redplug/chrome-ext-kkut-shot.git
cd chrome-ext-kkut-shot
brew install python@3.12 ffmpeg gh
python3.12 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r scripts/requirements.txt
gh auth login
```

`python3`가 3.14 같은 최신/실험 버전을 가리키면 `ensurepip` 오류로 가상환경 생성이 실패할 수 있습니다. 이 프로젝트의 맥미니 분석기는 `python3.12`로 만드세요. 이미 실패한 `.venv`가 있으면 지우고 다시 생성합니다.

```bash
rm -rf .venv
python3.12 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r scripts/requirements.txt
```

채널 설정 파일을 만듭니다.

```bash
cp config/channels.example.json config/channels.json
```

`config/channels.json`에 대상 유튜버의 `channelId`를 넣습니다. 영상 설명이나 챕터에 `07:22 아웃트로` 같은 항목이 있어야 분석됩니다.

수동 실행:

```bash
source .venv/bin/activate
git pull
python3 scripts/update_answers.py --commit --push
```

하루 한 번 자동 실행은 [docs/MACMINI_SETUP.md](docs/MACMINI_SETUP.md)의 launchd 설정을 사용하세요.

## 크롬 확장 설치

1. Chrome에서 `chrome://extensions` 열기
2. Developer mode 켜기
3. Load unpacked 클릭
4. 이 저장소 폴더 선택
5. YouTube 영상에서 확장 팝업 열기
6. `정답 데이터 새로고침` 클릭

기본 데이터 URL:

```text
https://raw.githubusercontent.com/redplug/chrome-ext-kkut-shot/main/data/answers.json
```

## 주요 파일

- `src/content/`: YouTube 페이지 오버레이와 게임 버튼
- `src/popup/`: 정답 데이터 새로고침 UI
- `scripts/update_answers.py`: 맥미니 정답 분석 스크립트
- `config/channels.example.json`: 분석 대상 채널 설정 예시
- `data/answers.json`: 확장 프로그램이 읽는 정답 데이터
