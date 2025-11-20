// Load data from JSON
async function loadData() {
  try {
    const response = await fetch('data.json');
    const data = await response.json();
    
    const districtSelect = document.getElementById('district');
    const discomSelect = document.getElementById('discom');
    
    data.districts.forEach(district => {
      if (district) {
        const option = document.createElement('option');
        option.value = district;
        option.textContent = district;
        districtSelect.appendChild(option);
      }
    });
    
    data.discoms.forEach(discom => {
      if (discom) {
        const option = document.createElement('option');
        option.value = discom;
        option.textContent = discom;
        discomSelect.appendChild(option);
      }
    });
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// Tab functionality
// Check content script connection
async function checkConnection() {
  const statusElement = document.getElementById('connection-status');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url.includes('consumer.uppcl.org')) {
      statusElement.textContent = 'Navigate to UPPCL website';
      statusElement.className = 'status-disconnected';
      return;
    }
    
    await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
    statusElement.textContent = 'Connected';
    statusElement.className = 'status-connected';
  } catch (error) {
    statusElement.textContent = 'Disconnected';
    statusElement.className = 'status-disconnected';
  }
}

document.addEventListener('DOMContentLoaded', function() {
  loadData();
  checkConnection();
  setInterval(checkConnection, 3000);
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const modeRadios = document.querySelectorAll('input[name="mode"]');
  const manualForm = document.getElementById('manual-form');
  const bulkForm = document.getElementById('bulk-form');

  // Tab switching
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.dataset.tab;
      
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Mode switching
  modeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'manual') {
        manualForm.classList.remove('hidden');
        bulkForm.classList.add('hidden');
      } else {
        manualForm.classList.add('hidden');
        bulkForm.classList.remove('hidden');
      }
    });
  });

  // Manual fetch
  document.getElementById('fetch-manual').addEventListener('click', async () => {
    const district = document.getElementById('district').value;
    const discom = document.getElementById('discom').value;
    const consumerNumber = document.getElementById('consumer-number').value;

    if (!district || !discom || !consumerNumber) {
      alert('Please fill all fields');
      return;
    }

    await fetchBillDetails([{ district, discom, consumerNumber }]);
  });

  // Bulk fetch
  document.getElementById('fetch-bulk').addEventListener('click', async () => {
    const fileInput = document.getElementById('csv-file');
    const file = fileInput.files[0];

    if (!file) {
      alert('Please select a CSV file');
      return;
    }

    const csvData = await parseCSV(file);
    await fetchBillDetails(csvData);
  });
  
  // Download sample CSV
  document.getElementById('download-sample').addEventListener('click', () => {
    downloadSampleCSV();
  });
});

