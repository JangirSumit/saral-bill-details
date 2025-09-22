chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({
    path: 'sidepanel.html',
    enabled: true
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendTrustedEvent') {
    sendTrustedEvent(sender.tab.id, request.eventData)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'typeWithKeyboardEvents') {
    typeWithKeyboardEvents(sender.tab.id, request.selector, request.text)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'sendTrustedClick') {
    sendTrustedClick(sender.tab.id, request.selector)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function sendTrustedEvent(tabId, eventData) {
  if (!chrome.debugger) {
    throw new Error('Debugger API not available');
  }
  
  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
      expression: `
        const element = document.querySelector('${eventData.selector}');
        if (element) {
          ${eventData.action}
        }
      `
    });
    await chrome.debugger.detach({ tabId });
  } catch (error) {
    console.error('Trusted event failed:', error);
    throw error;
  }
}

async function sendTrustedClick(tabId, selector) {
  if (!chrome.debugger) {
    throw new Error('Debugger API not available');
  }
  
  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    
    // Convert :contains() selector to XPath for better reliability
    let findExpression;
    if (selector.includes(':contains(')) {
      const match = selector.match(/^(\w+):contains\('([^']+)'\)$/);
      if (match) {
        const [, tagName, textContent] = match;
        findExpression = `document.evaluate("//${tagName}[contains(text(), '${textContent}')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`;
      } else {
        findExpression = `document.querySelector('${selector}')`;
      }
    } else {
      findExpression = `document.querySelector('${selector}')`;
    }
    
    // Get element position with fallback for li elements
    const result = await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
      expression: `
        let targetEl = ${findExpression};
        // Fallback for li elements with text content
        if (!targetEl && '${selector}'.includes('li:contains(')) {
          const match = '${selector}'.match(/li:contains\('([^']+)'\)/);
          if (match) {
            const text = match[1];
            targetEl = Array.from(document.querySelectorAll('li')).find(li => 
              li.textContent && li.textContent.includes(text)
            );
          }
        }
        if (targetEl) {
          const rect = targetEl.getBoundingClientRect();
          ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, found: true });
        } else {
          ({ found: false });
        }
      `,
      returnByValue: true
    });
    
    if (result.result.value && result.result.value.found) {
      const { x, y } = result.result.value;
      
      // Send mouse click
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: x,
        y: y,
        button: 'left',
        clickCount: 1
      });
      
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: x,
        y: y,
        button: 'left',
        clickCount: 1
      });
    } else {
      throw new Error('Element not found for selector: ' + selector);
    }
    
    await chrome.debugger.detach({ tabId });
  } catch (error) {
    console.error('Trusted click failed:', error);
    throw error;
  }
}

async function typeWithKeyboardEvents(tabId, selector, text) {
  if (!chrome.debugger) {
    throw new Error('Debugger API not available');
  }
  
  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    
    // Convert :contains() selector to XPath for better reliability
    let findExpression;
    if (selector.includes(':contains(')) {
      const match = selector.match(/^(\w+):contains\('([^']+)'\)$/);
      if (match) {
        const [, tagName, textContent] = match;
        findExpression = `document.evaluate("//${tagName}[contains(text(), '${textContent}')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`;
      } else {
        findExpression = `document.querySelector('${selector}')`;
      }
    } else {
      findExpression = `document.querySelector('${selector}')`;
    }
    
    // Focus the element - for generic selectors, find the specific one being targeted
    await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
      expression: `
        let inputEl = ${findExpression};
        // If multiple elements match, find the one that's currently focused or visible
        if (!inputEl && '${selector}'.includes('input[type="text"]')) {
          const inputs = document.querySelectorAll('${selector}');
          inputEl = Array.from(inputs).find(el => el.offsetParent !== null && !el.disabled);
        }
        if (inputEl) {
          inputEl.focus();
          inputEl.click();
          inputEl.value = '';
        }
      `
    });
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      // Send char event which actually inserts the character
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
        type: 'char',
        text: char,
        unmodifiedText: char
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    await chrome.debugger.detach({ tabId });
  } catch (error) {
    console.error('Trusted typing failed:', error);
    throw error;
  }
}