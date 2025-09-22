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
        this.processBill(request.consumer, request.setup)
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

  async processBill(consumer, setup) {
    const consumerNumber = consumer.consumerNumber || consumer.ConsumerNumber || consumer.consumer_number;
    
    if (!consumerNumber) {
      throw new Error('Consumer number not found');
    }

    // Setup form configuration first
    if (setup) {
      await this.setupForm(setup);
    }

    // Validate required fields are available after setup
    await this.validateRequiredFields();

    // Fill consumer number in the form
    await this.fillConsumerNumber(consumerNumber);
    
    // Click proceed button
    await this.clickProceedButton();
    
    // Wait for results and extract bill details
    const billDetails = await this.extractBillDetails();
    
    return billDetails;
  }

  async validateRequiredFields() {
    const missingFields = [];
    
    // Check for Consumer Number field
    const consumerInput = this.findConsumerNumberInput();
    if (!consumerInput) {
      missingFields.push('Consumer Number');
    }
    
    // Check for State field
    const stateInput = Array.from(document.querySelectorAll('input[type="text"]')).find(input => {
      const label = input.parentElement?.querySelector('label');
      return label && label.textContent.trim() === 'State';
    });
    if (!stateInput) {
      missingFields.push('State');
    }
    
    // Check for Electricity Board field
    const boardInput = Array.from(document.querySelectorAll('input[type="text"]')).find(input => {
      const label = input.parentElement?.querySelector('label');
      return label && label.textContent.trim() === 'Electricity Board';
    });
    if (!boardInput) {
      missingFields.push('Electricity Board');
    }
    
    if (missingFields.length > 0) {
      throw new Error(`Required fields not available: ${missingFields.join(', ')}. Please ensure you are on the correct Paytm bill payment page.`);
    }
  }

  findConsumerNumberInput() {
    // Look for consumer number input field, avoiding State and Electricity Board fields
    let input = null;
    
    // Find by label containing "Consumer Number" or similar terms
    const consumerLabels = ['Consumer Number', 'Consumer No', 'Account Number', 'Account No'];
    for (const labelText of consumerLabels) {
      const labels = Array.from(document.querySelectorAll('label')).filter(label => 
        label.textContent.trim().includes(labelText)
      );
      
      for (const label of labels) {
        const parent = label.parentElement;
        if (parent) {
          input = parent.querySelector('input[type="text"]');
          if (input && input.offsetParent !== null) return input;
        }
      }
    }
    
    // Look for input with placeholder containing consumer-related terms
    const textInputs = Array.from(document.querySelectorAll('input[type="text"]'));
    for (const textInput of textInputs) {
      const placeholder = textInput.placeholder?.toLowerCase() || '';
      if ((placeholder.includes('consumer') || placeholder.includes('account')) && 
          textInput.offsetParent !== null) {
        return textInput;
      }
    }
    
    // If not found by label/placeholder, look for input that's NOT State or Electricity Board
    for (const textInput of textInputs) {
      const label = textInput.parentElement?.querySelector('label');
      const labelText = label ? label.textContent.trim() : '';
      
      // Skip State and Electricity Board inputs
      if (labelText !== 'State' && labelText !== 'Electricity Board' && 
          textInput.offsetParent !== null) {
        return textInput;
      }
    }
    
    // Final fallback - look for input with maxlength="50" or similar (common for consumer numbers)
    const maxLengthInputs = document.querySelectorAll('input[maxlength]');
    for (const input of maxLengthInputs) {
      const maxLength = parseInt(input.getAttribute('maxlength'));
      if (maxLength >= 10 && maxLength <= 50 && input.offsetParent !== null) {
        return input;
      }
    }
    
    return null;
  }

  async setupForm(setup) {
    console.log('Setting up form with:', setup);
    
    // 1. Select Electricity Boards radio button
    if (setup.serviceType === 'electricity') {
      await this.selectElectricityBoardsRadio();
    }
    
    // 2. Select state from dropdown
    if (setup.state) {
      await this.selectStateFromDropdown(setup.state);
    }
    
    // 3. Select electricity board from dropdown
    if (setup.board) {
      await this.selectElectricityBoardFromDropdown(setup.board);
    }
    
    // 4. Wait for form to fully load after selections
    await this.delay(2000);
  }

  async selectElectricityBoardsRadio() {
    // Find Electricity Boards radio button
    const electricityRadio = Array.from(document.querySelectorAll('input[type="radio"]')).find(radio => {
      const label = radio.parentElement;
      return label && label.textContent.includes('Electricity Boards');
    });
    
    if (electricityRadio && !electricityRadio.checked) {
      electricityRadio.click();
      await this.delay(1000);
      console.log('Selected Electricity Boards radio');
    } else {
      console.log('Electricity Boards radio already selected');
    }
  }

  async selectStateFromDropdown(stateName) {
    // Clear the state input first and type the state name
    const stateInput = Array.from(document.querySelectorAll('input[type="text"]')).find(input => {
      const label = input.parentElement?.querySelector('label');
      return label && label.textContent.trim() === 'State';
    });
    
    if (stateInput) {
      // Clear and focus the input
      stateInput.focus();
      stateInput.value = '';
      await this.delay(200);
      
      // Type character by character to trigger dropdown
      await this.typeText(stateInput, stateName);
      await this.delay(1000);
      
      // Look for dropdown options
      const stateOption = Array.from(document.querySelectorAll('li')).find(li => 
        li.textContent.trim() === stateName
      );
      
      if (stateOption) {
        stateOption.click();
        await this.delay(1000);
        console.log('Selected state:', stateName);
      } else {
        console.log('State option not found, keeping typed value:', stateName);
      }
    } else {
      console.log('State input not found');
    }
  }

  async selectElectricityBoardFromDropdown(boardName) {
    // Wait for state selection to complete first
    await this.delay(1000);
    
    // Find electricity board input field by label
    const boardInput = Array.from(document.querySelectorAll('input[type="text"]')).find(input => {
      const label = input.parentElement?.querySelector('label');
      return label && label.textContent.trim() === 'Electricity Board';
    });
    
    if (boardInput && boardName) {
      // Focus and clear the input
      boardInput.focus();
      boardInput.click();
      boardInput.value = '';
      await this.delay(200);
      
      // Type character by character to trigger dropdown
      await this.typeText(boardInput, boardName);
      await this.delay(1000);
      
      // Look for dropdown options
      const boardOption = Array.from(document.querySelectorAll('li')).find(li => 
        li.textContent.trim() === boardName
      );
      
      if (boardOption) {
        boardOption.focus();
        await this.delay(100);
        boardOption.click();
        await this.delay(1000);
        console.log('Selected electricity board:', boardName);
      } else {
        console.log('Electricity board option not found, keeping typed value:', boardName);
      }
    } else {
      console.log('Electricity board input not found or no board name provided');
    }
  }

  async typeText(input, text) {
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      input.value += char;
      
      // Trigger input events for each character
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
      
      await this.delay(50); // Small delay between characters
    }
  }

  async fillConsumerNumber(consumerNumber) {
    const input = this.findConsumerNumberInput();

    if (!input) {
      throw new Error('Consumer number input field not found');
    }

    console.log('Found consumer number input:', input);
    
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