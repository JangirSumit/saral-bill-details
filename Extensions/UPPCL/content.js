// Content script for UPPCL website interaction
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchBill') {
    fetchBillFromSite(request.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'ping') {
    sendResponse({ success: true });
  }
});

async function fetchBillFromSite(data) {
  try {
    console.log('🚀 Starting bill fetch for consumer:', data.consumerNumber);
    
    // Navigate to bill payment page if not already there
    if (!window.location.href.includes('pay_bill_home')) {
      console.log('📍 Navigating to bill payment page');
      window.location.href = 'https://consumer.uppcl.org/wss/pay_bill_home';
      await waitForPageLoad();
    }

    // Fill form fields
    console.log('📝 Filling form fields');
    await fillBillForm(data);
    
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
  const districtSelector = document.querySelector('mat-select[name="discomSelect"] .mat-mdc-select-arrow-wrapper');
  if (districtSelector) {
    districtSelector.click();
    await delay(2000);
    
    // Find and click the district option
    console.log('📍 Selecting district:', data.district);
    const listbox = document.querySelector('div[role="listbox"]');
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
  
  await delay(2000);

  // Select DISCOM by abbreviation
  const discomAbbr = data.discom.match(/\(([^)]+)\)/)?.[1] || data.discom;
  console.log('⚡ Selecting DISCOM:', discomAbbr);
  const discomElement = document.querySelector(`#${discomAbbr}`);
  if (discomElement) {
    discomElement.click();
  }

  // Fill consumer number
  await delay(500);
  console.log('🔢 Filling consumer number:', data.consumerNumber);
  const consumerInput = document.querySelector('input[placeholder="Account Number (Required)"]');
  if (consumerInput) {
    consumerInput.value = data.consumerNumber;
    consumerInput.dispatchEvent(new Event('input'));
  }
  
  // Fill captcha with random 2-digit number
  await delay(500);
  const captchaInput = document.querySelector('#captchaInput');
  if (captchaInput) {
    const randomCaptcha = Math.floor(Math.random() * 90) + 10;
    console.log('🔐 Filling captcha:', randomCaptcha);
    captchaInput.value = randomCaptcha;
    captchaInput.dispatchEvent(new Event('input'));
  }
  
  // Click submit button
  await delay(500);
  console.log('📤 Clicking submit button');
  const submitButton = document.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.click();
  }
  
  // Wait 5 seconds and click View Bill button
  await delay(5000);
  console.log('📄 Clicking View Bill button');
  const viewBillButton = document.querySelector('button.btn.btn-prim.memuBtn');
  if (viewBillButton && viewBillButton.textContent.trim() === 'View Bill') {
    viewBillButton.click();
  }
  
  // Wait for dialog and click Download Bill button
  console.log('⏳ Waiting for OTP dialog');
  await waitForElement('app-validate-mobile-otp-dialog');
  await delay(1000);
  console.log('📥 Clicking Download Bill button');
  const downloadBillButton = [...document.querySelectorAll('app-validate-mobile-otp-dialog button')]
    .find(b => b.textContent.trim() === 'Download Bill');
  if (downloadBillButton) {
    downloadBillButton.click();
  }
  
  // Close dialog
  await delay(2000);
  console.log('❌ Closing dialog');
  const closeButton = document.querySelector('button[mat-dialog-close].close');
  if (closeButton) {
    closeButton.click();
  }
  
  // Wait and click Back button
  await delay(2000);
  console.log('⬅️ Clicking Back button');
  const backButton = document.querySelector('button.btn.btn-sec');
  if (backButton && backButton.textContent.trim() === 'Back') {
    backButton.click();
  }
  
  // Wait for navigation back to home
  console.log('🏠 Navigating back to home');
  await delay(3000);
}

function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
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
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

async function submitAndGetBill() {
  // Find and click submit button
  const submitBtn = document.querySelector('input[type="submit"]') ||
                   document.querySelector('button[type="submit"]') ||
                   document.querySelector('.btn-submit') ||
                   document.querySelector('#submit');

  if (!submitBtn) {
    throw new Error('Submit button not found');
  }

  submitBtn.click();

  // Wait for results
  await delay(2000);

  // Extract bill data from the page
  const billData = extractBillData();
  return billData;
}

function extractBillData() {
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
    const element = document.querySelector(selector);
    if (element) {
      billInfo[key] = element.textContent.trim();
    }
  }

  // If no specific data found, capture general bill information
  if (Object.keys(billInfo).length === 0) {
    const billTable = document.querySelector('table') || document.querySelector('.bill-details');
    if (billTable) {
      billInfo.rawData = billTable.outerHTML;
    }
  }

  return billInfo;
}