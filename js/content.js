// content.js - Script that runs on levels.fyi pages

// Default settings
let taxSettings = {
  state: 'CA',
  filingStatus: 'Single',
  localTax: 'sj', // Default to San Jose for California
  partnerSalary: 0, // Default partner salary for joint filing
  matchMySalary: false // Default to not matching user's salary
};

let columnSettings = {
  addNewColumn: false // Default to not creating a new column when updating
};

// Constants for retry mechanism
const MAX_RETRIES = 5;
const INITIAL_DELAY = 2000;
let retryCount = 0;

// Load user settings from storage
chrome.storage.sync.get(['taxSettings', 'columnSettings'], function(result) {
  if (result.taxSettings) {
    taxSettings = result.taxSettings;
  }
  
  if (result.columnSettings) {
    columnSettings = result.columnSettings;
  }
  
  // Function to check if React is ready
  const isReactReady = () => {
    const root = document.querySelector('#__next');
    return root && root.children.length > 0;
  };

  // Function to initialize with retry
  const initializeWithRetry = () => {
    if (retryCount >= MAX_RETRIES) {
      console.log('Taxes.fyi: Max retries reached, giving up');
      return;
    }

    if (!isReactReady()) {
      retryCount++;
      console.log(`Taxes.fyi: React not ready, retry ${retryCount} of ${MAX_RETRIES}`);
      setTimeout(initializeWithRetry, INITIAL_DELAY);
      return;
    }

    console.log('Taxes.fyi: React ready, initializing');
    setTimeout(() => {
      try {
        addAfterTaxColumn();
        addAfterTaxDetailedColumn();
      } catch (error) {
        console.error('Taxes.fyi: Initialization error:', error);
      }
    }, 500);
  };

  // Start initialization process
  setTimeout(initializeWithRetry, INITIAL_DELAY);
});

// Tax calculation functions
function calculateFederalTax(salary, filingStatus, partnerSalary = 0) {
  // 2023 Federal tax brackets (simplified)
  let brackets;
  
  if (filingStatus === 'Single') {
    brackets = [
      { threshold: 0, rate: 0.10 },
      { threshold: 11925, rate: 0.12 },
      { threshold: 48475, rate: 0.22 },
      { threshold: 103350, rate: 0.24 },
      { threshold: 197300, rate: 0.32 },
      { threshold: 250525, rate: 0.35 },
      { threshold: 626350, rate: 0.37 }
    ];
  } else if (filingStatus === 'Married Filing Jointly') {
    brackets = [
      { threshold: 0, rate: 0.10 },
      { threshold: 23850, rate: 0.12 },
      { threshold: 96950, rate: 0.22 },
      { threshold: 206700, rate: 0.24 },
      { threshold: 394600, rate: 0.32 },
      { threshold: 501050, rate: 0.35 },
      { threshold: 751600, rate: 0.37 }
    ];
  } else if (filingStatus === 'Married Filing Separately') {
    brackets = [
      { threshold: 0, rate: 0.10 },
      { threshold: 11601, rate: 0.12 },
      { threshold: 47151, rate: 0.22 },
      { threshold: 100526, rate: 0.24 },
      { threshold: 191951, rate: 0.32 },
      { threshold: 243726, rate: 0.35 },
      { threshold: 365601, rate: 0.37 }
    ];
  } else { // Head of Household
    brackets = [
      { threshold: 0, rate: 0.10 },
      { threshold: 16551, rate: 0.12 },
      { threshold: 63101, rate: 0.22 },
      { threshold: 100501, rate: 0.24 },
      { threshold: 191951, rate: 0.32 },
      { threshold: 243701, rate: 0.35 },
      { threshold: 609351, rate: 0.37 }
    ];
  }
  
  // Standard deduction based on filing status
  let standardDeduction;
  if (filingStatus === 'Married Filing Jointly') {
    standardDeduction = 30000;
  } else if (filingStatus === 'Married Filing Separately') {
    standardDeduction = 15000;
  } else if (filingStatus === 'Head of Household') {
    standardDeduction = 22500;
  } else { // Single
    standardDeduction = 15000;
  }
  
  // For joint filing, calculate tax on combined income, then allocate proportionally
  let totalIncome = salary;
  if (filingStatus === 'Married Filing Jointly' && partnerSalary > 0) {
    totalIncome = salary + partnerSalary;
  }
  
  // Taxable income after standard deduction
  let taxableIncome = Math.max(0, totalIncome - standardDeduction);
  
  // Calculate tax
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    if (i === brackets.length - 1) {
      // For the highest bracket
      if (taxableIncome > brackets[i].threshold) {
        tax += (taxableIncome - brackets[i].threshold) * brackets[i].rate;
      }
    } else {
      // For all other brackets
      if (taxableIncome > brackets[i].threshold) {
        const bracketIncome = Math.min(taxableIncome, brackets[i+1].threshold) - brackets[i].threshold;
        tax += bracketIncome * brackets[i].rate;
      }
    }
  }
  
  // For joint filing, allocate tax proportionally based on individual income
  if (filingStatus === 'Married Filing Jointly' && partnerSalary > 0) {
    const individualProportion = salary / totalIncome;
    tax = tax * individualProportion;
  }
  
  return tax;
}

