class PaytmBillExtractor {
  constructor() {
    this.init();
  }

  init() {
    console.log("PaytmBillExtractor initialized");
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      //console.log("Message received:", request);

      if (request.action === "ping") {
        sendResponse({ success: true, connected: true });
        return;
      }

      if (request.action === "processBill") {
        this.processBill(request.consumer, request.setup)
          .then((data) => {
            console.log("Bill processing successful:", data);
            sendResponse({ success: true, data });
          })
          .catch((error) => {
            console.error("Bill processing failed:", error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // Keep message channel open for async response
      }
    });
  }

  async processBill(consumer, setup) {
    const consumerNumber =
      consumer.consumerNumber ||
      consumer.ConsumerNumber ||
      consumer.consumer_number;

    if (!consumerNumber) {
      throw new Error("Consumer number not found");
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
      missingFields.push("Consumer Number");
    }

    // Check for State field
    const stateInput = Array.from(
      document.querySelectorAll('input[type="text"]')
    ).find((input) => {
      const label = input.parentElement?.querySelector("label");
      return label && label.textContent.trim() === "State";
    });
    if (!stateInput) {
      missingFields.push("State");
    }

    // Check for Electricity Board field
    const boardInput = Array.from(
      document.querySelectorAll('input[type="text"]')
    ).find((input) => {
      const label = input.parentElement?.querySelector("label");
      return label && label.textContent.trim() === "Electricity Board";
    });
    if (!boardInput) {
      missingFields.push("Electricity Board");
    }

    // Check for District/Type field (optional - only for certain states)
    const districtInput = Array.from(
      document.querySelectorAll('input[type="text"]')
    ).find((input) => {
      const label = input.parentElement?.querySelector("label");
      return label && label.textContent.trim() === "District/Type";
    });
    // Note: District/Type is optional, so we don't add it to missing fields

    if (missingFields.length > 0) {
      throw new Error(
        `Required fields not available: ${missingFields.join(
          ", "
        )}. Please ensure you are on the correct Paytm bill payment page.`
      );
    }
  }

  findConsumerNumberInput() {
    // Look for consumer number input field, avoiding State and Electricity Board fields
    let input = null;

    // Find by label containing "Consumer Number" or similar terms
    const consumerLabels = [
      "Consumer Number",
      "Consumer No",
      "Account Number",
      "Account No",
      "Consumer ID"
    ];
    for (const labelText of consumerLabels) {
      const labels = Array.from(document.querySelectorAll("label")).filter(
        (label) => label.textContent.trim().includes(labelText)
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
    const textInputs = Array.from(
      document.querySelectorAll('input[type="text"]')
    );
    for (const textInput of textInputs) {
      const placeholder = textInput.placeholder?.toLowerCase() || "";
      if (
        (placeholder.includes("consumer") || placeholder.includes("account")) &&
        textInput.offsetParent !== null
      ) {
        return textInput;
      }
    }

    // If not found by label/placeholder, look for input that's NOT State or Electricity Board
    for (const textInput of textInputs) {
      const label = textInput.parentElement?.querySelector("label");
      const labelText = label ? label.textContent.trim() : "";

      // Skip State and Electricity Board inputs
      if (
        labelText !== "State" &&
        labelText !== "Electricity Board" &&
        textInput.offsetParent !== null
      ) {
        return textInput;
      }
    }

    // Final fallback - look for input with maxlength="50" or similar (common for consumer numbers)
    const maxLengthInputs = document.querySelectorAll("input[maxlength]");
    for (const input of maxLengthInputs) {
      const maxLength = parseInt(input.getAttribute("maxlength"));
      if (maxLength >= 10 && maxLength <= 50 && input.offsetParent !== null) {
        return input;
      }
    }

    return null;
  }

  

  async setupForm(setup) {
    console.log("Setting up form with:", setup);

    // 1. Select Electricity Boards radio button
    if (setup.serviceType === "electricity") {
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

    // 4. Select district/type if provided
    if (setup.district) {
      await this.selectDistrictFromDropdown(setup.district);
    }

    // 5. Wait for form to fully load after selections
    await this.delay(2000);
  }

  async selectElectricityBoardsRadio() {
    // Find Electricity Boards radio button
    const electricityRadio = Array.from(
      document.querySelectorAll('input[type="radio"]')
    ).find((radio) => {
      const label = radio.parentElement;
      return label && label.textContent.includes("Electricity Boards");
    });

    if (electricityRadio && !electricityRadio.checked) {
      electricityRadio.click();
      await this.delay(1000);
      console.log("Selected Electricity Boards radio");
    } else {
      console.log("Electricity Boards radio already selected");
    }
  }

  async selectStateFromDropdown(stateName) {
    const stateInput = Array.from(
      document.querySelectorAll('input[type="text"]')
    ).find((input) => {
      const label = input.parentElement?.querySelector("label");
      return label && label.textContent.trim() === "State";
    });

    if (stateInput) {
      stateInput.focus();
      stateInput.click();
      // Clear the field completely
      stateInput.value = "";
      stateInput.dispatchEvent(new Event("input", { bubbles: true }));
      await this.delay(200);

      await this.typeText(stateInput, stateName);
      await this.delay(1000);

      const stateOption = Array.from(document.querySelectorAll("li")).find(
        (li) => li.textContent.trim() === stateName
      );

      if (stateOption) {
        stateOption.click();
        await this.delay(1000);
        console.log("Selected state:", stateName);
      } else {
        console.log("State option not found, keeping typed value:", stateName);
      }
    } else {
      console.log("State input not found");
    }
  }

  extractBoardNameToType(boardName) {
    if (boardName === "CESC Kolkata, West Bengal") {
      return "CESC";
    }
    return boardName.includes("-") ? boardName.split("-")[0].trim() : boardName;
  }

  async selectElectricityBoardFromDropdown(boardName) {
    await this.delay(1000);

    const boardInput = Array.from(
      document.querySelectorAll('input[type="text"]')
    ).find((input) => {
      const label = input.parentElement?.querySelector("label");
      return label && label.textContent.trim() === "Electricity Board";
    });

    if (boardInput && boardName) {
      boardInput.focus();
      boardInput.click();
      boardInput.value = "";
      await this.delay(200);

      // Type only the part before "-" if present
      const textToType = this.extractBoardNameToType(boardName);

      await this.typeText(boardInput, textToType);
      await this.delay(1000);

      const boardOption = Array.from(boardInput.parentElement.querySelectorAll("li")).find(
        (li) => li.textContent.includes(boardName)
      );

      if (boardOption) {
        console.log('Found board option:', boardOption);
        try {
          const selector = this.getElementSelector(boardOption);
          console.log('Generated selector:', selector);
          await this.sendTrustedClick(selector);
          console.log("Selected electricity board:", boardName);
        } catch (error) {
          console.log(
            "Trusted click failed, using regular click:",
            error.message
          );
          boardOption.click();
        }
        await this.delay(1000);
      } else {
        console.log(
          "Electricity board option not found, keeping typed value:",
          boardName
        );
      }
    } else {
      console.log(
        "Electricity board input not found or no board name provided"
      );
    }
  }

  async selectDistrictFromDropdown(districtName) {
    await this.delay(1000);

    const districtInput = Array.from(
      document.querySelectorAll('input[type="text"]')
    ).find((input) => {
      const label = input.parentElement?.querySelector("label");
      return label && label.textContent.trim() === "District/Type";
    });

    if (districtInput && districtName) {
      console.log('Found district input, clicking to open dropdown');
      districtInput.focus();
      districtInput.click();
      await this.delay(1000);

      // Look for district option in spans within the district dropdown area
      // Find the dropdown container first
      const dropdownContainer = districtInput.closest('li') || districtInput.parentElement;
      const districtSpans = dropdownContainer ? 
        Array.from(dropdownContainer.querySelectorAll('span')) :
        Array.from(document.querySelectorAll('span'));
      
      const districtOption = districtSpans.find(
        (span) => span.textContent.trim() === districtName
      );

      if (districtOption) {
        console.log('Found district option:', districtOption, 'Text:', districtOption.textContent);
        try {
          // Use regular click first as it's more reliable for span elements
          districtOption.click();
          console.log("Selected district:", districtName);
        } catch (error) {
          console.log("Regular click failed, trying trusted click:", error.message);
          try {
            const selector = this.getElementSelector(districtOption);
            await this.sendTrustedClick(selector);
          } catch (trustedError) {
            console.log("Trusted click also failed:", trustedError.message);
          }
        }
        await this.delay(1000);
      } else {
        console.log("District option not found:", districtName);
        console.log('Available district options:', districtSpans.map(s => s.textContent.trim()));
      }
    } else {
      console.log("District input not found or no district name provided");
    }
  }

  async typeText(input, text) {
    const selector = this.getElementSelector(input);
    console.log('Generated selector for input:', selector, 'Element:', input);
    try {
      await this.typeWithTrustedEvents(selector, text);
    } catch (error) {
      console.log('Trusted typing failed, using fallback:', error.message);
      input.focus();
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  async fillConsumerNumber(consumerNumber) {
    const input = this.findConsumerNumberInput();

    if (!input) {
      throw new Error("Consumer number input field not found");
    }

    console.log("Found consumer number input:", input);

    // Clear and fill the input
    input.focus();
    input.value = "";
    input.value = consumerNumber;

    // Trigger input events
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    await this.delay(500);
  }

  async clickProceedButton() {
    // Look for buttons by text content only
    const buttonTexts = ["Proceed", "Submit", "Get Bill", "Fetch", "Continue"];

    let button = null;
    for (const text of buttonTexts) {
      button = Array.from(document.querySelectorAll("button")).find(
        (btn) => btn.textContent.trim() === text
      );
      if (button && button.offsetParent !== null && !button.disabled) break;
    }

    // Fallback to generic submit inputs
    if (!button) {
      button = document.querySelector('input[type="submit"]');
    }

    if (!button) {
      throw new Error("Proceed button not found");
    }

    button.click();

    // Wait for page to load/update
    await this.delay(3000);
  }

  async extractBillDetails() {
    // Wait for bill details to load
    await this.waitForBillDetails();

    const billDetails = {
      name: this.extractFieldValue("Consumer Name") || this.extractFieldValue("Name"),
      dueDate: this.extractFieldValue("Due Date"),
      billAmount: this.extractAmountFromTextbox(),
      billNumber: this.extractFieldValue("Bill Number"),
      billDate: this.extractFieldValue("Bill Date"),
      billPeriod: this.extractFieldValue("Bill Period"),
      earlyPaymentDate: this.extractFieldValue("Early Payment Date"),
      billType: this.extractFieldValue("Bill Type"),
      billMonth: this.extractFieldValue("Bill Month"),
    };

    return billDetails;
  }

  async waitForBillDetails(maxWait = 10000) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      // Check if Consumer Details section is loaded
      const consumerDetails = Array.from(document.querySelectorAll("div")).find(
        (el) => el.textContent.includes("Consumer Details")
      );

      if (consumerDetails) {
        await this.delay(1000);
        return;
      }

      await this.delay(500);
    }

    throw new Error("Bill details did not load within timeout");
  }

  extractFieldValue(fieldName) {
    const labelDivs = Array.from(document.querySelectorAll("div")).filter(
      (div) => div.textContent.trim() === fieldName
    );

    for (const labelDiv of labelDivs) {
      // Look for the value in the next sibling div
      const nextSibling = labelDiv.nextElementSibling;
      if (nextSibling && nextSibling.textContent.trim() && nextSibling.textContent.trim() !== fieldName) {
        return nextSibling.textContent.trim();
      }

      // Look within the same parent container for paired divs
      const parent = labelDiv.parentElement;
      if (parent) {
        const allDivs = Array.from(parent.querySelectorAll("div"));
        const labelIndex = allDivs.indexOf(labelDiv);
        if (labelIndex >= 0 && labelIndex + 1 < allDivs.length) {
          const valueDiv = allDivs[labelIndex + 1];
          if (valueDiv && valueDiv.textContent.trim() && valueDiv.textContent.trim() !== fieldName) {
            return valueDiv.textContent.trim();
          }
        }
      }

      // Look for the value in parent's next sibling
      const parentNext = labelDiv.parentElement?.nextElementSibling;
      if (parentNext && parentNext.textContent.trim() && parentNext.textContent.trim() !== fieldName) {
        return parentNext.textContent.trim();
      }
    }

    return null;
  }

  async typeWithTrustedEvents(selector, text) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: "typeWithKeyboardEvents",
          selector: selector,
          text: text,
        },
        (response) => {
          if (response && response.success) {
            resolve();
          } else {
            reject(new Error(response?.error || "Trusted typing failed"));
          }
        }
      );
    });
  }

  async sendTrustedClick(selector) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: "sendTrustedClick",
          selector: selector,
        },
        (response) => {
          if (response && response.success) {
            resolve();
          } else {
            reject(new Error(response?.error || "Trusted click failed"));
          }
        }
      );
    });
  }

  async sendTrustedEvent(eventData) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: "sendTrustedEvent",
          eventData: eventData,
        },
        (response) => {
          if (response && response.success) {
            resolve();
          } else {
            reject(new Error(response?.error || "Trusted event failed"));
          }
        }
      );
    });
  }

  getElementSelector(element) {
    if (element.id) return `#${element.id}`;
    
    // For input elements, use attribute-based selectors
    if (element.tagName.toLowerCase() === 'input') {
      if (element.type) {
        return `input[type="${element.type}"]`;
      }
    }
    
    // Use textContent for li elements only
    const text = element.textContent?.trim();
    if (text && element.tagName.toLowerCase() === 'li') {
      return `li:contains('${text.replace(/'/g, "\\'")}')`;
    }
    
    // Fallback to class-based selector
    if (element.className) {
      const firstClass = element.className.split(" ")[0];
      if (firstClass) return `.${firstClass}`;
    }

    // Final fallback to nth-child selector
    const parent = element.parentElement;
    if (parent) {
      const index = Array.from(parent.children).indexOf(element) + 1;
      return `${element.tagName.toLowerCase()}:nth-child(${index})`;
    }

    return element.tagName.toLowerCase();
  }

  extractAmountFromTextbox() {
    // Look for div containing "Amount (Rs.)" text and extract span value
    const allDivs = Array.from(document.querySelectorAll("div"));
    
    for (const div of allDivs) {
      if (div.textContent && div.textContent.includes("Amount (Rs.)")) {
        const span = div.querySelector("span");
        if (span && span.textContent.trim()) {
          return span.textContent.trim();
        }
      }
    }
    
    // Fallback to original method - look for Amount input textbox
    const consumerDetailsDiv = Array.from(document.querySelectorAll("div")).find(
      (el) => el.textContent.includes("Consumer Details")
    );
    
    if (consumerDetailsDiv) {
      const amountInput = Array.from(document.querySelectorAll('input[type="text"]')).find((input) => {
        const label = input.parentElement?.querySelector("label");
        return label && label.textContent.trim().includes("Amount");
      });
      
      if (amountInput && amountInput.value) {
        return amountInput.value.trim();
      }
    }
    
    return null;
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Initialize the extractor
new PaytmBillExtractor();
