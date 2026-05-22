const DEFAULT_DATA_URL = "";
const DATA_URL_KEY = "kkut-shot:data-url";
const DATASET_KEY = "kkut-shot:answers";

const els = {
  status: document.querySelector("#status"),
  title: document.querySelector("#title"),
  answer: document.querySelector("#answer"),
  updated: document.querySelector("#updated"),
  dataUrl: document.querySelector("#data-url"),
  refreshData: document.querySelector("#refresh-data"),
  refresh: document.querySelector("#refresh")
};

let activeTab = null;
let videoInfo = null;
let dataset = null;

function setStatus(text) {
  els.status.textContent = text;
}

function setBusy(isBusy) {
  els.refreshData.disabled = isBusy;
  els.refresh.disabled = isBusy;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToContent(type, payload = {}) {
  return chrome.tabs.sendMessage(activeTab.id, { type, ...payload });
}

function getAnswer(videoId) {
  return dataset?.videos?.[videoId] || null;
}

async function loadSettings() {
  const data = await chrome.storage.local.get([DATA_URL_KEY, DATASET_KEY]);
  els.dataUrl.value = data[DATA_URL_KEY] || DEFAULT_DATA_URL;
  dataset = data[DATASET_KEY] || null;
}

async function saveDataUrl() {
  await chrome.storage.local.set({ [DATA_URL_KEY]: els.dataUrl.value.trim() });
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
    await sendToContent("KKUT_REFRESH_ANSWER");
    setStatus("정답 데이터를 저장했습니다.");
    renderInfo();
  } catch (error) {
    setStatus(error.message);
  } finally {
    setBusy(false);
  }
}

async function refreshInfo() {
  activeTab = await getActiveTab();
  if (!activeTab?.url?.startsWith("https://www.youtube.com/watch")) {
    setStatus("YouTube 영상 페이지에서 사용하세요.");
    return;
  }

  videoInfo = await sendToContent("KKUT_GET_VIDEO_INFO");
  if (!videoInfo?.ok) {
    setStatus("영상 정보를 찾지 못했습니다. 페이지를 새로고침해 보세요.");
    return;
  }

  renderInfo();
}

function renderInfo() {
  if (!videoInfo) return;

  const answer = getAnswer(videoInfo.videoId);
  els.title.textContent = videoInfo.title;
  els.answer.textContent = answer
    ? window.KkutShotTime.formatTimestamp(answer.answerTime)
    : "등록된 정답 없음";
  els.updated.textContent = dataset?.updatedAt || "-";

  if (answer) {
    setStatus("이 영상의 정답이 준비됐습니다.");
  } else if (dataset) {
    setStatus("데이터에는 있지만 현재 영상 정답은 없습니다.");
  } else {
    setStatus("정답 데이터를 먼저 새로고침하세요.");
  }
}

els.dataUrl.addEventListener("change", saveDataUrl);
els.refreshData.addEventListener("click", refreshDataset);
els.refresh.addEventListener("click", refreshInfo);

(async function init() {
  await loadSettings();
  await refreshInfo();
})();