function calculateStateTax(salary, state, filingStatus, partnerSalary = 0) {
  // State tax brackets for 2023
  let brackets = [];
  let standardDeduction = 0;
  
  // Define brackets based on state and filing status
  if (state === 'CA') {
    // California tax brackets
    if (filingStatus === 'Single' || filingStatus === 'Married Filing Separately') {
      standardDeduction = 5540;
      brackets = [
        { threshold: 0, rate: 0.01 },
        { threshold: 10756, rate: 0.02 },
        { threshold: 25499, rate: 0.04 },
        { threshold: 40245, rate: 0.06 },
        { threshold: 55866, rate: 0.08 },
        { threshold: 70606, rate: 0.093 },
        { threshold: 360659, rate: 0.103 },
        { threshold: 432787, rate: 0.113 },
        { threshold: 721314, rate: 0.123 }
      ];
    } else if (filingStatus === 'Married Filing Jointly') {
      standardDeduction = 11080;
      brackets = [
        { threshold: 0, rate: 0.01 },
        { threshold: 21512, rate: 0.02 },
        { threshold: 50998, rate: 0.04 },
        { threshold: 80490, rate: 0.06 },
        { threshold: 111732, rate: 0.08 },
        { threshold: 141212, rate: 0.093 },
        { threshold: 721318, rate: 0.103 },
        { threshold: 865574, rate: 0.113 },
        { threshold: 1442628, rate: 0.123 }
      ];
    } else { // Head of Household
      standardDeduction = 11080;
      brackets = [
        { threshold: 0, rate: 0.01 },
        { threshold: 21527, rate: 0.02 },
        { threshold: 51000, rate: 0.04 },
        { threshold: 65744, rate: 0.06 },
        { threshold: 81364, rate: 0.08 },
        { threshold: 96107, rate: 0.093 },
        { threshold: 490493, rate: 0.103 },
        { threshold: 588593, rate: 0.113 },
        { threshold: 980987, rate: 0.123 }
      ];
    }
  } else if (state === 'NY') {
    // New York tax brackets
    if (filingStatus === 'Single' || filingStatus === 'Married Filing Separately') {
      standardDeduction = 8000;
      brackets = [
        { threshold: 0, rate: 0.04 },
        { threshold: 8501, rate: 0.045 },
        { threshold: 11701, rate: 0.0525 },
        { threshold: 13901, rate: 0.055 },
        { threshold: 80651, rate: 0.06 },
        { threshold: 215401, rate: 0.0685 },
        { threshold: 1077551, rate: 0.0965 },
        { threshold: 5000001, rate: 0.1030 },
        { threshold: 25000001, rate: 0.1090 }
      ];
    } else if (filingStatus === 'Married Filing Jointly') {
      standardDeduction = 16050;
      brackets = [
        { threshold: 0, rate: 0.04 },
        { threshold: 17151, rate: 0.045 },
        { threshold: 23601, rate: 0.0525 },
        { threshold: 27901, rate: 0.055 },
        { threshold: 161551, rate: 0.06 },
        { threshold: 323201, rate: 0.0685 },
        { threshold: 2155351, rate: 0.0965 },
        { threshold: 5000001, rate: 0.1030 },
        { threshold: 25000001, rate: 0.1090 }
      ];
    } else { // Head of Household
      standardDeduction = 11200;
      brackets = [
        { threshold: 0, rate: 0.04 },
        { threshold: 12801, rate: 0.045 },
        { threshold: 17651, rate: 0.0525 },
        { threshold: 20901, rate: 0.055 },
        { threshold: 107651, rate: 0.06 },
        { threshold: 269301, rate: 0.0685 },
        { threshold: 1616451, rate: 0.0965 },
        { threshold: 5000001, rate: 0.1030 },
        { threshold: 25000001, rate: 0.1090 }
      ];
    }
  } else if (state === 'VA') {
    // Virginia tax brackets (same for all filing statuses)
    standardDeduction = filingStatus === 'Married Filing Jointly' ? 17000 : 8500;
    brackets = [
      { threshold: 0, rate: 0.02 },
      { threshold: 3000, rate: 0.03 },
      { threshold: 5000, rate: 0.05 },
      { threshold: 17000, rate: 0.0575 }
    ];
  } else if (state === 'MA') {
    // Massachusetts has a flat tax rate of 5% for all income
    standardDeduction = 0; // MA uses different types of deductions, simplified here
    brackets = [
      { threshold: 8000, rate: 0.05 },
      { threshold: 1083150, rate: 0.09 }
    ];
  } else if (state === 'GA') {
    // Georgia tax brackets (same for all filing statuses)
    if (filingStatus === 'Married Filing Jointly') {
      standardDeduction = 24000;
    } else {
      standardDeduction = 12000;
    }
    brackets = [
      { threshold: 0, rate: 0.0539 }
    ];
  } else if (state === 'TX' || state === 'WA') {
    // Texas and Washington have no state income tax
    return 0;
  }
  
  // For joint filing, calculate tax on combined income, then allocate proportionally
  let totalIncome = salary;
  if (filingStatus === 'Married Filing Jointly' && partnerSalary > 0) {
    totalIncome = salary + partnerSalary;
  }
  
  // Taxable income after state standard deduction
  let taxableIncome = Math.max(0, totalIncome - standardDeduction);
  
  // Calculate tax using brackets
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    if (i === brackets.length - 1) {
      // For the highest bracket
      if (taxableIncome > brackets[i].threshold) {
        tax += (taxableIncome - brackets[i].threshold) * brackets[i].rate;
      }
    } else {
      // For all other brackets
      if (taxableIncome > brackets[i].threshold) {
        const bracketIncome = Math.min(taxableIncome, brackets[i+1].threshold) - brackets[i].threshold;
        tax += bracketIncome * brackets[i].rate;
      }
    }
  }
  
  // For joint filing, allocate tax proportionally based on individual income
  if (filingStatus === 'Married Filing Jointly' && partnerSalary > 0) {
    const individualProportion = salary / totalIncome;
    tax = tax * individualProportion;
  }
  
  return tax;
}

function calculateFICATax(salary) {
  // Social Security (6.2% up to wage base limit of $176,100 for 2025)
  const socialSecurityTax = Math.min(salary, 176100) * 0.062;
  
  // Medicare (1.45% on all earnings, plus 0.9% on earnings over $200,000)
  let medicareTax = salary * 0.0145;
  if (salary > 200000) {
    medicareTax += (salary - 200000) * 0.009;
  }
  
  return socialSecurityTax + medicareTax;
}

function calculateLocalTax(salary, state, localTax, filingStatus) {
  if (localTax === 'none') {
    return 0;
  }
  
  // Calculate local tax based on locality
  if (state === 'NY') {
    if (localTax === 'nyc') {
      // NYC has a progressive tax system
      let localTaxAmount = 0;
      let taxableIncome = salary;
      
      if (filingStatus === 'Single' || filingStatus === 'Married Filing Separately') {
        if (taxableIncome <= 12000) {
          localTaxAmount = taxableIncome * 0.03078;
        } else if (taxableIncome <= 25000) {
          localTaxAmount = 369 + ((taxableIncome - 12000) * 0.03762);
        } else if (taxableIncome <= 50000) {
          localTaxAmount = 858 + ((taxableIncome - 25000) * 0.03819);
        } else {
          localTaxAmount = 1813 + ((taxableIncome - 500000) * 0.03876);
        }
      } else if (filingStatus === 'Married Filing Jointly') {
        if (taxableIncome <= 21600) {
          localTaxAmount = taxableIncome * 0.03078;
        } else if (taxableIncome <= 45000) {
          localTaxAmount = 665 + ((taxableIncome - 21600) * 0.03762) - 17000;
        } else if (taxableIncome <= 90000) {
          localTaxAmount = 1545 + ((taxableIncome - 45000) * 0.03819) - 17000;
        } else {
          localTaxAmount = 3264 + ((taxableIncome - 90000) * 0.03876) - 17000;
        }
      } else { // Head of Household
        if (taxableIncome <= 14400) {
          localTaxAmount = taxableIncome * 0.03078;
        } else if (taxableIncome <= 30000) {
          localTaxAmount = 443 + ((taxableIncome - 14400) * 0.03762);
        } else if (taxableIncome <= 60000) {
          localTaxAmount = 1030 + ((taxableIncome - 30000) * 0.03819);
        } else {
          localTaxAmount = 2176 + ((taxableIncome - 60000) * 0.03876);
        }
      }
      
      return localTaxAmount;
    }
  } else if (state === 'CA') {
    if (localTax === 'sf') {
      // San Francisco has a gross receipts tax of 1.5% on salaries over $150,000
      return salary > 150000 ? (salary - 150000) * 0.015 : 0;
    } else {
      return 0;
    }
  }
  
  return 0;
}

// Helper function to format after-tax label with partner salary info
function formatAfterTaxLabel(stateAbbr, filingStatusAbbr, includePartnerSalary = true) {
  let label = `${stateAbbr}, ${filingStatusAbbr}`;
  
  // Add partner salary info for joint filing
  if (includePartnerSalary && taxSettings.filingStatus === 'Married Filing Jointly') {
    if (taxSettings.matchMySalary) {
      label += ' +Partner';
    } else if (taxSettings.partnerSalary > 0) {
      const partnerSalaryK = Math.round(taxSettings.partnerSalary / 1000);
      label += ` +${partnerSalaryK}K`;
    }
  }
  
  return `(${label})`;
}

// Add new helper function to parse location data
function parseLocationFromRow(row) {
  const locationSpan = row.querySelector('.MuiTypography-caption.css-xlmjpr');
  if (!locationSpan) return null;
  
  const locationText = locationSpan.textContent;
  const city = locationText.split(',')[0].trim();
  const state = locationText.split(',')[1]?.split('|')[0]?.trim();
  
  return { city, state };
}

