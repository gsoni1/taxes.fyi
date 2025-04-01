// content.js - Script that runs on levels.fyi pages

// Default settings
let taxSettings = {
  state: 'CA',
  filingStatus: 'Single'
};

let columnSettings = {
  addNewColumn: false // Default to not creating a new column when updating
};

// Load user settings from storage
chrome.storage.sync.get(['taxSettings', 'columnSettings'], function(result) {
  if (result.taxSettings) {
    taxSettings = result.taxSettings;
  }
  
  if (result.columnSettings) {
    columnSettings = result.columnSettings;
  }
  
  // Run on page load
  document.addEventListener('DOMContentLoaded', function() {
    console.log('Taxes.fyi: DOM fully loaded');
    setTimeout(addAfterTaxColumn, 1000); // Wait a bit for any dynamic content
  });
  
  // Also run now in case DOMContentLoaded already fired
  setTimeout(addAfterTaxColumn, 1000);
});

// Tax calculation functions
function calculateFederalTax(salary, filingStatus) {
  // 2023 Federal tax brackets (simplified)
  let brackets;
  
  if (filingStatus === 'Single') {
    brackets = [
      { threshold: 0, rate: 0.10 },
      { threshold: 11000, rate: 0.12 },
      { threshold: 44725, rate: 0.22 },
      { threshold: 95375, rate: 0.24 },
      { threshold: 182100, rate: 0.32 },
      { threshold: 231250, rate: 0.35 },
      { threshold: 578125, rate: 0.37 }
    ];
  } else if (filingStatus === 'Married Filing Jointly') {
    brackets = [
      { threshold: 0, rate: 0.10 },
      { threshold: 22000, rate: 0.12 },
      { threshold: 89450, rate: 0.22 },
      { threshold: 190750, rate: 0.24 },
      { threshold: 364200, rate: 0.32 },
      { threshold: 462500, rate: 0.35 },
      { threshold: 693750, rate: 0.37 }
    ];
  } else { // Head of Household
    brackets = [
      { threshold: 0, rate: 0.10 },
      { threshold: 15700, rate: 0.12 },
      { threshold: 59850, rate: 0.22 },
      { threshold: 95350, rate: 0.24 },
      { threshold: 182100, rate: 0.32 },
      { threshold: 231250, rate: 0.35 },
      { threshold: 578100, rate: 0.37 }
    ];
  }
  
  // Standard deduction based on filing status
  let standardDeduction = filingStatus === 'Married Filing Jointly' ? 27700 : 
                          filingStatus === 'Head of Household' ? 20800 : 13850;
  
  // Taxable income after standard deduction
  let taxableIncome = Math.max(0, salary - standardDeduction);
  
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
  
  return tax;
}

function calculateStateTax(salary, state, filingStatus) {
  // Simplified state tax rates (approximate)
  const stateRates = {
    'CA': 0.093, // California has high progressive rates
    'NY': 0.065, // New York has moderately high rates
    'TX': 0,     // Texas has no state income tax
    'WA': 0      // Washington has no state income tax
  };
  
  // Apply a simple flat rate for simplicity
  // A more accurate calculation would use progressive brackets for each state
  return salary * stateRates[state];
}

function calculateFICATax(salary) {
  // Social Security (6.2% up to wage base limit of $160,200 for 2023)
  const socialSecurityTax = Math.min(salary, 160200) * 0.062;
  
  // Medicare (1.45% on all earnings, plus 0.9% on earnings over $200,000)
  let medicareTax = salary * 0.0145;
  if (salary > 200000) {
    medicareTax += (salary - 200000) * 0.009;
  }
  
  return socialSecurityTax + medicareTax;
}

