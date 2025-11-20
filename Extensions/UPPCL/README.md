# UPPCL Bill Details Fetcher Extension

A Chrome extension to fetch UPPCL bill details manually or in bulk from the official UPPCL website.

## Features

- **Manual Mode**: Fetch individual bill details by entering District, DISCOM, and Consumer Number
- **Bulk Mode**: Process multiple bills using CSV file upload
- **Three-tab Interface**: Settings, Processing, and Help tabs in side panel
- **UPPCL Theme**: Matches the official website color scheme

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select this extension folder
4. The extension icon will appear in the toolbar

## Usage

### Manual Mode
1. Click the extension icon and open the side panel
2. Select "Manual" mode in Settings tab
3. Choose District and DISCOM from dropdowns
4. Enter Consumer Number
5. Click "Fetch Bill Details"

### Bulk Mode
1. Prepare a CSV file with columns: District, DISCOM, Consumer Number
2. Select "Bulk" mode in Settings tab
3. Upload your CSV file
4. Click "Process Bulk"
5. Monitor progress in the Processing tab

## CSV Format
```
District,DISCOM,Consumer Number
LUCKNOW,DVVNL,1234567890
KANPUR,KESCO,0987654321
```

## Supported Districts
- AGRA, ALIGARH, ALLAHABAD, BAREILLY, GHAZIABAD, KANPUR, LUCKNOW, MEERUT, MORADABAD, VARANASI

## Supported DISCOMs
- DVVNL, KESCO, MVVNL, PVVNL

## Files Structure
- `manifest.json` - Extension configuration
- `sidepanel.html/js` - Main interface with three tabs
- `popup.html/js` - Extension icon popup
- `content.js` - Website interaction script
- `styles.css` - UPPCL-themed styling