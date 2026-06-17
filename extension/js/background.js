chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'reload_extension') {
    // Reload the current tab, then reload the extension
    if (sender.tab && sender.tab.id) {
      chrome.tabs.reload(sender.tab.id, () => {
        setTimeout(() => chrome.runtime.reload(), 500);
      });
    } else {
      chrome.runtime.reload();
    }
    sendResponse({ status: "reloading" });
  }
});