// Parse CSV file
function parseCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const csv = e.target.result;
      const lines = csv.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const data = [];

      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = lines[i].split(',').map(v => v.trim());
          data.push({
            district: values[0],
            discom: values[1],
            consumerNumber: values[2]
          });
        }
      }
      resolve(data);
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// Fetch bill details
async function fetchBillDetails(dataArray) {
  // Switch to processing tab
  document.querySelector('[data-tab="processing"]').click();
  
  const progressFill = document.getElementById('progress-fill');
  const progressPercentage = document.getElementById('progress-percentage');
  const progressCounter = document.getElementById('progress-counter');
  const sessionTime = document.getElementById('session-time');
  const remainingTime = document.getElementById('remaining-time');
  const consumerList = document.getElementById('consumer-list');
  const resultsList = document.getElementById('results-list');
  
  resultsList.innerHTML = '';
  consumerList.innerHTML = '';
  let processed = 0;
  const total = dataArray.length;
  const startTime = Date.now();
  const processedData = [];
  
  // Disable download button initially
  document.getElementById('download-csv').disabled = true;
  
  // Create consumer list items
  dataArray.forEach((data, index) => {
    const consumerItem = document.createElement('div');
    consumerItem.className = 'consumer-item';
    consumerItem.id = `consumer-${index}`;
    consumerItem.innerHTML = `
      <span class="consumer-number">${data.consumerNumber}</span>
      <span class="consumer-status status-pending">Pending</span>
    `;
    consumerList.appendChild(consumerItem);
  });
  
  // Update initial counters
  progressCounter.textContent = `${processed} / ${total}`;
  
  // Start session timer
  const sessionTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    sessionTime.textContent = formatTime(elapsed);
    
    if (processed > 0) {
      const avgTimePerItem = elapsed / processed;
      const remaining = Math.floor(avgTimePerItem * (total - processed));
      remainingTime.textContent = formatTime(remaining);
    }
  }, 1000);

  for (let i = 0; i < dataArray.length; i++) {
    const data = dataArray[i];
    const consumerItem = document.getElementById(`consumer-${i}`);
    const statusSpan = consumerItem.querySelector('.consumer-status');
    
    try {
      // Update status to processing
      statusSpan.textContent = 'Processing';
      statusSpan.className = 'consumer-status status-processing';
      
      // Send message to content script
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'fetchBill',
        data: data
      });

      // Update status based on result
      if (response.success) {
        statusSpan.textContent = 'Completed';
        statusSpan.className = 'consumer-status status-completed';
        processedData.push({ ...data, status: 'Completed' });
      } else {
        statusSpan.textContent = 'Failed';
        statusSpan.className = 'consumer-status status-failed';
        processedData.push({ ...data, status: 'Failed' });
      }

      // Add result
      const resultItem = document.createElement('div');
      resultItem.className = `result-item ${response.success ? 'result-success' : 'result-error'}`;
      resultItem.textContent = response.success 
        ? `✓ ${data.consumerNumber}: Bill fetched successfully`
        : `✗ ${data.consumerNumber}: ${response.error}`;
      resultsList.appendChild(resultItem);

      processed++;
      const progress = (processed / total) * 100;
      progressFill.style.width = `${progress}%`;
      progressPercentage.textContent = `${Math.round(progress)}%`;
      progressCounter.textContent = `${processed} / ${total}`;

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      // Update status to failed
      statusSpan.textContent = 'Failed';
      statusSpan.className = 'consumer-status status-failed';
      processedData.push({ ...data, status: 'Failed' });
      
      const resultItem = document.createElement('div');
      resultItem.className = 'result-item result-error';
      resultItem.textContent = `✗ ${data.consumerNumber}: ${error.message}`;
      resultsList.appendChild(resultItem);
      
      processed++;
      const progress = (processed / total) * 100;
      progressFill.style.width = `${progress}%`;
      progressPercentage.textContent = `${Math.round(progress)}%`;
      progressCounter.textContent = `${processed} / ${total}`;
    }
  }

  clearInterval(sessionTimer);
  remainingTime.textContent = '00:00';
  
  // Enable download button
  const downloadBtn = document.getElementById('download-csv');
  downloadBtn.disabled = false;
  downloadBtn.onclick = () => downloadProcessedCSV(processedData);
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function downloadProcessedCSV(processedData) {
  const headers = ['District', 'DISCOM', 'Consumer Number', 'Status'];
  const csvContent = [headers.join(',')];
  
  processedData.forEach(item => {
    csvContent.push(`${item.district},${item.discom},${item.consumerNumber},${item.status}`);
  });
  
  const csvString = csvContent.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const filename = `uppcl-processed-${timestamp}.csv`;
  
  chrome.downloads.download({
    url: url,
    filename: filename
  });
}

function downloadSampleCSV() {
  const sampleData = [
    'District,DISCOM,Consumer Number',
    'Lucknow,Dakshin Vidyut Vitran Nigam Limited (DVVNL),1234567890',
    'Kanpur Nagar,Kanpur Electricity Supply Company (KESCO),0987654321',
    'Agra,Pashchimanchal Vidyut Vitran Nigam Limited (PVVNL),1122334455'
  ];
  
  const csvString = sampleData.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  chrome.downloads.download({
    url: url,
    filename: 'uppcl-sample.csv'
  });
}