// popup.js - Handles the popup UI functionality

// Define local tax options for each state
const localTaxOptions = {
  'CA': [
    { value: 'sj', label: 'San Jose / Los Angeles / San Diego' },
    { value: 'sf', label: 'San Francisco' }
  ],
  'NY': [
    { value: 'nyc', label: 'New York City' }
  ]
};

document.addEventListener('DOMContentLoaded', function() {
  // Set up state change handler to show/hide local tax options
  const stateSelect = document.getElementById('state');
  const localTaxContainer = document.getElementById('localTaxContainer');
  const localTaxSelect = document.getElementById('localTax');
  
  // Set up filing status change handler to show/hide partner salary
  const filingStatusSelect = document.getElementById('filingStatus');
  const partnerSalaryContainer = document.getElementById('partnerSalaryContainer');
  const partnerSalaryInput = document.getElementById('partnerSalary');
  
  function updateLocalTaxOptions() {
    const selectedState = stateSelect.value;
    
    // Clear all existing options
    while (localTaxSelect.options.length > 0) {
      localTaxSelect.remove(0);
    }
    
    // Show/hide local tax container based on state
    if (selectedState === 'CA' || selectedState === 'NY') {
      localTaxContainer.style.display = 'block';
      
      // Add options for the selected state
      const options = localTaxOptions[selectedState] || [];
      options.forEach(option => {
        const optElement = document.createElement('option');
        optElement.value = option.value;
        optElement.textContent = option.label;
        localTaxSelect.appendChild(optElement);
      });
      
      // Set default city based on state
      if (selectedState === 'CA' && !taxSettings.localTax) {
        // Default to San Jose for California
        localTaxSelect.value = 'sj';
      } else if (selectedState === 'NY' && !taxSettings.localTax) {
        // Default to NYC for New York
        localTaxSelect.value = 'nyc';
      }
    } else {
      localTaxContainer.style.display = 'none';
    }
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
  
  // Set up event listeners
  stateSelect.addEventListener('change', updateLocalTaxOptions);
  filingStatusSelect.addEventListener('change', updatePartnerSalaryVisibility);
  
  // Load saved settings
  chrome.storage.sync.get(['taxSettings', 'columnSettings'], function(result) {
    if (result.taxSettings) {
      document.getElementById('state').value = result.taxSettings.state;
      document.getElementById('filingStatus').value = result.taxSettings.filingStatus;
      
      // Set partner salary if it exists (convert from dollars to thousands for display)
      if (result.taxSettings.partnerSalary) {
        document.getElementById('partnerSalary').value = Math.round(result.taxSettings.partnerSalary / 1000);
      }
      
      // Set local tax if it exists
      if (result.taxSettings.localTax) {
        // First update the options
        updateLocalTaxOptions();
        // Then set the value
        document.getElementById('localTax').value = result.taxSettings.localTax;
      }
    }
    
    if (result.columnSettings) {
      document.getElementById('addNewColumn').checked = result.columnSettings.addNewColumn;
    }
    
    // Initialize visibility and options based on current selections
    updateLocalTaxOptions();
    updatePartnerSalaryVisibility();
  });
  
  // Save settings when button is clicked
  document.getElementById('saveButton').addEventListener('click', function() {
    const state = document.getElementById('state').value;
    const filingStatus = document.getElementById('filingStatus').value;
    const addNewColumn = document.getElementById('addNewColumn').checked;
    const localTax = document.getElementById('localTax').value;
    const partnerSalary = document.getElementById('partnerSalary').value;
    
    const taxSettings = {
      state: state,
      filingStatus: filingStatus,
      localTax: localTax,
      partnerSalary: partnerSalary ? parseInt(partnerSalary) * 1000 : 0 // Convert thousands to dollars
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