function calculateTotalTax(salary) {
  const federalTax = calculateFederalTax(salary, taxSettings.filingStatus);
  const stateTax = calculateStateTax(salary, taxSettings.state, taxSettings.filingStatus);
  const ficaTax = calculateFICATax(salary);
  
  return federalTax + stateTax + ficaTax;
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
  
  if (value >= 1000000) {
    return "$" + (value / 1000000).toFixed(2) + "M";
  } else {
    return "$" + (value / 1000).toFixed(1) + "K";
  }
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
      
      // Find the Total column
      const headerCells = headerRow.querySelectorAll('th');
      let totalColumnIndex = -1;
      
      for (let i = 0; i < headerCells.length; i++) {
        const headerText = headerCells[i].textContent.trim();
        if (headerText.includes('Total')) {
          totalColumnIndex = i;
          break;
        }
      }
      
      if (totalColumnIndex === -1) {
        console.log(`Taxes.fyi: No Total column found in table ${tableIndex}`);
        return;
      }
      
      console.log(`Taxes.fyi: Found Total column at index ${totalColumnIndex} in table ${tableIndex}`);
      
      // Create the After Tax header cell
      const totalHeaderCell = headerCells[totalColumnIndex];
      const newHeaderCell = document.createElement('th');
      newHeaderCell.className = totalHeaderCell.className;
      newHeaderCell.setAttribute('scope', 'col');
      
      const headerTitle = document.createElement('h6');
      headerTitle.className = totalHeaderCell.querySelector('h6').className;
      headerTitle.textContent = 'After Tax ';
      
      // Add state and filing status in parentheses
      const stateAbbr = taxSettings.state;
      const filingStatusAbbr = taxSettings.filingStatus === 'Married Filing Jointly' ? 'Joint' : 
                               taxSettings.filingStatus === 'Head of Household' ? 'Head' : 'Single';
      
      const infoSpan = document.createElement('span');
      infoSpan.className = 'MuiTypography-root MuiTypography-caption job-family_secondary__YtLA8 css-b4wlzm';
      infoSpan.textContent = `(${stateAbbr}, ${filingStatusAbbr})`;
      
      newHeaderCell.appendChild(headerTitle);
      newHeaderCell.appendChild(infoSpan);
      
      // Insert the new header cell after the Total column
      if (totalColumnIndex + 1 < headerCells.length) {
        headerRow.insertBefore(newHeaderCell, headerCells[totalColumnIndex + 1]);
      } else {
        headerRow.appendChild(newHeaderCell);
      }
      
      // Now add the After Tax cells to each row
      const rows = table.querySelectorAll('tbody tr');
      
      rows.forEach((row, rowIndex) => {
        const cells = row.querySelectorAll('td');
        
        if (totalColumnIndex >= cells.length) {
          console.log(`Taxes.fyi: Row ${rowIndex} doesn't have enough cells`);
          return;
        }
        
        const totalCell = cells[totalColumnIndex];
        const totalValueElement = totalCell.querySelector('h6');
        
        if (!totalValueElement) {
          console.log(`Taxes.fyi: No salary value found in row ${rowIndex}`);
          return;
        }
        
        const totalSalaryText = totalValueElement.textContent;
        const totalSalary = parseSalaryString(totalSalaryText);
        
        // Calculate after-tax salary
        let afterTaxSalary = totalSalary;
        if (totalSalary > 0) {
          const totalTax = calculateTotalTax(totalSalary);
          afterTaxSalary = totalSalary - totalTax;
        }
        
        // Create the new cell
        const newCell = document.createElement('td');
        newCell.className = totalCell.className;
        
        const valueElement = document.createElement('h6');
        valueElement.className = totalValueElement.className;
        valueElement.textContent = formatSalary(afterTaxSalary);
        
        newCell.appendChild(valueElement);
        
        // Insert the new cell after the Total column
        if (totalColumnIndex + 1 < cells.length) {
          row.insertBefore(newCell, cells[totalColumnIndex + 1]);
        } else {
          row.appendChild(newCell);
        }
      });
      
      console.log(`Taxes.fyi: Successfully modified table ${tableIndex}`);
    } catch (error) {
      console.error(`Taxes.fyi: Error modifying table ${tableIndex}:`, error);
    }
  });
}

