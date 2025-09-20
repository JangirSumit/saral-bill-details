class PaytmBillExtractor {
  constructor() {
    this.init();
  }

  init() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'processBill') {
        this.processBill(request.consumer)
          .then(data => sendResponse({ success: true, data }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep message channel open for async response
      }
    });
  }

  async processBill(consumer) {
    const consumerNumber = consumer.consumerNumber || consumer.ConsumerNumber || consumer.consumer_number;
    
    if (!consumerNumber) {
      throw new Error('Consumer number not found');
    }

    // Fill consumer number in the form
    await this.fillConsumerNumber(consumerNumber);
    
    // Click proceed button
    await this.clickProceedButton();
    
    // Wait for results and extract bill details
    const billDetails = await this.extractBillDetails();
    
    return billDetails;
  }

  async fillConsumerNumber(consumerNumber) {
    // Look for consumer number input field
    const selectors = [
      'input[name*="consumer"]',
      'input[placeholder*="consumer"]',
      'input[placeholder*="Consumer"]',
      'input[id*="consumer"]',
      'input[class*="consumer"]',
      'input[type="text"]',
      'input[type="number"]'
    ];

    let input = null;
    for (const selector of selectors) {
      input = document.querySelector(selector);
      if (input && input.offsetParent !== null) break;
    }

    if (!input) {
      throw new Error('Consumer number input field not found');
    }

    // Clear and fill the input
    input.focus();
    input.value = '';
    input.value = consumerNumber;
    
    // Trigger input events
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    
    await this.delay(500);
  }

  async clickProceedButton() {
    // Look for proceed/submit button
    const selectors = [
      'button:contains("Proceed")',
      'button:contains("Submit")',
      'button:contains("Get Bill")',
      'button:contains("Fetch")',
      'input[type="submit"]',
      'button[type="submit"]',
      '.btn-primary',
      '.submit-btn'
    ];

    let button = null;
    for (const selector of selectors) {
      if (selector.includes(':contains')) {
        const text = selector.split(':contains("')[1].split('")')[0];
        button = Array.from(document.querySelectorAll('button')).find(btn => 
          btn.textContent.trim().toLowerCase().includes(text.toLowerCase())
        );
      } else {
        button = document.querySelector(selector);
      }
      if (button && button.offsetParent !== null && !button.disabled) break;
    }

    if (!button) {
      throw new Error('Proceed button not found');
    }

    button.click();
    
    // Wait for page to load/update
    await this.delay(3000);
  }

  async extractBillDetails() {
    // Wait for bill details to load
    await this.waitForBillDetails();
    
    const billDetails = {
      lastDate: this.extractLastDate(),
      amount: this.extractAmount(),
      status: this.extractStatus(),
      dueDate: this.extractDueDate(),
      billNumber: this.extractBillNumber()
    };

    return billDetails;
  }

  async waitForBillDetails(maxWait = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      // Check if bill details are loaded
      const indicators = [
        document.querySelector('[class*="bill"]'),
        document.querySelector('[class*="amount"]'),
        document.querySelector('[class*="due"]'),
        document.querySelector('table'),
        document.querySelector('.bill-details'),
        document.querySelector('.payment-details')
      ];

      if (indicators.some(el => el && el.offsetParent !== null)) {
        await this.delay(1000); // Additional wait for content to stabilize
        return;
      }

      await this.delay(500);
    }

    throw new Error('Bill details did not load within timeout');
  }

  extractLastDate() {
    const selectors = [
      '[class*="last-date"]',
      '[class*="due-date"]',
      '[class*="bill-date"]',
      'td:contains("Last Date")',
      'td:contains("Due Date")',
      'span:contains("Last Date")',
      'div:contains("Last Date")'
    ];

    return this.extractTextBySelectors(selectors, 'last date');
  }

  extractAmount() {
    const selectors = [
      '[class*="amount"]',
      '[class*="bill-amount"]',
      '[class*="total"]',
      'td:contains("Amount")',
      'td:contains("Total")',
      'span:contains("₹")',
      'div:contains("₹")'
    ];

    return this.extractTextBySelectors(selectors, 'amount');
  }

  extractStatus() {
    const selectors = [
      '[class*="status"]',
      '[class*="bill-status"]',
      'td:contains("Status")',
      'span:contains("Paid")',
      'span:contains("Unpaid")',
      'span:contains("Overdue")'
    ];

    return this.extractTextBySelectors(selectors, 'status');
  }

  extractDueDate() {
    const selectors = [
      '[class*="due-date"]',
      'td:contains("Due Date")',
      'span:contains("Due Date")',
      'div:contains("Due Date")'
    ];

    return this.extractTextBySelectors(selectors, 'due date');
  }

  extractBillNumber() {
    const selectors = [
      '[class*="bill-number"]',
      '[class*="bill-id"]',
      'td:contains("Bill Number")',
      'td:contains("Bill ID")',
      'span:contains("Bill Number")'
    ];

    return this.extractTextBySelectors(selectors, 'bill number');
  }

  extractTextBySelectors(selectors, fieldName) {
    for (const selector of selectors) {
      try {
        let element;
        
        if (selector.includes(':contains')) {
          const text = selector.split(':contains("')[1].split('")')[0];
          const tagName = selector.split(':contains')[0];
          element = Array.from(document.querySelectorAll(tagName)).find(el => 
            el.textContent.toLowerCase().includes(text.toLowerCase())
          );
        } else {
          element = document.querySelector(selector);
        }

        if (element && element.offsetParent !== null) {
          let text = element.textContent.trim();
          
          // If this is a label, try to find the value in next sibling or parent
          if (text.toLowerCase().includes(fieldName)) {
            const nextSibling = element.nextElementSibling;
            const parent = element.parentElement;
            
            if (nextSibling && nextSibling.textContent.trim()) {
              text = nextSibling.textContent.trim();
            } else if (parent) {
              const parentText = parent.textContent.trim();
              const labelText = element.textContent.trim();
              text = parentText.replace(labelText, '').trim();
            }
          }
          
          if (text && text.length > 0 && !text.toLowerCase().includes(fieldName)) {
            return text;
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    return null;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize the extractor
new PaytmBillExtractor();