// Modify calculateTotalTax to accept location parameter
function calculateTotalTax(salary, location = null) {
  // If no location provided, use default settings
  if (!location) {
    // Use current salary as partner salary if match toggle is enabled
    const partnerSalary = taxSettings.matchMySalary ? salary : (taxSettings.partnerSalary || 0);
    const federalTax = calculateFederalTax(salary, taxSettings.filingStatus, partnerSalary);
    const stateTax = calculateStateTax(salary, taxSettings.state, taxSettings.filingStatus, partnerSalary);
    const localTax = calculateLocalTax(salary, taxSettings.state, taxSettings.localTax, taxSettings.filingStatus);
    const ficaTax = calculateFICATax(salary);
    
    if (taxSettings.state === 'NY') {
      return federalTax + stateTax + localTax + ficaTax + 17000;
    } else if (taxSettings.state === 'CA' && taxSettings.localTax === 'sf') {
      return federalTax + stateTax + localTax + ficaTax + 2500;
    } else {
      return federalTax + stateTax + localTax + ficaTax;
    }
  }
  
  // Use location-specific calculation
  // Use current salary as partner salary if match toggle is enabled
  const partnerSalary = taxSettings.matchMySalary ? salary : (taxSettings.partnerSalary || 0);
  const federalTax = calculateFederalTax(salary, taxSettings.filingStatus, partnerSalary);
  const stateTax = calculateStateTax(salary, location.state, taxSettings.filingStatus, partnerSalary);
  const ficaTax = calculateFICATax(salary);
  
  // Handle location-specific cases
  if (location.state === 'CA') {
    if (location.city === 'San Francisco') {
      const sfTax = salary > 150000 ? (salary - 150000) * 0.015 : 0;
      return federalTax + stateTax + sfTax + ficaTax + 2500;
    } else {
      return federalTax + stateTax + ficaTax;
    }
  } else if (location.state === 'NY') {
    if (location.city === 'New York') {
      const nycTax = calculateLocalTax(salary, 'NY', 'nyc', taxSettings.filingStatus);
      return federalTax + stateTax + nycTax + ficaTax + 17000;
    } else {
      return federalTax + stateTax + ficaTax + 17000;
    }
  }
  
  // For other supported states, just use federal + state + FICA
  const supportedStates = ['TX', 'WA', 'VA', 'MA', 'GA'];
  if (supportedStates.includes(location.state)) {
    return federalTax + stateTax + ficaTax;
  }
  
  // Return null for unsupported states
  return null;
}

// Function to parse salary strings like "$128K" or "$1.05M"
function parseSalaryString(salaryStr) {
  if (salaryStr === "$ --") return 0;
  
  // Remove $ and any commas
  salaryStr = salaryStr.replace('$', '').replace(/,/g, '').trim();
  
  // Handle K (thousands)
  if (salaryStr.includes('K')) {
    return parseFloat(salaryStr.replace('K', '')) * 1000;
  }
  // Handle M (millions)
  else if (salaryStr.includes('M')) {
    return parseFloat(salaryStr.replace('M', '')) * 1000000;
  }
  else {
    return parseFloat(salaryStr);
  }
}

// Function to format salary back to the same format as the original
function formatSalary(value) {
  if (value === 0) return "$ --";
  
  // Round to the nearest thousand
  value = Math.round(value / 1000) * 1000;
  
  if (value >= 1000000) {
    // For millions, show as $X.XM with one decimal place
    return "$" + (value / 1000000).toFixed(1) + "M";
  } else {
    // For thousands, show as $XXXK with no decimal places
    return "$" + (value / 1000).toFixed(0) + "K";
  }
}

// Function to format salary with exact dollars
function formatExactSalary(value) {
    if (value === 0) return "$ --";
    return `$${Math.round(value).toLocaleString()}`;
}

// Function to get location from URL
function getLocationFromURL() {
    const path = window.location.pathname;
    if (!path.includes('/locations/')) return null;
    
    const mapping = {
        'greater-seattle-area': { state: 'WA', city: 'Seattle' },
        'san-francisco-bay-area': { state: 'CA', city: 'San Francisco' },
        'greater-san-diego-area': { state: 'CA', city: 'San Diego' },
        'greater-los-angeles-area': { state: 'CA', city: 'Los Angeles' },
        'new-york-city-area': { state: 'NY', city: 'New York' },
        'greater-dallas-area': { state: 'TX', city: 'Dallas' },
        'greater-austin-area': { state: 'TX', city: 'Austin' },
        'atlanta-area': { state: 'GA', city: 'Atlanta' },
        'northern-virginia-washington-dc': { state: 'VA', city: 'Arlington' },
        'greater-boston-area': { state: 'MA', city: 'Boston' }
    };
    
    for (const [urlPath, location] of Object.entries(mapping)) {
        if (path.includes(urlPath)) {
            return location;
        }
    }
    
    return null;
}

// Main function to add the After Tax column
function addAfterTaxColumn() {
  console.log('Taxes.fyi: Looking for tables to modify...');
  
  // First, check if we already added the column
  const existingAfterTaxHeaders = Array.from(document.querySelectorAll('th h6')).filter(h => 
    h.textContent.trim() === 'After Tax ');
  
  if (existingAfterTaxHeaders.length > 0) {
    console.log('Taxes.fyi: After Tax column already exists');
    return;
  }
  
  // Find all tables on the page
  const tables = document.querySelectorAll('.MuiTable-root');
  console.log(`Taxes.fyi: Found ${tables.length} tables`);
  
  tables.forEach((table, tableIndex) => {
    try {
      // Find the header row
      const headerRow = table.querySelector('thead tr');
      if (!headerRow) {
        console.log(`Taxes.fyi: No header row found in table ${tableIndex}`);
        return;
      }
      
      // Find the Base column index first
      const headerCells = headerRow.querySelectorAll('th');
      let baseColumnIndex = -1;
      let stockColumnIndex = -1;
      let bonusColumnIndex = -1;
      let totalColumnIndex = -1;
      
      for (let i = 0; i < headerCells.length; i++) {
        const headerText = headerCells[i].textContent.trim();
        if (headerText === 'Base') {
          baseColumnIndex = i;
        } else if (headerText === 'Stock') {
          stockColumnIndex = i;
        } else if (headerText === 'Bonus') {
          bonusColumnIndex = i;
        } else if (headerText.includes('Total')) {
          totalColumnIndex = i;
        }
      }
      
      if (baseColumnIndex === -1 || totalColumnIndex === -1) {
        console.log(`Taxes.fyi: Required columns not found in table ${tableIndex}`);
        return;
      }
      
      // Create the After Tax header cell
      const totalHeaderCell = headerCells[totalColumnIndex];
      const h6Element = totalHeaderCell.querySelector('h6');
      if (!h6Element) return;
      
      const newHeaderCell = document.createElement('th');
      newHeaderCell.className = totalHeaderCell.className || '';
      newHeaderCell.setAttribute('scope', 'col');
      
      const headerTitle = document.createElement('h6');
      headerTitle.className = h6Element.className;
      headerTitle.textContent = 'After Tax ';
      
      const stateAbbr = taxSettings.state;
      const filingStatusAbbr = taxSettings.filingStatus === 'Married Filing Jointly' ? 'Joint' : 
                              taxSettings.filingStatus === 'Head of Household' ? 'Head' : 'Single';
      
      const infoSpan = document.createElement('span');
      infoSpan.className = 'MuiTypography-root MuiTypography-caption job-family_secondary__YtLA8 css-b4wlzm';
      infoSpan.textContent = formatAfterTaxLabel(stateAbbr, filingStatusAbbr);
      
      newHeaderCell.appendChild(headerTitle);
      newHeaderCell.appendChild(infoSpan);
      
      // Insert after Total column
      headerRow.insertBefore(newHeaderCell, headerCells[totalColumnIndex + 1]);
      
      // Process all rows including hidden ones
      const processRow = (row) => {
        const cells = row.querySelectorAll('td');
        if (totalColumnIndex >= cells.length) return;
        
        const totalCell = cells[totalColumnIndex];
        const totalValueElement = totalCell.querySelector('h6');
        
        if (!totalValueElement) return;
        
        const totalSalaryText = totalValueElement.textContent;
        const totalSalary = parseSalaryString(totalSalaryText);
        
        // Create new cell
        const newCell = document.createElement('td');
        newCell.className = totalCell.className;
        
        const valueElement = document.createElement('h6');
        valueElement.className = totalValueElement.className;
        
        // Calculate after-tax value
        let afterTaxSalary = totalSalary;
        if (totalSalary > 0) {
          const totalTax = calculateTotalTax(totalSalary);
          afterTaxSalary = totalSalary - totalTax;
        }
        
        valueElement.textContent = formatSalary(afterTaxSalary);
        newCell.appendChild(valueElement);
        
        // Insert after Total column
        row.insertBefore(newCell, cells[totalColumnIndex + 1]);
      };
      
      // Handle both visible and dropdown rows
      const processAllRows = () => {
        const allRows = table.querySelectorAll('tbody tr');
        allRows.forEach(processRow);
      };
      
      // Initial processing of rows
      processAllRows();
      
      // Set up observer for dropdown rows
      const dropdownObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            const addedRows = Array.from(mutation.addedNodes)
              .filter(node => node.nodeType === 1 && node.tagName === 'TR');
            
            addedRows.forEach(processRow);
          }
        });
      });
      
      // Observe tbody for changes
      const tbody = table.querySelector('tbody');
      if (tbody) {
        dropdownObserver.observe(tbody, {
          childList: true,
          subtree: true
        });
      }
      
      console.log(`Taxes.fyi: Successfully modified table ${tableIndex}`);
    } catch (error) {
      console.error(`Taxes.fyi: Error modifying table ${tableIndex}:`, error);
    }
  });
}