// Listen for changes to settings
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'sync') {
    // Update tax settings if they changed
    if (changes.taxSettings) {
      console.log('Taxes.fyi: Tax settings changed, updating calculations...');
      taxSettings = changes.taxSettings.newValue;
      
      // Check if we should create a new column
      const shouldAddNewColumn = columnSettings.addNewColumn;
      
      if (shouldAddNewColumn) {
        // Remove existing after-tax columns
        const afterTaxHeaders = document.querySelectorAll('th h6');
        afterTaxHeaders.forEach(header => {
          if (header.textContent.trim() === 'After Tax ') {
            const column = header.closest('th');
            const table = column.closest('table');
            const headerRow = column.parentNode;
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
          }
        });
        
        // Add new after-tax columns with updated calculations
        setTimeout(addAfterTaxColumn, 500);
      } else {
        // Just update the values in the existing cells
        updateAfterTaxValues();
      }
    }
    
    // Update column settings if they changed
    if (changes.columnSettings) {
      console.log('Taxes.fyi: Column settings changed');
      columnSettings = changes.columnSettings.newValue;
    }
  }
});

// Function to update the values in existing After Tax cells without recreating the column
function updateAfterTaxValues() {
  console.log('Taxes.fyi: Updating existing After Tax values...');
  
  const tables = document.querySelectorAll('.MuiTable-root');
  
  tables.forEach((table, tableIndex) => {
    try {
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
      infoSpan.textContent = `(${stateAbbr}, ${filingStatusAbbr})`;
      
      // Update the After Tax values in each row
      const rows = table.querySelectorAll('tbody tr');
      
      rows.forEach((row) => {
        const cells = row.querySelectorAll('td');
        
        if (totalColumnIndex >= cells.length || afterTaxColumnIndex >= cells.length) return;
        
        const totalCell = cells[totalColumnIndex];
        const afterTaxCell = cells[afterTaxColumnIndex];
        const totalValueElement = totalCell.querySelector('h6');
        const afterTaxValueElement = afterTaxCell.querySelector('h6');
        
        if (!totalValueElement || !afterTaxValueElement) return;
        
        const totalSalaryText = totalValueElement.textContent;
        const totalSalary = parseSalaryString(totalSalaryText);
        
        // Calculate after-tax salary
        let afterTaxSalary = totalSalary;
        if (totalSalary > 0) {
          const totalTax = calculateTotalTax(totalSalary);
          afterTaxSalary = totalSalary - totalTax;
        }
        
        // Update the after-tax value
        afterTaxValueElement.textContent = formatSalary(afterTaxSalary);
      });
      
      console.log(`Taxes.fyi: Updated values in table ${tableIndex}`);
    } catch (error) {
      console.error(`Taxes.fyi: Error updating values in table ${tableIndex}:`, error);
    }
  });
}

// Set up a MutationObserver to detect when new tables are added
const observer = new MutationObserver(function(mutations) {
  let shouldCheck = false;
  
  // Check if any tables were added
  mutations.forEach(mutation => {
    if (mutation.type === 'childList') {
      const addedNodes = Array.from(mutation.addedNodes);
      const hasTable = addedNodes.some(node => {
        return node.nodeType === 1 && (
          node.classList && node.classList.contains('MuiTable-root') ||
          node.querySelector && node.querySelector('.MuiTable-root')
        );
      });
      
      if (hasTable) {
        shouldCheck = true;
      }
    }
  });
  
  if (shouldCheck) {
    console.log('Taxes.fyi: New table detected, checking for modifications...');
    setTimeout(addAfterTaxColumn, 1000);
  }
});

// Start observing the document
observer.observe(document.body, { childList: true, subtree: true });

// Initial run
console.log('Taxes.fyi: Extension loaded');
