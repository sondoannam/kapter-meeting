// This file is the devtools page entry — it only registers the panel.
// It has NO visible UI itself.
chrome.devtools.panels.create(
  "My Extension", // Panel tab title
  chrome.runtime.getURL("favicon.svg"),
  chrome.runtime.getURL("src/devtools/panel.html"),
  (panel) => {
    panel.onShown.addListener((panelWindow) => {
      console.log("DevTools panel shown", panelWindow);
    });
  },
);