// Modify the settings change listener to handle all table types
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'sync') {
    if (changes.taxSettings) {
      console.log('Taxes.fyi: Tax settings changed, updating calculations...');
      taxSettings = changes.taxSettings.newValue;
      
      const shouldAddNewColumn = columnSettings.addNewColumn;
      
      if (shouldAddNewColumn) {
        // Remove all existing after-tax columns
        const tables = document.querySelectorAll('.MuiTable-root');
        tables.forEach(table => {
          const headerRow = table.querySelector('thead tr');
          if (!headerRow) return;
          
          // Skip detailed tables
          if (headerRow.querySelector('p[class*="salary-table_sortTableHeaderText"]')) return;
          
          removeAfterTaxColumn(table);
        });
        
        // Add new after-tax columns with updated calculations
        setTimeout(addAfterTaxColumn, 500);
      } else {
        // Update values in existing after-tax columns
        const tables = document.querySelectorAll('.MuiTable-root');
        tables.forEach(table => {
          const headerRow = table.querySelector('thead tr');
          if (!headerRow) return;
          
          // Skip detailed tables
          if (headerRow.querySelector('p[class*="salary-table_sortTableHeaderText"]')) return;
          
          updateNormalTableValues(table);
        });
      }
    }
    
    if (changes.columnSettings) {
      console.log('Taxes.fyi: Column settings changed');
      columnSettings = changes.columnSettings.newValue;
    }
  }
});

// Function to remove after-tax column from a table
function removeAfterTaxColumn(table) {
  const headerRow = table.querySelector('thead tr');
  if (!headerRow) return;
  
  const afterTaxHeaders = Array.from(headerRow.querySelectorAll('th h6'))
    .filter(h => h.textContent.trim() === 'After Tax ');
  
  afterTaxHeaders.forEach(header => {
    const column = header.closest('th');
    const columnIndex = Array.from(headerRow.children).indexOf(column);
    
    // Remove the header
    column.remove();
    
    // Remove the corresponding cell in each row
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      if (columnIndex < row.children.length) {
        row.children[columnIndex].remove();
      }
    });
  });
}

// Function to update values in normal (non-detailed) table
function updateNormalTableValues(table) {
  const headerRow = table.querySelector('thead tr');
  if (!headerRow) return;
  
  const headerCells = headerRow.querySelectorAll('th');
  let totalColumnIndex = -1;
  let afterTaxColumnIndex = -1;
  
  for (let i = 0; i < headerCells.length; i++) {
    const headerText = headerCells[i].textContent.trim();
    if (headerText.includes('Total')) {
      totalColumnIndex = i;
    } else if (headerText.includes('After Tax')) {
      afterTaxColumnIndex = i;
    }
  }
  
  if (totalColumnIndex === -1 || afterTaxColumnIndex === -1) return;
  
  // Update the state and filing status in the header
  const afterTaxHeader = headerCells[afterTaxColumnIndex];
  const stateAbbr = taxSettings.state;
  const filingStatusAbbr = taxSettings.filingStatus === 'Married Filing Jointly' ? 'Joint' : 
                         taxSettings.filingStatus === 'Head of Household' ? 'Head' : 'Single';
  
  // Find or create the info span
  let infoSpan = afterTaxHeader.querySelector('span');
  if (!infoSpan) {
    infoSpan = document.createElement('span');
    infoSpan.className = 'MuiTypography-root MuiTypography-caption job-family_secondary__YtLA8 css-b4wlzm';
    afterTaxHeader.appendChild(infoSpan);
  }
  
  // Update the text
  infoSpan.textContent = formatAfterTaxLabel(stateAbbr, filingStatusAbbr);
  
  // Update values in rows
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (totalColumnIndex >= cells.length || afterTaxColumnIndex >= cells.length) return;
    
    const totalCell = cells[totalColumnIndex];
    const afterTaxCell = cells[afterTaxColumnIndex];
    const totalValueElement = totalCell.querySelector('h6');
    const afterTaxValueElement = afterTaxCell.querySelector('h6');
    
    if (!totalValueElement || !afterTaxValueElement) return;
    
    const totalSalaryText = totalValueElement.textContent;
    const totalSalary = parseSalaryString(totalSalaryText);
    
    // Calculate after-tax salary using current settings
    let afterTaxSalary = totalSalary;
    if (totalSalary > 0) {
      const totalTax = calculateTotalTax(totalSalary);
      afterTaxSalary = totalSalary - totalTax;
    }
    
    // Update the value
    afterTaxValueElement.textContent = formatSalary(afterTaxSalary);
    
    // Match styling with total column
    const isTotalBold = totalValueElement.className.includes('css-xj4mea');
    afterTaxValueElement.className = isTotalBold ? 
      'MuiTypography-root MuiTypography-subtitle1 css-xj4mea' : 
      'MuiTypography-root MuiTypography-subtitle1 css-6xe2a5';
  });
}

