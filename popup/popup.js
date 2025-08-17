// popup.js - Handles the popup UI functionality

// Define location mapping
const locationMapping = {
  'CA-sf': { state: 'CA', localTax: 'sf' },
  'NY-nyc': { state: 'NY', localTax: 'nyc' },
  'WA': { state: 'WA', localTax: 'none' },
  'TX': { state: 'TX', localTax: 'none' },
  'VA': { state: 'VA', localTax: 'none' },
  'MA': { state: 'MA', localTax: 'none' },
  'GA': { state: 'GA', localTax: 'none' },
  'NC': { state: 'NC', localTax: 'none' },
  'IL': { state: 'IL', localTax: 'none' },
  'FL': { state: 'FL', localTax: 'none' },
  'DC': { state: 'DC', localTax: 'none' },
  'CO': { state: 'CO', localTax: 'none' },
  'OR': { state: 'OR', localTax: 'none' },
  'PA': { state: 'PA', localTax: 'none' },
  'NV': { state: 'NV', localTax: 'none' }
};

document.addEventListener('DOMContentLoaded', function() {
  // Set up location dropdown
  const locationSelect = document.getElementById('location');
  
  // Set up filing status change handler to show/hide partner salary
  const filingStatusSelect = document.getElementById('filingStatus');
  const partnerSalaryContainer = document.getElementById('partnerSalaryContainer');
  const partnerSalaryInput = document.getElementById('partnerSalary');
  const matchMySalaryCheckbox = document.getElementById('matchMySalary');
  const partnerSalaryInputContainer = document.getElementById('partnerSalaryInputContainer');
  
  // Function to get location key from state and localTax
  function getLocationKey(state, localTax) {
    // Handle backward compatibility for old 'sj' localTax
    if (state === 'CA' && localTax === 'sj') {
      localTax = 'sf'; // Map old San Jose option to San Francisco
    }
    
    for (const [key, value] of Object.entries(locationMapping)) {
      if (value.state === state && value.localTax === localTax) {
        return key;
      }
    }
    
    // Fallback - try to find by state only
    for (const [key, value] of Object.entries(locationMapping)) {
      if (value.state === state) {
        return key;
      }
    }
    
    // Final fallback - default to CA-sf
    return 'CA-sf';
  }
  
  function updatePartnerSalaryVisibility() {
    const selectedFilingStatus = filingStatusSelect.value;
    
    // Show partner salary input only for "Married Filing Jointly"
    if (selectedFilingStatus === 'Married Filing Jointly') {
      partnerSalaryContainer.style.display = 'block';
    } else {
      partnerSalaryContainer.style.display = 'none';
    }
  }
  
  function updatePartnerSalaryInputVisibility() {
    const isMatchMySalary = matchMySalaryCheckbox.checked;
    
    // Hide manual input when "match my salary" is checked
    if (isMatchMySalary) {
      partnerSalaryInputContainer.style.display = 'none';
      partnerSalaryInput.value = ''; // Clear the manual input
    } else {
      partnerSalaryInputContainer.style.display = 'block';
    }
  }
  
  // Set up event listeners
  filingStatusSelect.addEventListener('change', updatePartnerSalaryVisibility);
  matchMySalaryCheckbox.addEventListener('change', updatePartnerSalaryInputVisibility);
  
  // Load saved settings
  chrome.storage.sync.get(['taxSettings', 'columnSettings'], function(result) {
    if (result.taxSettings) {
      // Set location based on saved state and localTax
      const locationKey = getLocationKey(result.taxSettings.state, result.taxSettings.localTax || 'none');
      document.getElementById('location').value = locationKey;
      
      document.getElementById('filingStatus').value = result.taxSettings.filingStatus;
      
      // Set partner salary if it exists (convert from dollars to thousands for display)
      if (result.taxSettings.partnerSalary) {
        document.getElementById('partnerSalary').value = Math.round(result.taxSettings.partnerSalary / 1000);
      }
      
      // Set match my salary checkbox if it exists
      if (result.taxSettings.matchMySalary) {
        document.getElementById('matchMySalary').checked = result.taxSettings.matchMySalary;
      }
    } else {
      // No saved settings - set defaults for new users
      document.getElementById('location').value = 'CA-sf';
      document.getElementById('filingStatus').value = 'Single';
    }
    
    if (result.columnSettings) {
      document.getElementById('addNewColumn').checked = result.columnSettings.addNewColumn;
    } else {
      // Set default value if no settings exist
      document.getElementById('addNewColumn').checked = false;
    }
    
    // Initialize visibility based on current selections
    updatePartnerSalaryVisibility();
    updatePartnerSalaryInputVisibility();
  });
  
  // Ensure visibility and settings are set correctly on popup open (fallback for cases where storage loads slowly)
  setTimeout(() => {
    updatePartnerSalaryVisibility();
    updatePartnerSalaryInputVisibility();
    
    // Re-load settings to ensure checkboxes are properly set
    chrome.storage.sync.get(['columnSettings'], function(result) {
      if (result.columnSettings) {
        document.getElementById('addNewColumn').checked = result.columnSettings.addNewColumn;
      } else {
        document.getElementById('addNewColumn').checked = false;
      }
    });
  }, 100);
  
  // Save settings when button is clicked
  document.getElementById('saveButton').addEventListener('click', function() {
    const selectedLocation = document.getElementById('location').value;
    const locationData = locationMapping[selectedLocation];
    const state = locationData.state;
    const localTax = locationData.localTax;
    
    const filingStatus = document.getElementById('filingStatus').value;
    const addNewColumn = document.getElementById('addNewColumn').checked;
    const partnerSalary = document.getElementById('partnerSalary').value;
    const matchMySalary = document.getElementById('matchMySalary').checked;
    
    // Validation: Check if joint filing but no partner salary provided
    if (filingStatus === 'Married Filing Jointly' && !matchMySalary && (!partnerSalary || partnerSalary.trim() === '')) {
      // Show error message
      const status = document.getElementById('status');
      status.textContent = 'Enter a Partner Salary!';
      status.className = 'status error';
      
      // Hide message after 3 seconds
      setTimeout(function() {
        status.className = 'status';
      }, 3000);
      
      return; // Don't save settings
    }
    
    const taxSettings = {
      state: state,
      filingStatus: filingStatus,
      localTax: localTax,
      partnerSalary: partnerSalary ? parseInt(partnerSalary) * 1000 : 0, // Convert thousands to dollars
      matchMySalary: matchMySalary
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
