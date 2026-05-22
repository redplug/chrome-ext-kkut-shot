(function () {
  function parseTimestamp(value) {
    const parts = value.trim().split(":").map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return null;
  }

  function formatTimestamp(totalSeconds) {
    if (!Number.isFinite(totalSeconds)) return "--:--";
    const rounded = Math.max(0, totalSeconds);
    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const seconds = Math.floor(rounded % 60);
    const fraction = Math.floor((rounded % 1) * 1000);
    const base = hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${minutes}:${String(seconds).padStart(2, "0")}`;
    return `${base}.${String(fraction).padStart(3, "0")}`;
  }

  function getVideoId() {
    return new URL(location.href).searchParams.get("v") || "";
  }

  window.KkutShotTime = {
    parseTimestamp,
    formatTimestamp,
    getVideoId
  };
})();