// Create a helper function to update values in a single table
function updateTableValues(table) {
  const headerRow = table.querySelector('thead tr');
  if (!headerRow) return;
  
  const headerCells = headerRow.querySelectorAll('th');
  let totalColumnIndex = -1;
  let afterTaxColumnIndex = -1;
  
  for (let i = 0; i < headerCells.length; i++) {
    const headerText = headerCells[i].textContent.trim();
    if (headerText.includes('Total')) {
      totalColumnIndex = i;
    } else if (headerText.includes('After Tax')) {
      afterTaxColumnIndex = i;
    }
  }
  
  if (totalColumnIndex === -1 || afterTaxColumnIndex === -1) return;
  
  // Update the state and filing status in the header
  const afterTaxHeader = headerCells[afterTaxColumnIndex];
  const stateAbbr = taxSettings.state;
  const filingStatusAbbr = taxSettings.filingStatus === 'Married Filing Jointly' ? 'Joint' : 
                         taxSettings.filingStatus === 'Head of Household' ? 'Head' : 'Single';
  
  // Find or create the info span
  let infoSpan = afterTaxHeader.querySelector('span');
  if (!infoSpan) {
    infoSpan = document.createElement('span');
    infoSpan.className = 'MuiTypography-root MuiTypography-caption job-family_secondary__YtLA8 css-b4wlzm';
    afterTaxHeader.appendChild(infoSpan);
  }
  
  // Update the text
  infoSpan.textContent = formatAfterTaxLabel(stateAbbr, filingStatusAbbr);
  
  // Update values in rows
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    
    if (totalColumnIndex >= cells.length || afterTaxColumnIndex >= cells.length) return;
    
    const totalCell = cells[totalColumnIndex];
    const afterTaxCell = cells[afterTaxColumnIndex];
    const totalValueElement = totalCell.querySelector('h6');
    const afterTaxValueElement = afterTaxCell.querySelector('h6');
    
    if (!totalValueElement || !afterTaxValueElement) return;
    
    const totalSalaryText = totalValueElement.textContent;
    const totalSalary = parseSalaryString(totalSalaryText);
    
    const location = parseLocationFromRow(row);
    
    // Calculate after-tax salary only if we have a supported location
    let afterTaxSalary = totalSalary;
    if (totalSalary > 0 && location) {
      const totalTax = calculateTotalTax(totalSalary, location);
      if (totalTax !== null) {
        afterTaxSalary = totalSalary - totalTax;
      } else {
        // Remove after-tax cell if location not supported
        afterTaxCell.remove();
        return;
      }
    }
    
    // Check if the Total value is bold (has the css-xj4mea class)
    const isTotalBold = totalValueElement.className.includes('css-xj4mea');
    
    // Update the after-tax value and ensure proper styling
    afterTaxValueElement.textContent = formatSalary(afterTaxSalary);
    
    // Make sure the styling matches the Total column (bold if Total is bold)
    if (isTotalBold && !afterTaxValueElement.className.includes('css-xj4mea')) {
      afterTaxValueElement.className = 'MuiTypography-root MuiTypography-subtitle1 css-xj4mea';
    } else if (!isTotalBold && afterTaxValueElement.className.includes('css-xj4mea')) {
      afterTaxValueElement.className = 'MuiTypography-root MuiTypography-subtitle1 css-6xe2a5';
    }
  });
}

// Set up a MutationObserver to detect when new tables are added or content changes
const observer = new MutationObserver(function(mutations) {
  clearTimeout(window._taxesFyiTimeout);
  window._taxesFyiTimeout = setTimeout(() => {
    // Check if React is ready before processing
    if (!document.querySelector('#__next')) return;

    let shouldUpdate = false;
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        const hasRelevantChanges = Array.from(mutation.addedNodes).some(node => {
          if (node.nodeType !== 1) return false;
          return node.querySelector?.('.MuiTable-root, [class*="percentiles_medianAmount"]') ||
                 node.classList?.contains('MuiTable-root') ||
                 Array.from(node.classList || []).some(cls => cls.includes('percentiles_medianAmount'));
        });
        if (hasRelevantChanges) shouldUpdate = true;
      }
    });

    if (shouldUpdate) {
      console.log('Taxes.fyi: Content changes detected, updating...');
      setTimeout(() => {
        try {
          if (document.querySelector('.MuiTable-root')) {
            addAfterTaxColumn();
            addAfterTaxDetailedColumn();
          }
          if (document.querySelector('[class*="percentiles_medianAmount"]')) {
            duplicateMedianElements();
            duplicatePercentileElements();
            duplicate75thPercentileElements();
            duplicate90thPercentileElements();
          }
        } catch (error) {
          console.error('Taxes.fyi: Update error:', error);
        }
      }, 1000);
    }
  }, 250);
});

// Function to fix styling on after-tax values
function fixAfterTaxStyles() {
  const tables = document.querySelectorAll('.MuiTable-root');
  
  tables.forEach(table => {
    // Find the header row
    const headerRow = table.querySelector('thead tr');
    if (!headerRow) return;
    
    // Find the Total column and After Tax column
    const headerCells = headerRow.querySelectorAll('th');
    let totalColumnIndex = -1;
    let afterTaxColumnIndex = -1;
    
    for (let i = 0; i < headerCells.length; i++) {
      const headerText = headerCells[i].textContent.trim();
      if (headerText.includes('Total')) {
        totalColumnIndex = i;
      } else if (headerText.includes('After Tax')) {
        afterTaxColumnIndex = i;
      }
    }
    
    if (totalColumnIndex === -1 || afterTaxColumnIndex === -1) return;
    
    // Update the styling for each row
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      
      if (totalColumnIndex >= cells.length || afterTaxColumnIndex >= cells.length) return;
      
      const totalCell = cells[totalColumnIndex];
      const afterTaxCell = cells[afterTaxColumnIndex];
      const totalValueElement = totalCell.querySelector('h6');
      const afterTaxValueElement = afterTaxCell.querySelector('h6');
      
      if (!totalValueElement || !afterTaxValueElement) return;
      
      // Check if the Total value is bold (has the css-xj4mea class)
      const isTotalBold = totalValueElement.className.includes('css-xj4mea');
      const isAfterTaxBold = afterTaxValueElement.className.includes('css-xj4mea');
      
      // Make sure the styling matches the Total column (bold if Total is bold)
      if (isTotalBold && !isAfterTaxBold) {
        afterTaxValueElement.className = 'MuiTypography-root MuiTypography-subtitle1 css-xj4mea';
      } else if (!isTotalBold && isAfterTaxBold) {
        afterTaxValueElement.className = 'MuiTypography-root MuiTypography-subtitle1 css-6xe2a5';
      }
    });
  });
}

// Start observing the document for both content and attribute changes
observer.observe(document.body, { 
  childList: true, 
  subtree: true,
  attributes: true,
  attributeFilter: ['class']
});

// Initial run
console.log('Taxes.fyi: Extension loaded');

// Also set up click event listeners for any buttons that might expand salary information
document.addEventListener('click', function(event) {
  // Check if the click was on a button or element that might trigger salary changes
  const target = event.target;
  
  // If it's a button or something that might expand/collapse salary info
  if (target.tagName === 'BUTTON' || 
      target.closest('button') || 
      target.getAttribute('role') === 'button' ||
      target.classList.contains('monthly-toggle-text_salaryTypeLabelButton__joQJj')) {
    
    console.log('Taxes.fyi: Potential salary toggle button clicked');
    
    // Wait a bit for the UI to update, then refresh all values and fix styles
    setTimeout(function() {
      updateAllAfterTaxValues(); // Use the new function to update all values
      fixAfterTaxStyles();
    }, 500);
  }
});

