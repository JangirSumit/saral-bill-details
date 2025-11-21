// Content script for UPPCL website interaction
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Global stop flag for content script
let contentStopProcessing = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchBill') {
    contentStopProcessing = false;
    fetchBillFromSite(request.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'stop') {
    contentStopProcessing = true;
    sendResponse({ success: true });
  }
  
  if (request.action === 'ping') {
    sendResponse({ success: true });
  }
});

async function fetchBillFromSite(data) {
  try {
    console.log('🚀 Starting bill fetch for consumer:', data.consumerNumber);
    
    if (contentStopProcessing) {
      return { success: false, error: 'Processing stopped by user' };
    }
    
    // Navigate to bill payment page if not already there
    if (!window.location.href.includes('pay_bill_home')) {
      console.log('📍 Navigating to bill payment page');
      window.location.href = 'https://consumer.uppcl.org/wss/pay_bill_home';
      await waitForPageLoad();
    }

    if (contentStopProcessing) {
      return { success: false, error: 'Processing stopped by user' };
    }

    // Fill form fields
    console.log('📝 Filling form fields');
    await fillBillForm(data);
    
    if (contentStopProcessing) {
      return { success: false, error: 'Processing stopped by user' };
    }
    
    // Submit form and get results
    console.log('📊 Extracting bill data');
    const billData = await submitAndGetBill();
    
    console.log('✅ Bill fetch completed successfully');
    return { success: true, data: billData };
  } catch (error) {
    console.error('❌ Bill fetch failed:', error.message);
    return { success: false, error: error.message };
  }
}

function waitForPageLoad() {
  return new Promise(resolve => {
    if (document.readyState === 'complete') {
      resolve();
    } else {
      window.addEventListener('load', resolve);
    }
  });
}

async function fillBillForm(data) {
  // Click district selector first
  console.log('📍 Clicking district selector');
  const districtSelector = await waitForElement('mat-select[name="discomSelect"] .mat-mdc-select-arrow-wrapper');
  if (districtSelector) {
    districtSelector.click();
    
    // Find and click the district option
    console.log('📍 Selecting district:', data.district);
    const listbox = await waitForElement('div[role="listbox"]');
    if (listbox) {
      const options = listbox.querySelectorAll('mat-option');
      for (const option of options) {
        if (option.textContent.trim().includes(data.district)) {
          option.click();
          break;
        }
      }
    }
  }
  
  await delay(1000);

  // Select DISCOM by abbreviation
  const discomAbbr = data.discom.match(/\(([^)]+)\)/)?.[1] || data.discom;
  console.log('⚡ Selecting DISCOM:', discomAbbr);
  const discomElement = await waitForElement(`#${discomAbbr}`);
  if (discomElement) {
    discomElement.click();
  }

  // Fill consumer number
  console.log('🔢 Filling consumer number:', data.consumerNumber);
  const consumerInput = await waitForElement('input[placeholder="Account Number (Required)"]');
  if (consumerInput) {
    consumerInput.value = data.consumerNumber;
    consumerInput.dispatchEvent(new Event('input'));
  }
  
  // Fill captcha with random 2-digit number
  const captchaInput = await waitForElement('#captchaInput');
  if (captchaInput) {
    const randomCaptcha = Math.floor(Math.random() * 90) + 10;
    console.log('🔐 Filling captcha:', randomCaptcha);
    captchaInput.value = randomCaptcha;
    captchaInput.dispatchEvent(new Event('input'));
  }
  
  // Click submit button
  console.log('📤 Clicking submit button');
  const submitButton = await waitForElement('button[type="submit"]');
  if (submitButton) {
    submitButton.click();
  }
  
  // Wait and click View Bill button
  console.log('📄 Waiting for View Bill button');
  const viewBillButton = await waitForElement('button.btn.btn-prim.memuBtn');
  if (viewBillButton && viewBillButton.textContent.trim() === 'View Bill') {
    viewBillButton.click();
  }
  
  // Wait for dialog and click Download Bill button
  //await DownloadBillFromDialog();
  
  // Wait and click Back button
  console.log('⬅️ Waiting for Back button');
  const backButton = await waitForElement('button.btn.btn-sec');
  if (backButton && backButton.textContent.trim() === 'Back') {
    backButton.click();
  }
  
  // Wait for navigation back to home
  console.log('🏠 Navigating back to home');
  await delay(2000);
}

async function DownloadBillFromDialog() {
  console.log('⏳ Waiting for OTP dialog');
  const dialog = await waitForElement('app-validate-mobile-otp-dialog');
  if (dialog) {
    await delay(1000);
    console.log('📥 Clicking Download Bill button');
    const downloadBillButton = [...dialog.querySelectorAll('button')]
      .find(b => b.textContent.trim() === 'Download Bill');
    if (downloadBillButton) {
      downloadBillButton.click();
    }
  }

  // Close dialog
  console.log('❌ Waiting for close button');
  const closeButton = await waitForElement('button[mat-dialog-close].close');
  if (closeButton) {
    closeButton.click();
  }
}

function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

async function submitAndGetBill() {
  // Find and click submit button
  const submitBtn = await waitForElement('input[type="submit"]') ||
                   await waitForElement('button[type="submit"]') ||
                   await waitForElement('.btn-submit') ||
                   await waitForElement('#submit');

  if (!submitBtn) {
    throw new Error('Submit button not found');
  }

  submitBtn.click();

  // Wait for results
  await delay(2000);

  // Extract bill data from the page
  const billData = await extractBillData();
  return billData;
}

async function extractBillData() {
  // This function extracts bill information from the UPPCL response page
  // Adjust selectors based on actual UPPCL page structure
  
  const billInfo = {};
  
  // Common selectors for bill information
  const selectors = {
    consumerName: '.consumer-name, #consumer_name, [data-label="Consumer Name"]',
    billAmount: '.bill-amount, #bill_amount, [data-label="Bill Amount"]',
    dueDate: '.due-date, #due_date, [data-label="Due Date"]',
    billNumber: '.bill-number, #bill_number, [data-label="Bill Number"]',
    address: '.address, #address, [data-label="Address"]'
  };

  for (const [key, selector] of Object.entries(selectors)) {
    const element = await waitForElement(selector, 2000);
    if (element) {
      billInfo[key] = element.textContent.trim();
    }
  }

  // If no specific data found, capture general bill information
  if (Object.keys(billInfo).length === 0) {
    const billTable = await waitForElement('table', 2000) || await waitForElement('.bill-details', 2000);
    if (billTable) {
      billInfo.rawData = billTable.outerHTML;
    }
  }

  return billInfo;
}