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
  }

  bindEvents() {
    document.getElementById('fileInput').addEventListener('change', this.handleFileUpload.bind(this));
    document.getElementById('startBtn').addEventListener('click', this.startProcessing.bind(this));
    document.getElementById('pauseBtn').addEventListener('click', this.pauseProcessing.bind(this));
    document.getElementById('stopBtn').addEventListener('click', this.stopProcessing.bind(this));
    document.getElementById('downloadBtn').addEventListener('click', this.downloadResults.bind(this));
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
    const isCSV = filename.toLowerCase().endsWith('.csv');
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) throw new Error('File must have header and data rows');
    
    const headers = lines[0].split(isCSV ? ',' : '\t').map(h => h.trim());
    const consumers = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(isCSV ? ',' : '\t').map(v => v.trim());
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
      const name = consumer.name || consumer.Name || consumer.consumer_name || 'Unknown';
      
      item.innerHTML = `
        <span>${consumerNumber} - ${name}</span>
        <span class="status-indicator">Pending</span>
      `;
      
      list.appendChild(item);
    });
  }

  async startProcessing() {
    if (this.consumers.length === 0) return;
    
    this.isProcessing = true;
    this.isPaused = false;
    this.updateButtons();
    
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
      // Send message to content script to fill form and get bill details
      const result = await this.sendToContentScript({
        action: 'processBill',
        consumer: consumer
      });
      
      this.results.push({
        consumer: consumer,
        success: true,
        data: result
      });
      
      item.className = 'consumer-item completed';
      item.querySelector('.status-indicator').textContent = 'Completed';
      
    } catch (error) {
      this.results.push({
        consumer: consumer,
        success: false,
        error: error.message
      });
      
      item.className = 'consumer-item error';
      item.querySelector('.status-indicator').textContent = 'Error';
    }
    
    // Wait between requests
    await this.delay(2000);
  }

  async sendToContentScript(message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response && response.success) {
              resolve(response.data);
            } else {
              reject(new Error(response ? response.error : 'Unknown error'));
            }
          });
        } else {
          reject(new Error('No active tab found'));
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
    this.displayResults();
    document.getElementById('status').textContent = 'Processing completed';
    document.getElementById('resultsSection').style.display = 'block';
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

  displayResults() {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';
    
    this.results.forEach((result, index) => {
      const item = document.createElement('div');
      item.className = `result-item ${result.success ? 'success' : 'error'}`;
      
      const consumerNumber = result.consumer.consumerNumber || result.consumer.ConsumerNumber || result.consumer.consumer_number;
      
      if (result.success) {
        item.innerHTML = `
          <strong>${consumerNumber}</strong>
          <div class="result-details">
            Last Date: ${result.data.lastDate || 'N/A'}<br>
            Amount: ${result.data.amount || 'N/A'}<br>
            Status: ${result.data.status || 'N/A'}
          </div>
        `;
      } else {
        item.innerHTML = `
          <strong>${consumerNumber}</strong>
          <div class="result-details">Error: ${result.error}</div>
        `;
      }
      
      resultsDiv.appendChild(item);
    });
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
    const headers = ['Consumer Number', 'Name', 'Status', 'Last Date', 'Amount', 'Bill Status', 'Error'];
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
          result.data.lastDate || '',
          result.data.amount || '',
          result.data.status || '',
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
          result.error
        ].join(','));
      }
    });
    
    return rows.join('\n');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize the processor when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new BillProcessor();
});