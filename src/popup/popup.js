const DEFAULT_DATA_URL = "https://raw.githubusercontent.com/redplug/chrome-ext-kkut-shot/main/data/answers.json";
const DATA_URL_KEY = "kkut-shot:data-url";
const DATASET_KEY = "kkut-shot:answers";

const els = {
  status: document.querySelector("#status"),
  title: document.querySelector("#title"),
  answer: document.querySelector("#answer"),
  bestScore: document.querySelector("#best-score"),
  bestDiff: document.querySelector("#best-diff"),
  updated: document.querySelector("#updated"),
  videoList: document.querySelector("#video-list"),
  historyList: document.querySelector("#history-list"),
  dataUrl: document.querySelector("#data-url"),
  refreshData: document.querySelector("#refresh-data"),
  refresh: document.querySelector("#refresh")
};

let activeTab = null;
let videoInfo = null;
let dataset = null;
let selectedVideoId = "";
let statsByVideoId = {};

function setStatus(text) {
  els.status.textContent = text;
}

function setBusy(isBusy) {
  els.refreshData.disabled = isBusy;
  els.refresh.disabled = isBusy;
}

function getStorageKey(videoId) {
  return `kkut-shot:${videoId}`;
}

function scoreFromDiff(diff) {
  return Math.max(0, 1000 - Math.round(Math.abs(diff) * 100));
}

function buildStats(entry) {
  const guesses = entry?.guesses || [];
  if (!guesses.length) {
    return { guesses: [], best: null };
  }

  const best = guesses.reduce((acc, cur) => {
    if (!acc) return cur;
    return Math.abs(cur.diff) < Math.abs(acc.diff) ? cur : acc;
  }, null);

  return {
    guesses,
    best: {
      diff: best.diff,
      score: scoreFromDiff(best.diff)
    }
  };
}

function formatDiff(diff) {
  return `${Math.abs(diff).toFixed(3)}초 ${diff < 0 ? "빠름" : "늦음"}`;
}

