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
    state.answer = null;
    renderPanel();

    if (!videoId) {
      state.lastResult = null;
      state.revealed = false;
      return;
    }

    if (videoId !== lastVideoId) {
      state.lastResult = null;
      state.revealed = false;
      lastVideoId = videoId;
    }

    const data = await chrome.storage.local.get([DATASET_KEY]);
    state.answer = data[DATASET_KEY]?.videos?.[videoId] || null;
    state.revealed = Boolean(state.lastResult);
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

  function jumpToBeforeAnswer() {
    const video = getVideo();
    if (!video || !state.answer) return;
    video.currentTime = Math.max(0, state.answer.answerTime - 10);
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
      ? "결과가 공개되었습니다."
      : "정답은 끝! 찍기 이후에 공개됩니다.";
    const result = state.lastResult
      ? `<div class="kkut-shot-result">
          <div>입력: ${window.KkutShotTime.formatTimestamp(state.lastResult.guessTime)}</div>
          <div>오차: ${Math.abs(state.lastResult.diff).toFixed(3)}초 ${state.lastResult.diff < 0 ? "빠름" : "늦음"}</div>
        </div>`
      : "";

    panel.innerHTML = `
      <strong>무비띵크 끝 샷!</strong>
      <div class="kkut-shot-muted">${sourceText}</div>
      <div>정답: ${answerText}</div>
      <button type="button" data-action="jump" ${state.answer ? "" : "disabled"}>끝 10초 전으로</button>
      <button type="button" data-action="judge" ${state.answer ? "" : "disabled"}>끝! 찍기</button>
      ${result}
    `;
    panel.querySelector("[data-action='jump']")?.addEventListener("click", jumpToBeforeAnswer);
    panel.querySelector("[data-action='judge']")?.addEventListener("click", judgeGuess);
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
  window.addEventListener("yt-navigate-start", loadAnswer);
  window.addEventListener("yt-navigate-finish", loadAnswer);
  window.addEventListener("popstate", loadAnswer);
})();