// Function to update all after-tax values in a table
function updateAllAfterTaxValues() {
  console.log('Taxes.fyi: Refreshing all after-tax values...');
  const tables = document.querySelectorAll('.MuiTable-root');
  
  tables.forEach(table => {
    // Find the header row
    const headerRow = table.querySelector('thead tr');
    if (!headerRow) return;
    
    // Find the Total column and After Tax column
    const headerCells = headerRow.querySelectorAll('th');
    let totalColumnIndex = -1;
    let afterTaxColumnIndex = -1;
    
    for (let i = 0; i < headerCells.length; i++) {
      const headerText = headerCells[i].textContent.trim();
      if (headerText.includes('Total')) {
        totalColumnIndex = i;
      } else if (headerText.includes('After Tax')) {
        afterTaxColumnIndex = i;
      }
    }
    
    if (totalColumnIndex === -1 || afterTaxColumnIndex === -1) return;
    
    // Process all rows
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      
      if (totalColumnIndex >= cells.length) return;
      
      const totalCell = cells[totalColumnIndex];
      const totalValueElement = totalCell.querySelector('h6');
      
      if (!totalValueElement) return;
      
      // Get the total salary value
      const totalSalaryText = totalValueElement.textContent;
      const totalSalary = parseSalaryString(totalSalaryText);
      
      // Calculate after-tax salary using popup settings
      let afterTaxSalary = totalSalary;
      if (totalSalary > 0) {
        const totalTax = calculateTotalTax(totalSalary); // Use default settings from popup
        afterTaxSalary = totalSalary - totalTax;
      }
      
      // Check if the Total value is bold
      const isTotalBold = totalValueElement.className.includes('css-xj4mea');
      
      // Check if this row has an after-tax cell already
      let afterTaxCell;
      if (afterTaxColumnIndex < cells.length) {
        afterTaxCell = cells[afterTaxColumnIndex];
      }
      
      if (!afterTaxCell) {
        // Create a new cell if it doesn't exist
        afterTaxCell = document.createElement('td');
        afterTaxCell.className = totalCell.className;
        
        // Create the value element
        const valueElement = document.createElement('h6');
        valueElement.className = isTotalBold ? 'MuiTypography-root MuiTypography-subtitle1 css-xj4mea' : totalValueElement.className;
        valueElement.textContent = formatSalary(afterTaxSalary);
        
        afterTaxCell.appendChild(valueElement);
        
        // Insert at the right position
        if (afterTaxColumnIndex < cells.length) {
          row.insertBefore(afterTaxCell, cells[afterTaxColumnIndex]);
        } else {
          row.appendChild(afterTaxCell);
        }
      } else {
        // Update existing cell
        let valueElement = afterTaxCell.querySelector('h6');
        
        if (!valueElement) {
          // Create value element if it doesn't exist
          valueElement = document.createElement('h6');
          valueElement.className = isTotalBold ? 'MuiTypography-root MuiTypography-subtitle1 css-xj4mea' : totalValueElement.className;
          afterTaxCell.appendChild(valueElement);
        }
        
        // Always update the value
        valueElement.textContent = formatSalary(afterTaxSalary);
        
        // Ensure proper styling
        if (isTotalBold && !valueElement.className.includes('css-xj4mea')) {
          valueElement.className = 'MuiTypography-root MuiTypography-subtitle1 css-xj4mea';
        } else if (!isTotalBold && valueElement.className.includes('css-xj4mea')) {
          valueElement.className = 'MuiTypography-root MuiTypography-subtitle1 css-6xe2a5';
        }
      }
    });
  });
}

function duplicateCompensationElements() {
    // First check if we already added the after-tax elements
    const existingAfterTaxLabel = Array.from(document.querySelectorAll('dt[class*="level_breakdownLabel"]'))
        .find(el => el.textContent.startsWith("After Tax"));
    if (existingAfterTaxLabel) {
        return; // Exit if we already added the elements
    }

    const labelElement = document.querySelector('dt[class*="level_breakdownLabel"]');
    const valueElement = document.querySelector('dd[class*="level_totalComp"]');

    if (labelElement && valueElement) {
        // Create clones
        const labelClone = labelElement.cloneNode(true);
        const valueClone = valueElement.cloneNode(true);

        // Function to update label text with current settings
        const updateLabelText = () => {
            const stateAbbr = taxSettings.state;
            const filingStatusAbbr = taxSettings.filingStatus === 'Married Filing Jointly' ? 'Joint' : 
                                   taxSettings.filingStatus === 'Head of Household' ? 'Head' : 'Single';
            labelClone.textContent = `After Tax ${formatAfterTaxLabel(stateAbbr, filingStatusAbbr)}`;
        };

        // Set initial label text
        updateLabelText();

        // Function to update after-tax value
        const updateAfterTaxValue = () => {
            const totalSalary = parseSalaryString(valueElement.textContent);
            let afterTaxSalary = totalSalary;
            if (totalSalary > 0) {
                const totalTax = calculateTotalTax(totalSalary);
                afterTaxSalary = totalSalary - totalTax;
            }
            valueClone.textContent = formatExactSalary(afterTaxSalary);
        };

        // Insert clones into DOM
        valueElement.parentNode.insertBefore(labelClone, valueElement.nextSibling);
        labelClone.parentNode.insertBefore(valueClone, labelClone.nextSibling);

        // Initial update once settings are loaded
        chrome.storage.sync.get(['taxSettings'], function(result) {
            if (result.taxSettings) {
                taxSettings = result.taxSettings;
                updateAfterTaxValue();
            }
        });

        // Set up observer for value changes
        const valueObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'characterData' || mutation.type === 'childList') {
                    updateAfterTaxValue();
                }
            });
        });

        valueObserver.observe(valueElement, {
            characterData: true,
            childList: true,
            subtree: true
        });

        // Listen for settings changes
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes.taxSettings) {
                taxSettings = changes.taxSettings.newValue;
                updateLabelText();
                updateAfterTaxValue();
            }
        });
    }
}

// Set up a separate observer for compensation elements
const compensationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (mutation.type === 'childList') {
            const labelElement = document.querySelector('dt[class*="level_breakdownLabel"]');
            const valueElement = document.querySelector('dd[class*="level_totalComp"]');
            
            if (labelElement && valueElement) {
                // Wait for settings to be loaded before adding elements
                chrome.storage.sync.get(['taxSettings'], function(result) {
                    if (result.taxSettings) {
                        taxSettings = result.taxSettings;
                        duplicateCompensationElements();
                    }
                });
            }
        }
    }
});

// Start observing the document for compensation elements
compensationObserver.observe(document.body, {
    childList: true,
    subtree: true
});

// Function to add After Tax column for detailed compensation tables
function addAfterTaxDetailedColumn() {
  console.log('Taxes.fyi: Looking for detailed compensation tables...');
  
  // Find tables with detailed compensation headers (using flexible selector for CSS modules)
  const detailedHeaders = document.querySelectorAll('th p[class*="salary-table_sortTableHeaderText"]');
  
  detailedHeaders.forEach((header, index) => {
    if (header.textContent.includes('Total Compensation')) {
      const headerCell = header.closest('th');
      const table = headerCell.closest('table');
      const headerRow = headerCell.closest('tr');
      
      // Check if we already added the column
      const existingDetailedHeader = Array.from(headerRow.querySelectorAll('th'))
        .find(th => th.querySelector('p[class*="salary-table_sortTableHeaderText"]')?.textContent.includes('After Tax'));
      
      if (existingDetailedHeader) return;
      
      // Create new header cell with same styling as original
      const newHeaderCell = document.createElement('th');
      newHeaderCell.className = headerCell.className;
      newHeaderCell.setAttribute('scope', 'col');
      
      // Create header content with simpler text
      const sortLabel = document.createElement('span');
      sortLabel.className = 'MuiButtonBase-root MuiTableSortLabel-root css-1x860jj';
      sortLabel.setAttribute('tabindex', '0');
      sortLabel.setAttribute('role', 'button');
      
      const headerDiv = document.createElement('div');
      headerDiv.className = 'salary-table_sortTableHeader__9OJDE';
      
      const headerText = document.createElement('p');
      headerText.className = 'MuiTypography-root MuiTypography-body2 salary-table_sortTableHeaderText__IE_ZE css-2o2hpw';
      headerText.textContent = 'After Tax';
      headerDiv.appendChild(headerText);
      
      const subText = document.createElement('span');
      subText.className = 'MuiTypography-root MuiTypography-caption css-12nofzu';
      subText.textContent = '(By location)';
      headerDiv.appendChild(subText);
      
      sortLabel.appendChild(headerDiv);
      newHeaderCell.appendChild(sortLabel);
      
      // Insert the new header cell
      headerCell.parentNode.insertBefore(newHeaderCell, headerCell.nextSibling);
      
      // Add after-tax values to each row
      const rows = table.querySelectorAll('tbody tr');
      const headerIndex = Array.from(headerRow.children).indexOf(headerCell);
      
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (headerIndex >= cells.length) return;
        
        const totalCell = cells[headerIndex];
        const totalValueElement = totalCell.querySelector('.MuiTypography-body1');
        
        if (!totalValueElement) return;
        
        const totalValue = parseSalaryString(totalValueElement.textContent);
        const location = parseLocationFromRow(row);
        
        // Create new cell with same structure
        const newCell = document.createElement('td');
        newCell.className = 'MuiTableCell-root MuiTableCell-body MuiTableCell-alignRight MuiTableCell-sizeMedium salary-row_totalCompCell__553Rk css-1b6bj08';
        
        const outerBox = document.createElement('div');
        outerBox.className = 'MuiBox-root css-77dmha';
        
        const emptyDiv = document.createElement('div');
        const contentBox = document.createElement('div');
        contentBox.className = 'MuiBox-root css-0';
        
        const mainValue = document.createElement('p');
        mainValue.className = 'MuiTypography-root MuiTypography-body1 css-4g68tt';
        
        // Calculate after-tax value or show $--- for unsupported locations
        if (totalValue > 0 && location) {
          const totalTax = calculateTotalTax(totalValue, location);
          if (totalTax !== null) {
            mainValue.textContent = formatExactSalary(totalValue - totalTax);
          } else {
            mainValue.textContent = '$---';
          }
        } else {
          mainValue.textContent = '$---';
        }
        
        contentBox.appendChild(mainValue);
        outerBox.appendChild(emptyDiv);
        outerBox.appendChild(contentBox);
        newCell.appendChild(outerBox);
        
        // Insert the new cell
        if (headerIndex + 1 < cells.length) {
          row.insertBefore(newCell, cells[headerIndex + 1]);
        } else {
          row.appendChild(newCell);
        }
      });
    }
  });
}

