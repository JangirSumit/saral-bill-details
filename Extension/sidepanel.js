class BillProcessor {
  constructor() {
    this.consumers = [];
    this.currentIndex = 0;
    this.isProcessing = false;
    this.isPaused = false;
    this.results = [];
    this.init();
  }

  init() {
    this.bindEvents();
    this.checkConnection();
    this.startConnectionMonitoring();
  }

  bindEvents() {
    this.setupTabs();
    this.setupBillSetup();
    document.querySelectorAll('input[name="mode"]').forEach(radio => {
      radio.addEventListener('change', this.handleModeChange.bind(this));
    });
    document.getElementById('fileInput').addEventListener('change', this.handleFileUpload.bind(this));
    document.getElementById('startBtn').addEventListener('click', this.startProcessing.bind(this));
    document.getElementById('pauseBtn').addEventListener('click', this.pauseProcessing.bind(this));
    document.getElementById('stopBtn').addEventListener('click', this.stopProcessing.bind(this));
    document.getElementById('downloadBtn').addEventListener('click', this.downloadResults.bind(this));
    document.getElementById('downloadIconBtn').addEventListener('click', this.downloadResults.bind(this));
  }

  setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      });
    });
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.style.display = 'none';
    });
    document.getElementById(`${tabName}Tab`).style.display = 'block';
  }

  setupBillSetup() {
    // Set default state
    document.getElementById('stateInput').value = 'Maharashtra';
    
    // State dropdown
    document.getElementById('stateInput').addEventListener('click', () => {
      this.toggleDropdown('stateDropdown');
    });
    
    document.getElementById('stateDropdown').addEventListener('click', (e) => {
      if (e.target.tagName === 'LI') {
        document.getElementById('stateInput').value = e.target.dataset.value;
        this.hideDropdown('stateDropdown');
        this.loadElectricityBoards(e.target.dataset.value);
      }
    });
    
    // Board dropdown
    document.getElementById('boardInput').addEventListener('click', () => {
      this.toggleDropdown('boardDropdown');
    });
    
    document.getElementById('boardDropdown').addEventListener('click', (e) => {
      if (e.target.tagName === 'LI') {
        document.getElementById('boardInput').value = e.target.dataset.value;
        this.hideDropdown('boardDropdown');
      }
    });
    
    // Load default boards for Maharashtra
    this.loadElectricityBoards('Maharashtra');
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.field-group')) {
        this.hideDropdown('stateDropdown');
        this.hideDropdown('boardDropdown');
      }
    });
  }

  toggleDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    dropdown.classList.toggle('show');
  }

  hideDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    dropdown.classList.remove('show');
  }

  loadElectricityBoards(state) {
    const boards = {
      'Maharashtra': ['Adani Electricity', 'Brihan Mumbai Electricity (BEST)', 'Mahavitran - Maharastra (MSEDCL)', 'Tata Power - Mumbai', 'Torrent Power, Maharashtra'],
      'Gujarat': ['PGVCL - Paschim Gujarat Vij Company Limited', 'MGVCL - Madhya Gujarat Vij Company Limited', 'UGVCL - Uttar Gujarat Vij Company Limited'],
      'Karnataka': ['BESCOM - Bangalore Electricity Supply Company Ltd', 'MESCOM - Mangalore Electricity Supply Company Ltd', 'HESCOM - Hubli Electricity Supply Company Ltd'],
      'Tamil Nadu': ['TNEB - Tamil Nadu Electricity Board', 'TANGEDCO - Tamil Nadu Generation and Distribution Corporation Limited'],
      'Uttar Pradesh': ['UPPCL - Uttar Pradesh Power Corporation Ltd'],
      'West Bengal': ['WBSEDCL - West Bengal State Electricity Distribution Company Limited'],
      'Rajasthan': ['JVVNL - Jaipur Vidyut Vitran Nigam Ltd', 'AVVNL - Ajmer Vidyut Vitran Nigam Ltd'],
      'Haryana': ['DHBVN - Dakshin Haryana Bijli Vitran Nigam', 'UHBVN - Uttar Haryana Bijli Vitran Nigam'],
      'Punjab': ['PSPCL - Punjab State Power Corporation Limited'],
      'New Delhi': ['BSES Rajdhani Power Limited', 'BSES Yamuna Power Limited', 'Tata Power Delhi Distribution Limited']
    };
    
    const boardList = document.getElementById('boardList');
    boardList.innerHTML = '';
    
    const stateBoards = boards[state] || ['No electricity boards available'];
    stateBoards.forEach(board => {
      const li = document.createElement('li');
      li.dataset.value = board;
      li.textContent = board;
      boardList.appendChild(li);
    });
    
    // Clear board input when state changes
    document.getElementById('boardInput').value = '';
  }

  handleModeChange(event) {
    const mode = event.target.value;
    const singleSection = document.getElementById('singleSection');
    const bulkSection = document.getElementById('bulkSection');
    const consumerSection = document.getElementById('consumerSection');
    
    if (mode === 'single') {
      singleSection.style.display = 'block';
      bulkSection.style.display = 'none';
      consumerSection.style.display = 'none';
      this.consumers = [];
      this.setupSingleMode();
    } else {
      singleSection.style.display = 'none';
      bulkSection.style.display = 'block';
      consumerSection.style.display = 'none';
      this.consumers = [];
    }
    
    document.getElementById('controlSection').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'none';
  }

  setupSingleMode() {
    const consumerInput = document.getElementById('singleConsumerInput');
    
    const updateConsumers = () => {
      const consumerNumber = consumerInput.value.trim();
      if (consumerNumber) {
        this.consumers = [{
          consumerNumber: consumerNumber,
          name: 'Single Consumer'
        }];
        this.displayConsumers();
        document.getElementById('consumerSection').style.display = 'block';
        document.getElementById('controlSection').style.display = 'block';
        this.switchTab('processing');
      } else {
        this.consumers = [];
        document.getElementById('consumerSection').style.display = 'none';
        document.getElementById('controlSection').style.display = 'none';
      }
    };
    
    consumerInput.addEventListener('input', updateConsumers);
  }

  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const status = document.getElementById('fileStatus');
    status.textContent = 'Processing file...';

    try {
      const text = await this.readFile(file);
      this.consumers = this.parseFile(text, file.name);
      this.displayConsumers();
      status.textContent = `Loaded ${this.consumers.length} consumers`;
      document.getElementById('consumerSection').style.display = 'block';
      document.getElementById('controlSection').style.display = 'block';
      this.switchTab('processing');
    } catch (error) {
      status.textContent = 'Error reading file: ' + error.message;
    }
  }

  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  parseFile(text, filename) {
    if (!filename.toLowerCase().endsWith('.csv')) {
      throw new Error('Only CSV files are supported');
    }
    
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) throw new Error('CSV must have header and data rows');
    
    const headers = lines[0].split(',').map(h => h.trim());
    const consumers = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const consumer = {};
      headers.forEach((header, index) => {
        consumer[header] = values[index] || '';
      });
      if (consumer.consumerNumber || consumer.ConsumerNumber || consumer.consumer_number) {
        consumers.push(consumer);
      }
    }
    
    return consumers;
  }

  displayConsumers() {
    const list = document.getElementById('consumerList');
    list.innerHTML = '';
    
    this.consumers.forEach((consumer, index) => {
      const item = document.createElement('div');
      item.className = 'consumer-item';
      item.id = `consumer-${index}`;
      
      const consumerNumber = consumer.consumerNumber || consumer.ConsumerNumber || consumer.consumer_number || 'N/A';
      const name = consumer.name || consumer.Name || consumer.consumer_name || '';
      
      item.innerHTML = `
        <div class="consumer-header">
          <span>${consumerNumber}${name ? ' - ' + name : ''}</span>
          <span class="status-indicator">Pending</span>
        </div>
        <div class="consumer-details" id="details-${index}" style="display: none;"></div>
      `;
      
      list.appendChild(item);
    });
  }

  async startProcessing() {
    if (this.consumers.length === 0) return;
    
    // Check connection before starting
    try {
      await this.pingContentScript();
    } catch (error) {
      document.getElementById('status').textContent = 'Error: Not connected to Paytm. Please refresh the page.';
      return;
    }
    
    this.isProcessing = true;
    this.isPaused = false;
    this.updateButtons();
    this.commonErrorShown = false;
    
    document.getElementById('status').textContent = 'Starting processing...';
    
    for (let i = this.currentIndex; i < this.consumers.length && this.isProcessing; i++) {
      if (this.isPaused) {
        await this.waitForResume();
      }
      
      if (!this.isProcessing) break;
      
      this.currentIndex = i;
      await this.processConsumer(i);
      this.updateProgress();
    }
    
    if (this.isProcessing) {
      this.completeProcessing();
    }
  }

  async processConsumer(index) {
    const consumer = this.consumers[index];
    const item = document.getElementById(`consumer-${index}`);
    
    item.className = 'consumer-item processing';
    item.querySelector('.status-indicator').textContent = 'Processing...';
    
    document.getElementById('status').textContent = `Processing consumer ${index + 1} of ${this.consumers.length}`;
    
    try {
      console.log('Sending message to content script:', consumer);
      // Get setup configuration
      const setup = this.getSetupConfiguration();
      
      // Send message to content script to fill form and get bill details
      const result = await this.sendToContentScript({
        action: 'processBill',
        consumer: consumer,
        setup: setup
      });
      
      console.log('Received result:', result);
      this.results.push({
        consumer: consumer,
        success: true,
        data: result
      });
      
      item.className = 'consumer-item completed';
      item.querySelector('.status-indicator').textContent = 'Completed';
      
      // Show success details inline
      const details = document.getElementById(`details-${index}`);
      details.style.display = 'block';
      details.innerHTML = `
        Name: ${result.name || 'N/A'}<br>
        Due Date: ${result.dueDate || 'N/A'}<br>
        Bill Number: ${result.billNumber || 'N/A'}<br>
        Bill Type: ${result.billType || 'N/A'}
      `;
      
    } catch (error) {
      console.error('Processing error:', error);
      this.results.push({
        consumer: consumer,
        success: false,
        error: error.message
      });
      
      item.className = 'consumer-item error';
      item.querySelector('.status-indicator').textContent = 'Error';
      
      // Show common error only once for field validation errors
      if (error.message.includes('Required fields not available') && !this.commonErrorShown) {
        document.getElementById('status').textContent = error.message;
        this.commonErrorShown = true;
        // Stop processing for this type of error
        this.stopProcessing();
        return;
      }
      
      // Show error details inline for other errors
      const details = document.getElementById(`details-${index}`);
      details.style.display = 'block';
      details.innerHTML = `Error: ${error.message}`;
    }
    
    // Wait between requests
    await this.delay(2000);
  }

  async sendToContentScript(message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
        if (!tabs[0]) {
          reject(new Error('No active tab found'));
          return;
        }
        
        const tab = tabs[0];
        
        // Check if tab is on Paytm
        if (!tab.url || !tab.url.includes('paytm.com')) {
          reject(new Error('Please navigate to Paytm website'));
          return;
        }
        
        try {
          const response = await chrome.tabs.sendMessage(tab.id, message);
          if (response && response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response ? response.error : 'No response from content script'));
          }
        } catch (error) {
          reject(new Error('Content script not responding. Please refresh the Paytm page.'));
        }
      });
    });
  }

  pauseProcessing() {
    this.isPaused = true;
    this.updateButtons();
    document.getElementById('status').textContent = 'Processing paused';
  }

  async waitForResume() {
    while (this.isPaused && this.isProcessing) {
      await this.delay(100);
    }
  }

  stopProcessing() {
    this.isProcessing = false;
    this.isPaused = false;
    this.currentIndex = 0;
    this.updateButtons();
    document.getElementById('status').textContent = 'Processing stopped';
  }

  completeProcessing() {
    this.isProcessing = false;
    this.isPaused = false;
    this.currentIndex = 0;
    this.updateButtons();
    document.getElementById('status').textContent = 'Processing completed';
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('downloadIconBtn').style.display = 'block';
  }

  updateButtons() {
    document.getElementById('startBtn').disabled = this.isProcessing;
    document.getElementById('pauseBtn').disabled = !this.isProcessing || this.isPaused;
    document.getElementById('stopBtn').disabled = !this.isProcessing;
  }

  updateProgress() {
    const progress = ((this.currentIndex + 1) / this.consumers.length) * 100;
    document.getElementById('progressBar').style.width = `${progress}%`;
  }



  downloadResults() {
    const csv = this.resultsToCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `bill_results_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    URL.revokeObjectURL(url);
  }

  resultsToCSV() {
    const headers = ['Consumer Number', 'Name', 'Status', 'Due Date', 'Bill Number', 'Bill Date', 'Bill Period', 'Bill Type', 'Error'];
    const rows = [headers.join(',')];
    
    this.results.forEach(result => {
      const consumer = result.consumer;
      const consumerNumber = consumer.consumerNumber || consumer.ConsumerNumber || consumer.consumer_number || '';
      const name = consumer.name || consumer.Name || consumer.consumer_name || '';
      
      if (result.success) {
        rows.push([
          consumerNumber,
          name,
          'Success',
          result.data.dueDate || '',
          result.data.billNumber || '',
          result.data.billDate || '',
          result.data.billPeriod || '',
          result.data.billType || '',
          ''
        ].join(','));
      } else {
        rows.push([
          consumerNumber,
          name,
          'Error',
          '',
          '',
          '',
          '',
          '',
          result.error
        ].join(','));
      }
    });
    
    return rows.join('\n');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async checkConnection() {
    try {
      await this.pingContentScript();
      this.updateConnectionStatus(true);
    } catch (error) {
      this.updateConnectionStatus(false);
    }
  }

  async pingContentScript() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
        if (!tabs[0]) {
          reject(new Error('No active tab'));
          return;
        }
        
        const tab = tabs[0];
        if (!tab.url || !tab.url.includes('paytm.com')) {
          reject(new Error('Not on Paytm'));
          return;
        }
        
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
          if (response && response.connected) {
            resolve();
          } else {
            reject(new Error('No response'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  updateConnectionStatus(connected) {
    const statusDiv = document.querySelector('.connection-status');
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    
    if (connected) {
      statusDiv.style.display = 'none';
    } else {
      statusDiv.style.display = 'flex';
      dot.className = 'status-dot disconnected';
      text.textContent = 'Disconnected - Please refresh Paytm page';
    }
  }

  startConnectionMonitoring() {
    setInterval(() => {
      this.checkConnection();
    }, 3000);
  }

  getSetupConfiguration() {
    const serviceType = document.querySelector('input[name="serviceType"]:checked')?.value || 'electricity';
    const state = document.getElementById('stateInput')?.value || 'Maharashtra';
    const board = document.getElementById('boardInput')?.value || '';
    
    return {
      serviceType: serviceType,
      state: state,
      board: board
    };
  }
}

// Initialize the processor when the page loads
document.addEventListener('DOMContentLoaded', () => {
  const processor = new BillProcessor();
  processor.setupSingleMode(); // Initialize single mode by default
});