function getAnswer(videoId) {
  return dataset?.videos?.[videoId] || null;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToContent(type, payload = {}) {
  return chrome.tabs.sendMessage(activeTab.id, { type, ...payload });
}

function getVideoEntries() {
  const videos = dataset?.videos || {};
  return Object.entries(videos)
    .map(([videoId, answer]) => ({ videoId, answer }))
    .sort((a, b) => {
      const at = a.answer.publishedAt || "";
      const bt = b.answer.publishedAt || "";
      return bt.localeCompare(at);
    });
}

async function loadSettings() {
  const data = await chrome.storage.local.get([DATA_URL_KEY, DATASET_KEY]);
  els.dataUrl.value = data[DATA_URL_KEY] || DEFAULT_DATA_URL;
  dataset = data[DATASET_KEY] || null;
}

async function saveDataUrl() {
  await chrome.storage.local.set({ [DATA_URL_KEY]: els.dataUrl.value.trim() });
}

async function loadStats() {
  const videoEntries = getVideoEntries();
  const keys = videoEntries.map((item) => getStorageKey(item.videoId));
  if (!keys.length) {
    statsByVideoId = {};
    return;
  }

  const data = await chrome.storage.local.get(keys);
  const nextStats = {};
  for (const item of videoEntries) {
    nextStats[item.videoId] = buildStats(data[getStorageKey(item.videoId)]);
  }
  statsByVideoId = nextStats;
}

function renderVideoList() {
  const entries = getVideoEntries();
  if (!entries.length) {
    els.videoList.innerHTML = `<div class="history-item">등록된 영상이 없습니다.</div>`;
    return;
  }

  els.videoList.innerHTML = entries.map(({ videoId, answer }) => {
    const stats = statsByVideoId[videoId];
    const played = stats?.guesses?.length || 0;
    const scoreText = stats?.best ? `${stats.best.score}점` : "-";
    const activeClass = selectedVideoId === videoId ? "active" : "";
    return `
      <button type="button" class="video-item ${activeClass}" data-video-id="${videoId}">
        ${answer.title || videoId}
        <span class="meta">플레이 ${played}회 · 최고 ${scoreText}</span>
      </button>
    `;
  }).join("");

  els.videoList.querySelectorAll(".video-item").forEach((button) => {
    button.addEventListener("click", async () => {
      selectedVideoId = button.dataset.videoId || "";
      const url = selectedVideoId ? `https://www.youtube.com/watch?v=${selectedVideoId}` : "";
      if (url && activeTab?.id) {
        try {
          await chrome.tabs.update(activeTab.id, { url });
        } catch (_error) {
          await chrome.tabs.create({ url });
        }
      }
      renderInfo();
      renderVideoList();
    });
  });
}

function renderHistory(stats) {
  const guesses = stats?.guesses || [];
  if (!guesses.length) {
    els.historyList.innerHTML = `<div class="history-item">기록 없음</div>`;
    return;
  }

  els.historyList.innerHTML = guesses.map((guess) => `
    <div class="history-item">
      <div>입력 ${window.KkutShotTime.formatTimestamp(guess.guessTime)} · 오차 ${formatDiff(guess.diff)}</div>
      <div class="meta">${new Date(guess.createdAt).toLocaleString()}</div>
    </div>
  `).join("");
}

function renderInfo() {
  if (!dataset) {
    els.title.textContent = "-";
    els.answer.textContent = "-";
    els.bestScore.textContent = "-";
    els.bestDiff.textContent = "-";
    els.updated.textContent = "-";
    els.historyList.innerHTML = `<div class="history-item">기록 없음</div>`;
    setStatus("정답 데이터를 먼저 새로고침하세요.");
    return;
  }

  const answer = getAnswer(selectedVideoId);
  const stats = statsByVideoId[selectedVideoId] || { guesses: [], best: null };
  els.title.textContent = answer?.title || "영상을 선택하세요.";
  els.answer.textContent = !answer
    ? "-"
    : "비공개";
  els.bestScore.textContent = stats.best ? `${stats.best.score}점` : "-";
  els.bestDiff.textContent = stats.best ? formatDiff(stats.best.diff) : "-";
  els.updated.textContent = dataset.updatedAt || "-";

  renderHistory(stats);

  if (!answer) {
    setStatus("등록 영상을 선택하세요.");
  } else {
    setStatus("영상 선택 후 페이지에서 끝! 찍기를 누르세요.");
  }
}

async function refreshDataset() {
  const url = els.dataUrl.value.trim();
  if (!url) {
    setStatus("GitHub answers.json URL을 입력하세요.");
    return;
  }

  setBusy(true);
  try {
    setStatus("정답 데이터를 가져오는 중입니다.");
    const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`);
    if (!response.ok) throw new Error(`데이터 요청 실패: ${response.status}`);

    const nextDataset = await response.json();
    if (!nextDataset || typeof nextDataset !== "object" || !nextDataset.videos) {
      throw new Error("answers.json 형식이 올바르지 않습니다.");
    }

    dataset = nextDataset;
    await chrome.storage.local.set({
      [DATASET_KEY]: nextDataset,
      [DATA_URL_KEY]: url
    });

    if (activeTab?.id) {
      try {
        await sendToContent("KKUT_REFRESH_ANSWER");
      } catch (_error) {}
    }

    if (!selectedVideoId || !getAnswer(selectedVideoId)) {
      const entries = getVideoEntries();
      selectedVideoId = entries[0]?.videoId || "";
    }

    await loadStats();
    renderVideoList();
    renderInfo();
  } catch (error) {
    setStatus(error.message);
  } finally {
    setBusy(false);
  }
}

async function refreshInfo() {
  activeTab = await getActiveTab();
  videoInfo = null;

  if (activeTab?.url?.startsWith("https://www.youtube.com/watch")) {
    try {
      videoInfo = await sendToContent("KKUT_GET_VIDEO_INFO");
    } catch (_error) {}
  }

  if (videoInfo?.videoId && getAnswer(videoInfo.videoId)) {
    selectedVideoId = videoInfo.videoId;
  } else if (!selectedVideoId || !getAnswer(selectedVideoId)) {
    const entries = getVideoEntries();
    selectedVideoId = entries[0]?.videoId || "";
  }

  await loadStats();
  renderVideoList();
  renderInfo();
}

els.dataUrl.addEventListener("change", saveDataUrl);
els.refreshData.addEventListener("click", refreshDataset);
els.refresh.addEventListener("click", refreshInfo);

(async function init() {
  await loadSettings();
  await refreshDataset();
  await refreshInfo();
})();