// Add observer for detailed compensation tables
const detailedTableObserver = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    if (mutation.type === 'childList') {
      const addedNodes = Array.from(mutation.addedNodes);
      const hasDetailedTable = addedNodes.some(node => 
        node.nodeType === 1 && node.querySelector?.('p[class*="salary-table_sortTableHeaderText"]')
      );
      
      if (hasDetailedTable) {
        setTimeout(addAfterTaxDetailedColumn, 500);
      }
    }
  });
});

// Start observing for detailed tables
detailedTableObserver.observe(document.body, {
  childList: true,
  subtree: true
});

// Function to duplicate median elements and show after-tax values
function duplicateMedianElements() {
    // Check if already added
    const existingAfterTaxMedian = Array.from(document.querySelectorAll('[class*="percentiles_percentileLabel"]'))
        .find(el => el.textContent.includes('After Tax'));
    if (existingAfterTaxMedian) return;

    const amountElement = document.querySelector('[class*="percentiles_medianAmount"]');
    const labelElement = document.querySelector('[class*="percentiles_percentileLabel"]');

    if (amountElement && labelElement) {
        // Create clones
        const amountClone = amountElement.cloneNode(true);
        const labelClone = labelElement.cloneNode(true);

        // Get location info
        const location = getLocationFromURL();
        
        // Update label text based on whether we have location info
        if (location) {
            labelClone.textContent = `After Tax (${location.city})`;
        } else {
            const stateAbbr = taxSettings.state;
            const filingStatusAbbr = taxSettings.filingStatus === 'Married Filing Jointly' ? 'Joint' : 
                                   taxSettings.filingStatus === 'Head of Household' ? 'Head' : 'Single';
            labelClone.textContent = `After Tax ${formatAfterTaxLabel(stateAbbr, filingStatusAbbr)}`;
        }

        // Calculate after-tax amount
        const totalSalary = parseSalaryString(amountElement.textContent);
        if (totalSalary > 0) {
            // Use location-based calculation if available, otherwise use settings
            const totalTax = location ? calculateTotalTax(totalSalary, location) : calculateTotalTax(totalSalary);
            const afterTaxSalary = totalSalary - totalTax;
            amountClone.textContent = formatExactSalary(afterTaxSalary);
        }

        // Insert clones into DOM
        labelElement.parentNode.insertBefore(amountClone, labelElement.nextSibling);
        amountClone.parentNode.insertBefore(labelClone, amountClone.nextSibling);

        // Listen for settings changes
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes.taxSettings) {
                const newSettings = changes.taxSettings.newValue;
                const newLocation = getLocationFromURL();
                
                // Update label
                if (newLocation) {
                    labelClone.textContent = `After Tax (${newLocation.city})`;
                } else {
                    const stateAbbr = newSettings.state;
                    const filingStatusAbbr = newSettings.filingStatus === 'Married Filing Jointly' ? 'Joint' : 
                                           newSettings.filingStatus === 'Head of Household' ? 'Head' : 'Single';
                    labelClone.textContent = `After Tax ${formatAfterTaxLabel(stateAbbr, filingStatusAbbr)}`;
                }
                
                // Update amount
                if (totalSalary > 0) {
                    const newTotalTax = newLocation ? calculateTotalTax(totalSalary, newLocation) : calculateTotalTax(totalSalary);
                    const newAfterTaxSalary = totalSalary - newTotalTax;
                    amountClone.textContent = formatExactSalary(newAfterTaxSalary);
                }
            }
        });
    }
}

// Function to duplicate percentile elements with the same pattern
function duplicatePercentileElements() {
    // Check if already added
    const existingAfterTaxPercentile = Array.from(document.querySelectorAll('[class*="percentiles_percentileLabel"]'))
        .find(el => el.textContent.includes('After Tax 25th%'));
    if (existingAfterTaxPercentile) return;

    const barElement = document.querySelector('[class*="percentiles_percentileBar"]');
    const amountElement = document.querySelector('[class*="percentiles_percentileBar"] + .css-es1xmb');
    const labelElement = document.querySelector('[class*="percentiles_percentileBar"] + .css-es1xmb + [class*="percentiles_percentileLabel"]');

    if (barElement && amountElement && labelElement) {
        // Create clones
        const barClone = barElement.cloneNode(true);
        const amountClone = amountElement.cloneNode(true);
        const labelClone = labelElement.cloneNode(true);

        // Always show the label as "After Tax 25th%"
        labelClone.textContent = 'After Tax 25th%';

        // Calculate after-tax amount using location or settings
        const totalSalary = parseSalaryString(amountElement.textContent);
        if (totalSalary > 0) {
            const location = getLocationFromURL();
            const totalTax = location ? calculateTotalTax(totalSalary, location) : calculateTotalTax(totalSalary);
            const afterTaxSalary = totalSalary - totalTax;
            amountClone.textContent = formatExactSalary(afterTaxSalary);

            // Adjust bar width
            const ratio = afterTaxSalary / totalSalary;
            const originalWidth = window.getComputedStyle(barElement).width;
            barClone.style.width = `${parseFloat(originalWidth) * ratio}px`;
        }

        // Insert clones into DOM
        const container = barElement.parentNode;
        container.insertBefore(barClone, labelElement.nextSibling);
        container.insertBefore(amountClone, barClone.nextSibling);
        container.insertBefore(labelClone, amountClone.nextSibling);

        // Listen for settings changes
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes.taxSettings) {
                const newLocation = getLocationFromURL();
                
                // Update amount and bar
                if (totalSalary > 0) {
                    const newTotalTax = newLocation ? calculateTotalTax(totalSalary, newLocation) : calculateTotalTax(totalSalary);
                    const newAfterTaxSalary = totalSalary - newTotalTax;
                    amountClone.textContent = formatExactSalary(newAfterTaxSalary);
                    
                    // Update bar width
                    const ratio = newAfterTaxSalary / totalSalary;
                    const originalWidth = window.getComputedStyle(barElement).width;
                    barClone.style.width = `${parseFloat(originalWidth) * ratio}px`;
                }
            }
        });
    }
}

