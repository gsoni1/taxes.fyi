// popup.js - Handles the popup UI functionality

document.addEventListener('DOMContentLoaded', function() {
  // Load saved settings
  chrome.storage.sync.get(['taxSettings', 'columnSettings'], function(result) {
    if (result.taxSettings) {
      document.getElementById('state').value = result.taxSettings.state;
      document.getElementById('filingStatus').value = result.taxSettings.filingStatus;
    }
    
    if (result.columnSettings) {
      document.getElementById('addNewColumn').checked = result.columnSettings.addNewColumn;
    }
  });
  
  // Save settings when button is clicked
  document.getElementById('saveButton').addEventListener('click', function() {
    const state = document.getElementById('state').value;
    const filingStatus = document.getElementById('filingStatus').value;
    const addNewColumn = document.getElementById('addNewColumn').checked;
    
    const taxSettings = {
      state: state,
      filingStatus: filingStatus
    };
    
    const columnSettings = {
      addNewColumn: addNewColumn
    };
    
    // Save to Chrome storage
    chrome.storage.sync.set({
      taxSettings: taxSettings,
      columnSettings: columnSettings
    }, function() {
      // Show success message
      const status = document.getElementById('status');
      status.textContent = 'Settings saved!';
      status.className = 'status success';
      
      // Hide message after 2 seconds
      setTimeout(function() {
        status.className = 'status';
      }, 2000);
    });
  });
});
