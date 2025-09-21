class PaytmBillExtractor {
  constructor() {
    this.init();
  }

  init() {
    console.log('PaytmBillExtractor initialized');
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Message received:', request);
      
      if (request.action === 'ping') {
        sendResponse({ success: true, connected: true });
        return;
      }
      
      if (request.action === 'processBill') {
        this.processBill(request.consumer)
          .then(data => {
            console.log('Bill processing successful:', data);
            sendResponse({ success: true, data });
          })
          .catch(error => {
            console.error('Bill processing failed:', error);
            sendResponse({ success: false, error: error.message });
          });
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
    // Look for consumer number input field using label text
    let input = null;
    
    // Find by label containing "Consumer Number"
    const labels = Array.from(document.querySelectorAll('label')).filter(label => 
      label.textContent.trim().includes('Consumer Number')
    );
    
    for (const label of labels) {
      // Look for input in the same parent container
      const parent = label.parentElement;
      if (parent) {
        input = parent.querySelector('input[type="text"]');
        if (input && input.offsetParent !== null) break;
      }
    }
    
    // Fallback to generic selectors
    if (!input) {
      const selectors = [
        'input[maxlength="50"]',
        'input[type="text"][required]',
        'input[type="text"]'
      ];
      
      for (const selector of selectors) {
        input = document.querySelector(selector);
        if (input && input.offsetParent !== null) break;
      }
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
    // Look for buttons by text content only
    const buttonTexts = ['Proceed', 'Submit', 'Get Bill', 'Fetch', 'Continue'];
    
    let button = null;
    for (const text of buttonTexts) {
      button = Array.from(document.querySelectorAll('button')).find(btn => 
        btn.textContent.trim() === text
      );
      if (button && button.offsetParent !== null && !button.disabled) break;
    }
    
    // Fallback to generic submit inputs
    if (!button) {
      button = document.querySelector('input[type="submit"]');
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
      name: this.extractFieldValue('Name'),
      dueDate: this.extractFieldValue('Due Date'),
      billNumber: this.extractFieldValue('Bill Number'),
      billDate: this.extractFieldValue('Bill Date'),
      billPeriod: this.extractFieldValue('Bill Period'),
      earlyPaymentDate: this.extractFieldValue('Early Payment Date'),
      billType: this.extractFieldValue('Bill Type'),
      billMonth: this.extractFieldValue('Bill Month')
    };

    return billDetails;
  }

  async waitForBillDetails(maxWait = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      // Check if Consumer Details section is loaded
      const consumerDetails = Array.from(document.querySelectorAll('div')).find(el => 
        el.textContent.includes('Consumer Details')
      );

      if (consumerDetails) {
        await this.delay(1000);
        return;
      }

      await this.delay(500);
    }

    throw new Error('Bill details did not load within timeout');
  }

  extractFieldValue(fieldName) {
    // Find all divs that contain the field name
    const labelDivs = Array.from(document.querySelectorAll('div')).filter(div => 
      div.textContent.trim() === fieldName
    );

    for (const labelDiv of labelDivs) {
      // Look for the value in the next sibling div
      const nextSibling = labelDiv.nextElementSibling;
      if (nextSibling && nextSibling.textContent.trim()) {
        return nextSibling.textContent.trim();
      }

      // Look for the value in parent's next sibling
      const parentNext = labelDiv.parentElement?.nextElementSibling;
      if (parentNext && parentNext.textContent.trim()) {
        return parentNext.textContent.trim();
      }

      // Look within the same parent container
      const parent = labelDiv.parentElement;
      if (parent) {
        const allDivs = parent.querySelectorAll('div');
        const labelIndex = Array.from(allDivs).indexOf(labelDiv);
        if (labelIndex >= 0 && labelIndex + 1 < allDivs.length) {
          const valueDiv = allDivs[labelIndex + 1];
          if (valueDiv && valueDiv.textContent.trim() !== fieldName) {
            return valueDiv.textContent.trim();
          }
        }
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