// Update 75th and 90th percentile functions similarly
function duplicate75thPercentileElements() {
    const existingAfterTax75thPercentile = Array.from(document.querySelectorAll('[class*="percentiles_percentileLabel"]'))
        .find(el => el.textContent.includes('After Tax 75th%'));
    if (existingAfterTax75thPercentile) return;

    const allBars = document.querySelectorAll('[class*="percentiles_percentileBar"]');
    const barElement = Array.from(allBars).find((bar, index) => {
        const nextLabel = bar.parentNode.querySelector('[class*="percentiles_percentileLabel"]');
        return nextLabel && nextLabel.textContent.includes('75th%');
    });

    if (!barElement) return;

    const container = barElement.parentNode;
    const amountElement = container.querySelector('.css-es1xmb');
    const labelElement = container.querySelector('[class*="percentiles_percentileLabel"]');

    if (barElement && amountElement && labelElement) {
        const barClone = barElement.cloneNode(true);
        const amountClone = amountElement.cloneNode(true);
        const labelClone = labelElement.cloneNode(true);

        labelClone.textContent = 'After Tax 75th%';

        const totalSalary = parseSalaryString(amountElement.textContent);
        if (totalSalary > 0) {
            const location = getLocationFromURL();
            const totalTax = location ? calculateTotalTax(totalSalary, location) : calculateTotalTax(totalSalary);
            const afterTaxSalary = totalSalary - totalTax;
            amountClone.textContent = formatExactSalary(afterTaxSalary);

            const ratio = afterTaxSalary / totalSalary;
            const originalWidth = window.getComputedStyle(barElement).width;
            barClone.style.width = `${parseFloat(originalWidth) * ratio}px`;
        }

        container.insertBefore(barClone, labelElement.nextSibling);
        container.insertBefore(amountClone, barClone.nextSibling);
        container.insertBefore(labelClone, amountClone.nextSibling);

        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes.taxSettings) {
                const newLocation = getLocationFromURL();
                
                if (totalSalary > 0) {
                    const newTotalTax = newLocation ? calculateTotalTax(totalSalary, newLocation) : calculateTotalTax(totalSalary);
                    const newAfterTaxSalary = totalSalary - newTotalTax;
                    amountClone.textContent = formatExactSalary(newAfterTaxSalary);
                    
                    const ratio = newAfterTaxSalary / totalSalary;
                    const originalWidth = window.getComputedStyle(barElement).width;
                    barClone.style.width = `${parseFloat(originalWidth) * ratio}px`;
                }
            }
        });
    }
}

function duplicate90thPercentileElements() {
    const existingAfterTax90thPercentile = Array.from(document.querySelectorAll('[class*="percentiles_percentileLabel"]'))
        .find(el => el.textContent.includes('After Tax 90th%'));
    if (existingAfterTax90thPercentile) return;

    const allBars = document.querySelectorAll('[class*="percentiles_percentileBar"]');
    const barElement = Array.from(allBars).find((bar, index) => {
        const nextLabel = bar.parentNode.querySelector('[class*="percentiles_percentileLabel"]');
        return nextLabel && nextLabel.textContent.includes('90th%');
    });

    if (!barElement) return;

    const container = barElement.parentNode;
    const amountElement = container.querySelector('.css-es1xmb');
    const labelElement = container.querySelector('[class*="percentiles_percentileLabel"]');

    if (barElement && amountElement && labelElement) {
        const barClone = barElement.cloneNode(true);
        const amountClone = amountElement.cloneNode(true);
        const labelClone = labelElement.cloneNode(true);

        labelClone.textContent = 'After Tax 90th%';

        const totalSalary = parseSalaryString(amountElement.textContent);
        if (totalSalary > 0) {
            const location = getLocationFromURL();
            const totalTax = location ? calculateTotalTax(totalSalary, location) : calculateTotalTax(totalSalary);
            const afterTaxSalary = totalSalary - totalTax;
            amountClone.textContent = formatExactSalary(afterTaxSalary);

            const ratio = afterTaxSalary / totalSalary;
            const originalWidth = window.getComputedStyle(barElement).width;
            barClone.style.width = `${parseFloat(originalWidth) * ratio}px`;
        }

        container.insertBefore(barClone, labelElement.nextSibling);
        container.insertBefore(amountClone, barClone.nextSibling);
        container.insertBefore(labelClone, amountClone.nextSibling);

        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes.taxSettings) {
                const newLocation = getLocationFromURL();
                
                if (totalSalary > 0) {
                    const newTotalTax = newLocation ? calculateTotalTax(totalSalary, newLocation) : calculateTotalTax(totalSalary);
                    const newAfterTaxSalary = totalSalary - newTotalTax;
                    amountClone.textContent = formatExactSalary(newAfterTaxSalary);
                    
                    const ratio = newAfterTaxSalary / totalSalary;
                    const originalWidth = window.getComputedStyle(barElement).width;
                    barClone.style.width = `${parseFloat(originalWidth) * ratio}px`;
                }
            }
        });
    }
}

// Modify medianObserver to check for all percentile elements
const medianObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (mutation.type === 'childList') {
            const medianAmount = document.querySelector('[class*="percentiles_medianAmount"]');
            const medianLabel = document.querySelector('[class*="percentiles_percentileLabel"]');
            
            if (medianAmount && medianLabel) {
                chrome.storage.sync.get(['taxSettings'], function(result) {
                    if (result.taxSettings) {
                        taxSettings = result.taxSettings;
                        duplicateMedianElements();
                    }
                });
            }

            const allBars = document.querySelectorAll('[class*="percentiles_percentileBar"]');
            const labels = document.querySelectorAll('[class*="percentiles_percentileLabel"]');
            
            const has25thPercentile = Array.from(labels).some(label => label.textContent.includes('25th%'));
            const has75thPercentile = Array.from(labels).some(label => label.textContent.includes('75th%'));
            const has90thPercentile = Array.from(labels).some(label => label.textContent.includes('90th%'));
            
            if (has25thPercentile || has75thPercentile || has90thPercentile) {
                chrome.storage.sync.get(['taxSettings'], function(result) {
                    if (result.taxSettings) {
                        taxSettings = result.taxSettings;
                        if (has25thPercentile) duplicatePercentileElements();
                        if (has75thPercentile) duplicate75thPercentileElements();
                        if (has90thPercentile) duplicate90thPercentileElements();
                    }
                });
            }
        }
    }
});

// Start observing for median and percentile elements
medianObserver.observe(document.body, {
    childList: true,
    subtree: true
});

// Enhanced URL change detection
let lastUrl = location.href;
let isReloading = false;
let reloadTimeout = null;

// Function to safely reload the page
function safeReload() {
  if (isReloading) return;
  isReloading = true;
  
  // Clear any pending reload
  if (reloadTimeout) clearTimeout(reloadTimeout);
  
  console.log('Taxes.fyi: URL changed from', lastUrl, 'to', location.href);
  lastUrl = location.href;
  
  reloadTimeout = setTimeout(() => {
    console.log('Taxes.fyi: Reloading page');
    window.location.reload();
  }, 100);
}

// Monitor URL changes using multiple methods
function checkUrlChange() {
  if (location.href !== lastUrl) {
    safeReload();
  }
}

// Check URL changes frequently
setInterval(checkUrlChange, 50);

// Listen for navigation events
window.addEventListener('popstate', safeReload);
window.addEventListener('hashchange', safeReload);

// Listen for React router changes
document.addEventListener('click', function(e) {
  const isNavElement = e.target.closest('a[href], button[role="link"], [data-testid="link"], .css-4g6ai3');
  if (isNavElement) {
    setTimeout(checkUrlChange, 50);
  }
});

// Override history methods
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function() {
  originalPushState.apply(this, arguments);
  setTimeout(checkUrlChange, 50);
};

history.replaceState = function() {
  originalReplaceState.apply(this, arguments);
  setTimeout(checkUrlChange, 50);
};

// Monitor DOM changes that might indicate navigation
const navigationObserver = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    safeReload();
  }
});

navigationObserver.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['href', 'pathname']
});