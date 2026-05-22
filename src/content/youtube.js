(function () {
  const DATASET_KEY = "kkut-shot:answers";
  let lastVideoId = "";
  const state = {
    answer: null,
    lastResult: null,
    revealed: false
  };

  function getVideo() {
    return document.querySelector("video");
  }

  function getTitle() {
    return document.querySelector("h1 yt-formatted-string")?.textContent?.trim()
      || document.title.replace(" - YouTube", "");
  }

  function getStorageKey() {
    return `kkut-shot:${window.KkutShotTime.getVideoId()}`;
  }

  async function loadAnswer() {
    const videoId = window.KkutShotTime.getVideoId();
    if (!videoId) {
      state.answer = null;
      state.lastResult = null;
      state.revealed = false;
      renderPanel();
      return;
    }

    if (videoId !== lastVideoId) {
      state.lastResult = null;
      state.revealed = false;
      lastVideoId = videoId;
    }

    const key = getStorageKey();
    const data = await chrome.storage.local.get([DATASET_KEY, key]);
    state.answer = data[DATASET_KEY]?.videos?.[videoId] || null;
    const guesses = data[key]?.guesses || [];
    state.revealed = guesses.length > 0 || Boolean(state.lastResult);
    renderPanel();
  }

  async function saveGuess(guessTime, diff) {
    const key = getStorageKey();
    const data = await chrome.storage.local.get(key);
    const entry = data[key] || {};
    const guesses = entry.guesses || [];
    guesses.unshift({
      guessTime,
      answerTime: state.answer.answerTime,
      diff,
      createdAt: new Date().toISOString()
    });
    await chrome.storage.local.set({
      [key]: {
        ...entry,
        videoId: window.KkutShotTime.getVideoId(),
        title: getTitle(),
        guesses: guesses.slice(0, 20)
      }
    });
  }

  function judgeGuess() {
    const video = getVideo();
    if (!video || !state.answer) return;

    const guessTime = video.currentTime;
    const diff = guessTime - state.answer.answerTime;
    state.lastResult = {
      guessTime,
      diff
    };
    state.revealed = true;
    saveGuess(guessTime, diff);
    renderPanel();
  }

  function renderPanel() {
    if (!state.answer) {
      document.querySelector("#kkut-shot-panel")?.remove();
      return;
    }

    let panel = document.querySelector("#kkut-shot-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "kkut-shot-panel";
      document.documentElement.appendChild(panel);
    }

    const answerText = state.revealed
      ? window.KkutShotTime.formatTimestamp(state.answer.answerTime)
      : "끝! 찍기 후 공개";
    const sourceText = state.revealed
      ? (state.answer?.detectedAt ? `감지: ${state.answer.detectedAt}` : "감지 정보 없음")
      : "감지/정답은 끝! 찍기 이후에 공개됩니다.";
    const result = state.lastResult
      ? `<div class="kkut-shot-result">
          <div>입력: ${window.KkutShotTime.formatTimestamp(state.lastResult.guessTime)}</div>
          <div>오차: ${Math.abs(state.lastResult.diff).toFixed(3)}초 ${state.lastResult.diff < 0 ? "빠름" : "늦음"}</div>
        </div>`
      : "";

    panel.innerHTML = `
      <strong>Kkut Shot</strong>
      <div class="kkut-shot-muted">${sourceText}</div>
      <div>정답: ${answerText}</div>
      <button type="button" ${state.answer ? "" : "disabled"}>끝! 찍기</button>
      ${result}
    `;
    panel.querySelector("button")?.addEventListener("click", judgeGuess);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "KKUT_GET_VIDEO_INFO") {
      const video = getVideo();
      sendResponse({
        ok: Boolean(video),
        videoId: window.KkutShotTime.getVideoId(),
        title: getTitle(),
        currentTime: video?.currentTime ?? 0,
        duration: video?.duration ?? 0
      });
      return true;
    }

    if (message.type === "KKUT_REFRESH_ANSWER") {
      loadAnswer();
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });

  loadAnswer();
  setInterval(loadAnswer, 1000);
  window.addEventListener("yt-navigate-finish", loadAnswer);
  window.addEventListener("popstate", loadAnswer);
})();
