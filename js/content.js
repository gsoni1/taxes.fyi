// content.js - Script that runs on levels.fyi pages

// Default settings
let taxSettings = {
  state: 'WA',
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
      { threshold: 11601, rate: 0.12 },
      { threshold: 47151, rate: 0.22 },
      { threshold: 100526, rate: 0.24 },
      { threshold: 191951, rate: 0.32 },
      { threshold: 243726, rate: 0.35 },
      { threshold: 609351, rate: 0.37 }
    ];
  } else if (filingStatus === 'Married Filing Jointly') {
    brackets = [
      { threshold: 0, rate: 0.10 },
      { threshold: 23201, rate: 0.12 },
      { threshold: 94301, rate: 0.22 },
      { threshold: 201051, rate: 0.24 },
      { threshold: 383901, rate: 0.32 },
      { threshold: 487451, rate: 0.35 },
      { threshold: 731201, rate: 0.37 }
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
    standardDeduction = 27700;
  } else if (filingStatus === 'Married Filing Separately') {
    standardDeduction = 13850;
  } else if (filingStatus === 'Head of Household') {
    standardDeduction = 20800;
  } else { // Single
    standardDeduction = 13850;
  }
  
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
  // State tax brackets for 2023
  let brackets = [];
  let standardDeduction = 0;
  
  // Define brackets based on state and filing status
  if (state === 'CA') {
    // California tax brackets
    if (filingStatus === 'Single' || filingStatus === 'Married Filing Separately') {
      standardDeduction = 5202;
      brackets = [
        { threshold: 0, rate: 0.01 },
        { threshold: 10412, rate: 0.02 },
        { threshold: 24684, rate: 0.04 },
        { threshold: 38959, rate: 0.06 },
        { threshold: 54081, rate: 0.08 },
        { threshold: 68350, rate: 0.093 },
        { threshold: 349137, rate: 0.103 },
        { threshold: 418961, rate: 0.113 },
        { threshold: 698272, rate: 0.123 }
      ];
    } else if (filingStatus === 'Married Filing Jointly') {
      standardDeduction = 10404;
      brackets = [
        { threshold: 0, rate: 0.01 },
        { threshold: 20824, rate: 0.02 },
        { threshold: 49368, rate: 0.04 },
        { threshold: 77918, rate: 0.06 },
        { threshold: 108162, rate: 0.08 },
        { threshold: 136700, rate: 0.093 },
        { threshold: 698274, rate: 0.103 },
        { threshold: 837922, rate: 0.113 },
        { threshold: 1396544, rate: 0.123 }
      ];
    } else { // Head of Household
      standardDeduction = 10404;
      brackets = [
        { threshold: 0, rate: 0.01 },
        { threshold: 20888, rate: 0.02 },
        { threshold: 49461, rate: 0.04 },
        { threshold: 63729, rate: 0.06 },
        { threshold: 78435, rate: 0.08 },
        { threshold: 99379, rate: 0.093 },
        { threshold: 508500, rate: 0.103 },
        { threshold: 610380, rate: 0.113 },
        { threshold: 1017180, rate: 0.123 }
      ];
    }
  } else if (state === 'NY') {
    // New York tax brackets
    if (filingStatus === 'Single' || filingStatus === 'Married Filing Separately') {
      standardDeduction = 8000;
      brackets = [
        { threshold: 0, rate: 0.04 },
        { threshold: 13900, rate: 0.045 },
        { threshold: 80650, rate: 0.0525 },
        { threshold: 215400, rate: 0.0585 },
        { threshold: 1077550, rate: 0.0625 },
        { threshold: 5000000, rate: 0.0685 },
        { threshold: 25000000, rate: 0.0965 }
      ];
    } else if (filingStatus === 'Married Filing Jointly') {
      standardDeduction = 16050;
      brackets = [
        { threshold: 0, rate: 0.04 },
        { threshold: 27900, rate: 0.045 },
        { threshold: 161550, rate: 0.0525 },
        { threshold: 323200, rate: 0.0585 },
        { threshold: 2155350, rate: 0.0625 },
        { threshold: 5000000, rate: 0.0685 },
        { threshold: 25000000, rate: 0.0965 }
      ];
    } else { // Head of Household
      standardDeduction = 11200;
      brackets = [
        { threshold: 0, rate: 0.04 },
        { threshold: 20900, rate: 0.045 },
        { threshold: 107650, rate: 0.0525 },
        { threshold: 269300, rate: 0.0585 },
        { threshold: 1616450, rate: 0.0625 },
        { threshold: 5000000, rate: 0.0685 },
        { threshold: 25000000, rate: 0.0965 }
      ];
    }
  } else if (state === 'TX' || state === 'WA') {
    // Texas and Washington have no state income tax
    return 0;
  }
  
  // Taxable income after state standard deduction
  let taxableIncome = Math.max(0, salary - standardDeduction);
  
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
  
  return tax;
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
        
        // Check if the Total value is bold (has the css-xj4mea class)
        const isTotalBold = totalValueElement.className.includes('css-xj4mea');
        
        const valueElement = document.createElement('h6');
        // Use the same class as the Total value, including the bold class if present
        valueElement.className = isTotalBold ? 'MuiTypography-root MuiTypography-subtitle1 css-xj4mea' : totalValueElement.className;
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
      
      console.log(`Taxes.fyi: Updated values in table ${tableIndex}`);
    } catch (error) {
      console.error(`Taxes.fyi: Error updating values in table ${tableIndex}:`, error);
    }
  });
}

// Set up a MutationObserver to detect when new tables are added or content changes
const observer = new MutationObserver(function(mutations) {
  let shouldCheck = false;
  let shouldUpdateStyles = false;
  
  // Check mutations for table additions or style changes
  mutations.forEach(mutation => {
    if (mutation.type === 'childList') {
      const addedNodes = Array.from(mutation.addedNodes);
      
      // Check for new tables
      const hasTable = addedNodes.some(node => {
        return node.nodeType === 1 && (
          node.classList && node.classList.contains('MuiTable-root') ||
          node.querySelector && node.querySelector('.MuiTable-root')
        );
      });
      
      if (hasTable) {
        shouldCheck = true;
      }
      
      // Check for salary value changes (like when expanding a dropdown)
      const hasSalaryChanges = addedNodes.some(node => {
        return node.nodeType === 1 && (
          (node.tagName === 'H6' && node.closest('td')) ||
          node.querySelector && node.querySelector('h6')
        );
      });
      
      if (hasSalaryChanges) {
        shouldUpdateStyles = true;
      }
    } else if (mutation.type === 'attributes' && 
               mutation.target.tagName === 'H6' && 
               mutation.attributeName === 'class') {
      // Detect class changes on h6 elements (which could be salary values)
      shouldUpdateStyles = true;
    }
  });
  
  if (shouldCheck) {
    console.log('Taxes.fyi: New table detected, checking for modifications...');
    setTimeout(addAfterTaxColumn, 1000);
  }
  
  if (shouldUpdateStyles) {
    console.log('Taxes.fyi: Salary display changes detected, updating styles...');
    setTimeout(fixAfterTaxStyles, 500);
  }
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
      
      // Calculate after-tax salary
      let afterTaxSalary = totalSalary;
      if (totalSalary > 0) {
        const totalTax = calculateTotalTax(totalSalary);
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
