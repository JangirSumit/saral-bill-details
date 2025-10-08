class BillProcessor {
  constructor() {
    this.consumers = [];
    this.currentIndex = 0;
    this.isProcessing = false;
    this.isPaused = false;
    this.results = [];
    this.startTime = null;
    this.timerInterval = null;
    this.successCount = 0;
    this.failedCount = 0;
    this.init();
  }

  init() {
    this.bindEvents();
    this.checkConnection();
    this.startConnectionMonitoring();
    this.loadBoardsReference();
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
    document.getElementById('refreshBtn').addEventListener('click', this.refreshAll.bind(this));
    if (document.getElementById('goToHelpBtn')) {
      document.getElementById('goToHelpBtn').addEventListener('click', () => this.switchTab('help'));
    }
    document.getElementById('downloadSampleBtn').addEventListener('click', this.downloadSampleCSV.bind(this));
    document.getElementById('goToHelpBtn').addEventListener('click', () => this.switchTab('help'));
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
        this.loadDistricts(document.getElementById('stateInput').value, e.target.dataset.value);
      }
    });
    
    // District dropdown
    document.getElementById('districtInput').addEventListener('click', () => {
      this.toggleDropdown('districtDropdown');
    });
    
    document.getElementById('districtDropdown').addEventListener('click', (e) => {
      if (e.target.tagName === 'LI') {
        document.getElementById('districtInput').value = e.target.dataset.value;
        this.hideDropdown('districtDropdown');
      }
    });
    
    // Load default boards for Maharashtra
    this.loadElectricityBoards('Maharashtra');
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.field-group')) {
        this.hideDropdown('stateDropdown');
        this.hideDropdown('boardDropdown');
        this.hideDropdown('districtDropdown');
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

  async loadElectricityBoards(state) {
    try {
      // Try to get boards from storage first
      const result = await chrome.storage.local.get(['electricityBoards']);
      let boards = result.electricityBoards;
      
      // If not in storage, load from JSON file
      if (!boards) {
        const response = await fetch(chrome.runtime.getURL('boards.json'));
        boards = await response.json();
        // Save to storage for future use
        await chrome.storage.local.set({ electricityBoards: boards });
      }
      
      const boardList = document.getElementById('boardList');
      boardList.innerHTML = '';
      
      const stateBoards = boards[state] || [];
      if (stateBoards.length === 0) {
        boardList.innerHTML = '<li>No electricity boards available</li>';
        return;
      }
      stateBoards.forEach(board => {
        const li = document.createElement('li');
        li.dataset.value = board;
        li.textContent = board;
        boardList.appendChild(li);
      });
      
      // Clear board input when state changes
      document.getElementById('boardInput').value = '';
      document.getElementById('districtGroup').style.display = 'none';
      document.getElementById('districtInput').value = '';
    } catch (error) {
      console.error('Error loading electricity boards:', error);
      const boardList = document.getElementById('boardList');
      boardList.innerHTML = '<li>Error loading boards</li>';
    }
  }

  async loadDistricts(state, board) {
    try {
      // Force refresh from JSON file to get latest districts
      const response = await fetch(chrome.runtime.getURL('boards.json'));
      const boards = await response.json();
      // Update storage with latest data
      await chrome.storage.local.set({ electricityBoards: boards });
      
      console.log('Loading districts for:', state, board);
      console.log('Available districts:', boards.districts?.[state]?.[board]);
      
      const districts = boards.districts?.[state]?.[board];
      const districtGroup = document.getElementById('districtGroup');
      const districtList = document.getElementById('districtList');
      
      if (districts && districts.length > 0) {
        console.log('Showing district dropdown with', districts.length, 'districts');
        districtGroup.style.display = 'block';
        districtList.innerHTML = '';
        
        districts.forEach(district => {
          const li = document.createElement('li');
          li.dataset.value = district;
          li.textContent = district;
          districtList.appendChild(li);
        });
      } else {
        console.log('No districts found, hiding dropdown');
        districtGroup.style.display = 'none';
        document.getElementById('districtInput').value = '';
      }
    } catch (error) {
      console.error('Error loading districts:', error);
    }
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
        const setup = this.getSetupConfiguration();
        this.consumers = [{
          consumerNumber: consumerNumber,
          name: 'Single Consumer',
          state: setup.state,
          board: setup.board,
          district: setup.district || ''
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
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const consumers = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const consumer = {};
      headers.forEach((header, index) => {
        consumer[header] = values[index] || '';
      });
      
      // Normalize consumer number field
      const consumerNumber = consumer.consumernumber || consumer.consumer_number || consumer['consumer number'];
      if (consumerNumber) {
        consumer.consumerNumber = consumerNumber;
        consumer.name = consumer.name || consumer.consumer_name || consumer['consumer name'] || '';
        consumer.state = consumer.state || '';
        consumer.board = consumer.board || consumer.electricityboard || consumer['electricity board'] || '';
        consumer.district = consumer.district || consumer.districttype || consumer['district type'] || consumer.type || '';
        consumer.reference = consumer.reference || consumer.referencenumber || consumer['reference number'] || consumer.ref || '';
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
      
      const consumerNumber = consumer.consumerNumber || 'N/A';
      const name = consumer.name || '';
      const state = consumer.state || '';
      const board = consumer.board || '';
      const district = consumer.district || '';
      const reference = consumer.reference || '';
      
      let headerText = consumerNumber;
      if (reference) headerText += ` • ${reference}`;
      
      let subText = [];
      if (name) subText.push(name);
      if (state) subText.push(state);
      if (board) subText.push(board);
      if (district) subText.push(district);
      
      item.innerHTML = `
        <div class="consumer-header">
          <div class="consumer-main">
            <div class="consumer-title">${headerText}</div>
            ${subText.length > 0 ? `<div class="consumer-subtitle">${subText.join(' • ')}</div>` : ''}
          </div>
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
    this.successCount = 0;
    this.failedCount = 0;
    this.updateButtons();
    this.commonErrorShown = false;
    this.startTimer();
    this.updateStats();
    
    document.getElementById('status').textContent = 'Starting processing...';
    
    for (let i = this.currentIndex; i < this.consumers.length && this.isProcessing; i++) {
      if (this.isPaused) {
        await this.waitForResume();
      }
      
      if (!this.isProcessing) break;
      
      this.currentIndex = i;
      await this.processConsumer(i);
      this.updateProgress();
      this.updateStats();
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
      // Get setup configuration with consumer-specific overrides
      const setup = this.getSetupConfiguration();
      if (consumer.state) setup.state = consumer.state;
      if (consumer.board) {
        // Strip parenthetical abbreviations from board name
        setup.board = consumer.board.replace(/\s*\([^)]*\)\s*$/, '').trim();
      }
      
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
      
      this.successCount++;
      item.className = 'consumer-item completed';
      item.querySelector('.status-indicator').textContent = 'Completed';
      
      // Show success details inline
      const details = document.getElementById(`details-${index}`);
      details.style.display = 'block';
      details.innerHTML = `
        Name: ${result.name || 'N/A'}<br>
        Due Date: ${result.dueDate || 'N/A'}<br>
        Bill Amount: ${result.billAmount || 'N/A'}<br>
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
      
      this.failedCount++;
      item.className = 'consumer-item error';
      item.querySelector('.status-indicator').textContent = 'Error';
      
      // Show common error only once for field validation errors but continue processing
      if (error.message.includes('Required fields not available') && !this.commonErrorShown) {
        document.getElementById('status').textContent = error.message + ' - Continuing with other records';
        this.commonErrorShown = true;
      }
      
      // Show error details inline for other errors
      const details = document.getElementById(`details-${index}`);
      details.style.display = 'block';
      details.innerHTML = `Error: ${error.message}`;
    }
    
    // Wait between requests with random delay to look natural
    const randomDelay = 1000 + Math.floor(Math.random() * 4000); // 1-5 seconds
    await this.delay(randomDelay);
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
    this.stopTimer();
    this.updateButtons();
    document.getElementById('status').textContent = 'Processing stopped';
  }

  completeProcessing() {
    this.isProcessing = false;
    this.isPaused = false;
    this.currentIndex = 0;
    const finalTime = this.getFinalTime();
    this.stopTimer();
    this.updateButtons();
    document.getElementById('status').textContent = `Processing completed in ${finalTime}`;
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

  downloadSampleCSV() {
    const sampleData = [
      'reference,consumerNumber,name,state,board,district',
      'REF001,1234567890,John Doe,Maharashtra,Mahavitran - Maharastra (MSEDCL),',
      'REF002,0987654321,Jane Smith,Gujarat,Uttar Gujarat Vij (UGVCL),',
      'REF003,1122334455,Sample User,Uttar Pradesh,Uttar Pradesh Power (UPPCL),Agra - DVVNL'
    ].join('\n');
    
    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_consumers.csv';
    a.click();
    
    URL.revokeObjectURL(url);
  }

  resultsToCSV() {
    const headers = ['Consumer Number', 'Consumer Name', 'Reference', 'State', 'Board', 'District/Type', 'Bill Holder Name', 'Due Date', 'Bill Amount', 'Bill Number', 'Bill Date', 'Bill Period', 'Early Payment Date', 'Bill Type', 'Bill Month', 'Error', 'Status'];
    const rows = [headers.join(',')];
    
    this.results.forEach(result => {
      const consumer = result.consumer;
      const consumerNumber = consumer.consumerNumber || '';
      const consumerName = consumer.name || '';
      const reference = consumer.reference || '';
      const state = consumer.state || '';
      const board = consumer.board || '';
      const district = consumer.district || '';
      
      if (result.success) {
        rows.push([
          `="${consumerNumber}"`,
          consumerName,
          reference,
          state,
          board,
          district,
          result.data.name || '',
          result.data.dueDate || '',
          result.data.billAmount || '',
          result.data.billNumber || '',
          result.data.billDate || '',
          result.data.billPeriod || '',
          result.data.earlyPaymentDate || '',
          result.data.billType || '',
          result.data.billMonth || '',
          '',
          'Success'
        ].join(','));
      } else {
        rows.push([
          `="${consumerNumber}"`,
          consumerName,
          reference,
          state,
          board,
          district,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          result.error,
          'Error'
        ].join(','));
      }
    });
    
    return rows.join('\n');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getRandomDelay(min = 1000, max = 5000) {
    return min + Math.floor(Math.random() * (max - min));
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

  refreshAll() {
    this.consumers = [];
    this.currentIndex = 0;
    this.isProcessing = false;
    this.isPaused = false;
    this.results = [];
    this.successCount = 0;
    this.failedCount = 0;
    
    document.getElementById('consumerList').innerHTML = '';
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('status').textContent = '';
    document.getElementById('fileStatus').textContent = '';
    document.getElementById('singleConsumerInput').value = '';
    document.getElementById('fileInput').value = '';
    document.getElementById('statsDisplay').style.display = 'none';
    
    document.getElementById('consumerSection').style.display = 'none';
    document.getElementById('controlSection').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('downloadIconBtn').style.display = 'none';
    
    this.updateButtons();
    this.switchTab('setup');
  }

  startTimer() {
    this.startTime = Date.now();
    document.getElementById('timerDisplay').style.display = 'block';
    this.timerInterval = setInterval(() => {
      this.updateTimer();
    }, 1000);
  }

  updateTimer() {
    if (this.startTime) {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      document.getElementById('timerText').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  getFinalTime() {
    if (this.startTime) {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return '00:00';
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    document.getElementById('timerDisplay').style.display = 'none';
  }

  updateStats() {
    const total = this.consumers.length;
    const processed = this.successCount + this.failedCount;
    const remaining = total - processed;
    
    document.getElementById('totalCount').textContent = total;
    document.getElementById('remainingCount').textContent = Math.max(0, remaining);
    document.getElementById('successCount').textContent = this.successCount;
    document.getElementById('failedCount').textContent = this.failedCount;
    document.getElementById('statsDisplay').style.display = total > 0 ? 'block' : 'none';
  }

  getSetupConfiguration() {
    const serviceType = document.querySelector('input[name="serviceType"]:checked')?.value || 'electricity';
    const state = document.getElementById('stateInput')?.value || 'Maharashtra';
    let board = document.getElementById('boardInput')?.value || '';
    const district = document.getElementById('districtInput')?.value || '';
    
    // Strip parenthetical abbreviations from board name
    if (board) {
      board = board.replace(/\s*\([^)]*\)\s*$/, '').trim();
    }
    
    return {
      serviceType: serviceType,
      state: state,
      board: board,
      district: district
    };
  }

  async loadBoardsReference() {
    try {
      const result = await chrome.storage.local.get(['electricityBoards']);
      let boards = result.electricityBoards;
      
      if (!boards) {
        const response = await fetch(chrome.runtime.getURL('boards.json'));
        boards = await response.json();
      }
      
      const container = document.getElementById('boardsReference');
      container.innerHTML = '';
      
      // Filter out 'districts' key and only show state boards
      Object.keys(boards).filter(key => key !== 'districts').forEach(state => {
        const stateDiv = document.createElement('div');
        stateDiv.className = 'state-section';
        
        const header = document.createElement('div');
        header.className = 'state-header';
        
        const stateName = document.createElement('span');
        stateName.textContent = state;
        stateName.style.cursor = 'pointer';
        stateName.style.flex = '1';
        stateName.onclick = () => {
          const boardsDiv = stateDiv.querySelector('.state-boards');
          boardsDiv.classList.toggle('show');
        };
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.textContent = 'Copy';
        copyBtn.onclick = (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(state);
          copyBtn.textContent = 'Copied!';
          setTimeout(() => copyBtn.textContent = 'Copy', 1000);
        };
        
        header.appendChild(stateName);
        header.appendChild(copyBtn);
        
        const boardsDiv = document.createElement('div');
        boardsDiv.className = 'state-boards';
        
        boards[state].forEach(board => {
          const boardItem = document.createElement('div');
          boardItem.className = 'board-item';
          
          const boardName = document.createElement('span');
          boardName.textContent = board;
          
          const boardCopyBtn = document.createElement('button');
          boardCopyBtn.className = 'board-copy-btn';
          boardCopyBtn.textContent = 'Copy';
          boardCopyBtn.onclick = () => {
            navigator.clipboard.writeText(board);
            boardCopyBtn.textContent = 'Copied!';
            setTimeout(() => boardCopyBtn.textContent = 'Copy', 1000);
          };
          
          boardItem.appendChild(boardName);
          boardItem.appendChild(boardCopyBtn);
          
          // Add districts for UPPCL
          if (state === 'Uttar Pradesh' && board === 'Uttar Pradesh Power (UPPCL)') {
            const districts = boards.districts?.[state]?.[board];
            if (districts && districts.length > 0) {
              const districtsContainer = document.createElement('div');
              districtsContainer.className = 'districts-container';
              districtsContainer.style.marginTop = '8px';
              
              const districtsHeader = document.createElement('div');
              districtsHeader.style.fontSize = '12px';
              districtsHeader.style.fontWeight = 'bold';
              districtsHeader.style.marginBottom = '4px';
              districtsHeader.textContent = `Districts (${districts.length}):`;
              
              const districtsList = document.createElement('div');
              districtsList.className = 'districts-grid';
              districtsList.style.display = 'grid';
              districtsList.style.gridTemplateColumns = '1fr auto';
              districtsList.style.gap = '2px';
              districtsList.style.fontSize = '11px';
              districtsList.style.maxHeight = '120px';
              districtsList.style.overflowY = 'auto';
              
              districts.forEach(district => {
                const districtItem = document.createElement('div');
                districtItem.style.display = 'contents';
                
                const districtName = document.createElement('span');
                districtName.textContent = district;
                districtName.style.padding = '2px 4px';
                districtName.style.backgroundColor = '#f5f5f5';
                districtName.style.borderRadius = '3px';
                districtName.style.marginRight = '4px';
                
                const districtCopyBtn = document.createElement('button');
                districtCopyBtn.textContent = 'Copy';
                districtCopyBtn.style.fontSize = '10px';
                districtCopyBtn.style.padding = '1px 6px';
                districtCopyBtn.style.border = '1px solid #ddd';
                districtCopyBtn.style.borderRadius = '3px';
                districtCopyBtn.style.backgroundColor = '#fff';
                districtCopyBtn.style.cursor = 'pointer';
                districtCopyBtn.onclick = (e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(district);
                  districtCopyBtn.textContent = 'Copied!';
                  setTimeout(() => districtCopyBtn.textContent = 'Copy', 1000);
                };
                
                districtItem.appendChild(districtName);
                districtItem.appendChild(districtCopyBtn);
                districtsList.appendChild(districtItem);
              });
              
              districtsContainer.appendChild(districtsHeader);
              districtsContainer.appendChild(districtsList);
              boardItem.appendChild(districtsContainer);
            }
          }
          
          boardsDiv.appendChild(boardItem);
        });
        
        stateDiv.appendChild(header);
        stateDiv.appendChild(boardsDiv);
        container.appendChild(stateDiv);
      });
    } catch (error) {
      document.getElementById('boardsReference').innerHTML = '<p>Error loading boards reference</p>';
    }
  }
}

// Initialize the processor when the page loads
document.addEventListener('DOMContentLoaded', () => {
  const processor = new BillProcessor();
  processor.setupSingleMode(); // Initialize single mode by default
});