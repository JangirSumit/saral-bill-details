chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Keep service worker alive
let keepAliveInterval;

function startKeepAlive() {
  keepAliveInterval = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {
      // This keeps the service worker active
    });
  }, 20000); // Every 20 seconds
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

// Start keepalive when extension starts
startKeepAlive();

// Listen for messages to manage keepalive
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startProcessing') {
    startKeepAlive();
    sendResponse({ success: true });
  } else if (request.action === 'stopProcessing') {
    stopKeepAlive();
    sendResponse({ success: true });
  }
});