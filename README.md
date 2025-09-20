# Saral Bill Details Extension

A Chrome extension to automate bill details extraction from Paytm for multiple consumers.

## Features

- **Side Panel Interface**: Clean, Paytm-themed UI
- **File Upload**: Support for CSV and Excel files with consumer data
- **Automated Processing**: Fill consumer numbers and extract bill details automatically
- **Progress Tracking**: Real-time progress with pause/resume functionality
- **Results Export**: Download results as CSV file

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select this folder
4. The extension icon will appear in the toolbar

## Usage

1. **Prepare Data File**: Create a CSV or Excel file with consumer information
   - Required column: `consumerNumber` (or `ConsumerNumber`, `consumer_number`)
   - Optional column: `name` (or `Name`, `consumer_name`)

2. **Open Extension**: Click the extension icon to open the side panel

3. **Upload File**: Click "Choose File" and select your consumer data file

4. **Start Processing**: 
   - Navigate to Paytm bill payment page
   - Click "Start Processing" in the extension
   - The extension will automatically fill consumer numbers and extract bill details

5. **Monitor Progress**: Use pause/resume controls as needed

6. **Download Results**: Click "Download Results" to get a CSV file with all bill details

## File Format Example

### CSV Format:
```csv
consumerNumber,name
1234567890,John Doe
0987654321,Jane Smith
```

### Excel Format:
Same structure as CSV with headers in first row.

## Supported Data Fields

The extension extracts the following bill details:
- Last Date / Due Date
- Bill Amount
- Payment Status
- Bill Number
- Due Date

## Troubleshooting

- Ensure you're on the correct Paytm bill payment page
- Check that your data file has the correct column names
- The extension needs a few seconds between each consumer to avoid rate limiting

## Technical Details

- **Manifest Version**: 3
- **Permissions**: activeTab, sidePanel, storage
- **Host Permissions**: https://paytm.com/*
- **Content Script**: Automatically injected on Paytm pages