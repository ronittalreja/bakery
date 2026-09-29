// File: backend/utils/invoiceParser.js
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

class InvoiceParser {
  constructor() {
    this.supportedFormats = ['pdf', 'txt'];
  }

  /**
   * Parse invoice from text content
   * @param {string} textContent - Raw text from PDF
   * @returns {Object} Parsed invoice data
   */
  parseFromText(textContent) {
    try {
      const lines = textContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      // Debug: Log first 50 lines to see what we're working with
      console.log('=== PDF TEXT EXTRACTION DEBUG ===');
      console.log('Total lines:', lines.length);
      console.log('First 50 lines:');
      lines.slice(0, 50).forEach((line, index) => {
        console.log(`${index + 1}: ${line}`);
      });
      console.log('=== END DEBUG ===');
      
      // First, try to split into multiple invoices
      const invoices = this.splitIntoMultipleInvoices(lines);
      
      const parsedInvoices = [];
      
      console.log(`\n=== PROCESSING ${invoices.length} INVOICES ===`);
      
      // If we found multiple invoices, process them
      if (invoices.length > 1) {
        for (let i = 0; i < invoices.length; i++) {
          console.log(`\n--- Processing Invoice ${i + 1}/${invoices.length} ---`);
          const invoiceData = this.parseSingleInvoice(invoices[i], i);
          
          if (invoiceData && invoiceData.items && invoiceData.items.length > 0) {
            console.log(`Invoice ${i + 1} created with ${invoiceData.items.length} items`);
            parsedInvoices.push(invoiceData);
          } else {
            console.log(`Invoice ${i + 1} has no items, skipping`);
          }
        }
      } else {
        // If only one invoice or no clear splitting, treat the entire document as one invoice
        console.log(`\n--- Processing Single Invoice from entire document ---`);
        const invoiceData = this.parseSingleInvoice(lines, 0);
        
        if (invoiceData && invoiceData.items && invoiceData.items.length > 0) {
          console.log(`Single invoice created with ${invoiceData.items.length} items`);
          parsedInvoices.push(invoiceData);
        } else {
          console.log(`Single invoice has no items, skipping`);
        }
      }
      
      console.log(`\n=== FINAL RESULT: ${parsedInvoices.length} TOTAL INVOICES ===`);
      
      return {
        success: true,
        invoices: parsedInvoices,
        totalInvoices: parsedInvoices.length,
        debugInfo: {
          totalLines: lines.length,
          firstLines: lines.slice(0, 10)
        }
      };
    } catch (error) {
      console.error('Error parsing invoice text:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Split text into multiple invoices
   * @param {Array} lines - Array of text lines
   * @returns {Array} Array of invoice line arrays
   */
  splitIntoMultipleInvoices(lines) {
    console.log('=== INVOICE DETECTION DEBUG ===');
    console.log('Looking for invoice patterns...');

    // First pass: Find all invoice numbers and their positions
    const invoiceNumberPositions = [];
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/Invoice No\.?\s*:\s*([A-Z0-9\/]+)/i);
      if (match) {
        const invoiceNumber = match[1].trim();
        invoiceNumberPositions.push({ lineIndex: i, invoiceNumber: invoiceNumber });
        console.log(`Found invoice number "${invoiceNumber}" at line ${i + 1}`);
      }
    }

    console.log(`Found ${invoiceNumberPositions.length} invoice number occurrences`);

    // Group by unique invoice numbers (same invoice on multiple pages = one invoice)
    const uniqueInvoices = new Map();
    for (const pos of invoiceNumberPositions) {
      if (!uniqueInvoices.has(pos.invoiceNumber)) {
        uniqueInvoices.set(pos.invoiceNumber, []);
      }
      uniqueInvoices.get(pos.invoiceNumber).push(pos.lineIndex);
    }

    console.log(`Found ${uniqueInvoices.size} unique invoice numbers:`, Array.from(uniqueInvoices.keys()));

    // If no invoice numbers found, treat entire document as one invoice
    if (uniqueInvoices.size === 0) {
      console.log('No invoice numbers found, treating entire document as one invoice');
      return [lines];
    }

    // Second pass: Find all items and their positions
    const itemPositions = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\d+[A-Z0-9]{4,5}/.test(line)) {
        itemPositions.push(i);
      }
    }

    console.log(`Found ${itemPositions.length} item lines`);

    // Third pass: Assign each item to the closest preceding invoice number
    const invoiceGroups = new Map();
    uniqueInvoices.forEach((positions, invoiceNumber) => {
      invoiceGroups.set(invoiceNumber, []);
    });

    for (const itemIndex of itemPositions) {
      // Find the closest invoice number that comes before this item
      let closestInvoice = null;
      let closestDistance = Infinity;

      for (const [invoiceNumber, positions] of uniqueInvoices) {
        // Use the LAST occurrence of this invoice number before this item
        const validPositions = positions.filter(pos => pos <= itemIndex);
        if (validPositions.length > 0) {
          const lastPos = Math.max(...validPositions);
          const distance = itemIndex - lastPos;
          if (distance < closestDistance) {
            closestDistance = distance;
            closestInvoice = invoiceNumber;
          }
        }
      }

      if (closestInvoice) {
        invoiceGroups.get(closestInvoice).push(itemIndex);
      }
    }

    // Fourth pass: Create invoice line arrays based on grouped items
    const invoices = [];
    for (const [invoiceNumber, itemIndices] of invoiceGroups) {
      if (itemIndices.length === 0) {
        console.log(`Invoice ${invoiceNumber} has no items, skipping`);
        continue;
      }

      // Find the start and end lines for this invoice
      const startLine = Math.min(...itemIndices);
      const endLine = Math.max(...itemIndices) + 1;

      // Include context from the first invoice number occurrence to capture header
      const firstInvoicePos = Math.min(...uniqueInvoices.get(invoiceNumber));
      const contextStart = Math.max(0, firstInvoicePos);

      const invoiceLines = lines.slice(contextStart, endLine);
      invoices.push(invoiceLines);
      console.log(`Invoice ${invoiceNumber}: items ${itemIndices.length}, lines ${contextStart + 1} to ${endLine}  (${invoiceLines.length} lines)`);
    }

    console.log(`Total invoices with items: ${invoices.length}`);
    console.log('=== END INVOICE DETECTION ===');

    return invoices;
  }

  /**
   * Parse a single invoice
   * @param {Array} lines - Lines for a single invoice
   * @param {number} index - Invoice index
   * @returns {Object} Parsed invoice data
   */
  parseSingleInvoice(lines, index) {
    try {
      // Extract invoice number
      const invoiceNumber = this.extractInvoiceNumber(lines);
      
      // Extract date
      const date = this.extractDate(lines);
      
      // Extract store information
      const store = this.extractStoreInfo(lines);
      
      // Extract items
      const items = this.extractItems(lines);
      
      // Only proceed if we have items
      if (items.length === 0) {
        console.log(`Invoice ${index + 1} has no items, skipping detailed extraction`);
        return null;
      }
      
      // Calculate totals
      const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
      const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
      
      // Get page count
      const pageCount = this.getPageCount(lines);
      
      return {
        invoiceNo: invoiceNumber,
        invoiceDate: date,
        store: store,
        items: items,
        totalQty: totalQty,
        totalAmount: totalAmount,
        pageCount: pageCount,
        validation: {
          isToday: this.isToday(date),
          isCorrectStore: store.includes('R3309'),
          isValid: items.length > 0
        },
        index: index
      };
    } catch (error) {
      console.error(`Error parsing invoice ${index}:`, error);
      return null;
    }
  }

  /**
   * Extract invoice number
   * @param {Array} lines - Array of text lines
   * @returns {string|null} Invoice number
   */
  extractInvoiceNumber(lines) {
    for (const line of lines) {
      // Look for "Invoice No. : MUM2526/61782" pattern
      const match = line.match(/Invoice No\.?\s*:\s*([A-Z0-9\/]+)/i);
      if (match) {
        return match[1].trim();
      }
      
      // Also look for standalone invoice number pattern
      const standaloneMatch = line.match(/^([A-Z0-9]+\/[A-Z0-9]+)$/);
      if (standaloneMatch) {
        return standaloneMatch[1].trim();
      }
    }
    return null;
  }

  /**
   * Extract date from invoice text
   * @param {Array} lines - Array of text lines
   * @returns {string|null} Extracted date in YYYY-MM-DD format
   */
  extractDate(lines) {
    for (const line of lines) {
      // Look for "Invoice Date : 11/10/2025" pattern
      const match = line.match(/Invoice Date\s*:\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
      if (match) {
        const day = match[1].padStart(2, '0');
        const month = match[2].padStart(2, '0');
        const year = match[3];
        return `${year}-${month}-${day}`;
      }
      
      // Also try to find date in other formats
      const dateMatch = line.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (dateMatch) {
        const day = dateMatch[1].padStart(2, '0');
        const month = dateMatch[2].padStart(2, '0');
        const year = dateMatch[3];
        return `${year}-${month}-${day}`;
      }
    }
    return null;
  }

  /**
   * Extract store information
   * @param {Array} lines - Array of text lines
   * @returns {string} Store information
   */
  extractStoreInfo(lines) {
    for (const line of lines) {
      if (line.match(/OM SHREE ASHTAVINAYAK ENTERPRISE.*R3309/i)) {
        return line.trim();
      }
    }
    return 'OM SHREE ASHTAVINAYAK ENTERPRISE ( SHAHAD ) - R3309';
  }

  /**
   * Extract items from invoice text
   * @param {Array} lines - Array of text lines
   * @returns {Array} Array of item objects
   */
  extractItems(lines) {
    const items = [];
    let inItemsSection = false;
    let itemsSectionStart = -1;

    console.log('=== ITEMS EXTRACTION DEBUG ===');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip Tax Summary table lines - these are NOT items
      if (line.includes('Tax Summary') || line.includes('HSN/SAC') || line.includes('HSN Description') ||
          line.includes('Net Taxable Value') || line.includes('Rate Amount') ||
          line.includes('CGST') || line.includes('SGST') || line.includes('HSN TOTAL')) {
        console.log(`Skipping Tax Summary line at ${i + 1}: ${line}`);
        continue;
      }

      // Skip summary lines that look like items but aren't (e.g., "10514992.661349.33...")
      if (/^\d{8}/.test(line) && line.includes('.')) {
        console.log(`Skipping summary line at ${i + 1}: ${line}`);
        continue;
      }

        // Check if we're entering the items section
        // Look for items table header patterns
        if ((line.includes('Sl.Item') && line.includes('Description')) ||
            (line.includes('Sl.Item') && line.includes('Code')) ||
            (line.includes('Item Name') && line.includes('HSN')) ||
            /^\d+[A-Z0-9]{4,5}/.test(line)) { // Direct item line pattern (4 or 5 char codes)
        console.log(`Found items header at line ${i + 1}: ${line}`);
        inItemsSection = true;
        itemsSectionStart = i;
        // If this is already an item line, process it
        if (/^\d+[A-Z0-9]{4,5}/.test(line)) {
          console.log(`\n=== Processing item at line ${i + 1}: ${line}`);
          try {
            const parsedItem = this.parseSingleLineItem(line);
            if (parsedItem) {
              console.log(`✓ Parsed item: ${parsedItem.itemCode} - ${parsedItem.itemName} - Qty: ${parsedItem.qty} - Rate: ${parsedItem.rate}`);
              items.push(parsedItem);
            }
          } catch (error) {
            console.log(`Error parsing item: ${error.message}`);
          }
        }
        continue;
      }

      // Also check for items that start with just a number (like "1OS085...")
      if (/^\d+[A-Z0-9]{4,5}/.test(line) && !inItemsSection) {
        console.log(`Found direct item line at line ${i + 1}: ${line}`);
        inItemsSection = true;
        itemsSectionStart = i;
        console.log(`\n=== Processing item at line ${i + 1}: ${line}`);
        try {
          const parsedItem = this.parseSingleLineItem(line);
          if (parsedItem) {
            console.log(`✓ Parsed item: ${parsedItem.itemCode} - ${parsedItem.itemName} - Qty: ${parsedItem.qty} - Rate: ${parsedItem.rate}`);
            items.push(parsedItem);
          }
        } catch (error) {
          console.log(`Error parsing item: ${error.message}`);
        }
        continue;
      }

      // Check if we're leaving the items section - but only if we've already found items
      // Don't stop at page breaks - only stop at actual invoice end markers
      if (inItemsSection && items.length > 0) {
        // Skip page markers - they don't end the items section
        if (line.includes('Page No:') || line.includes('Page No:')) {
          console.log(`Skipping page marker at line ${i + 1}: ${line}`);
          continue;
        }

        // Only stop if we see a clear end marker AND we're not in the middle of items
        if ((line.includes('Tax Summary') || line.includes('Gross Value') || line.includes('RUPEES')) && !/^\d+/.test(line)) {
          console.log(`Leaving items section at line ${i + 1}: ${line}`);
          break;
        }
      }

      if (inItemsSection) {
        // Check if this line starts with a digit (serial number) - this is the start of an item
        if (!/^\d+/.test(line)) {
          console.log(`Line doesn't start with digit, skipping: ${line}`);
          continue;
        }

        console.log(`\n=== Processing item at line ${i + 1}: ${line}`);

        try {
          // Parse single-line item format
          const parsedItem = this.parseSingleLineItem(line);
          if (parsedItem) {
            console.log(`✓ Parsed item: ${parsedItem.itemCode} - ${parsedItem.itemName} - Qty: ${parsedItem.qty} - Rate: ${parsedItem.rate}`);
            items.push(parsedItem);
          }
        } catch (error) {
          console.log(`Error parsing item: ${error.message}`);
          continue;
        }
      }
    }

    console.log(`\nTotal items extracted: ${items.length}`);
    console.log('=== END ITEMS EXTRACTION ===');

    return items;
  }

  /**
   * Parse a single-line item format using fixed-width parsing
   * @param {string} line - The item line to parse
   * @returns {Object|null} Parsed item object or null if parsing fails
   */
  parseSingleLineItem(line) {
    console.log(`Parsing single-line item: ${line}`);
    
    // Extract serial number (starts with digit)
    const slMatch = line.match(/^(\d+)/);
    if (!slMatch) {
      console.log('No serial number found');
      return null;
    }
    const slNo = parseInt(slMatch[1]);
    console.log(`Serial: ${slNo}`);
    
    // Extract item code (5 characters after serial, with optional space)
    const itemCodeMatch = line.match(/^\d+\s*([A-Z0-9]{5})/);
    if (!itemCodeMatch) {
      console.log('No item code found');
      return null;
    }
    const itemCode = itemCodeMatch[1];
    console.log(`Item Code: ${itemCode}`);
    
    // Find the position of item code
    const itemCodeIndex = line.indexOf(itemCode);
    
    // Find HSN code (8 digits) in the line
    const hsnMatch = line.match(/(\d{8})/);
    if (!hsnMatch) {
      console.log('No HSN code found');
      return null;
    }
    const hsnCode = hsnMatch[1];
    const hsnIndex = line.indexOf(hsnCode);
    console.log(`HSN Code: ${hsnCode} at position ${hsnIndex}`);
    
    // Extract description (between item code and HSN code)
    const descriptionStart = itemCodeIndex + itemCode.length;
    const itemName = line.substring(descriptionStart, hsnIndex).trim();
    console.log(`Item Name: "${itemName}"`);
    
    // Everything after HSN code
    const afterHsn = line.substring(hsnIndex + 8);
    console.log(`After HSN: "${afterHsn}"`);
    
    // Extract quantity (first number after HSN)
    const qtyMatch = afterHsn.match(/^(\d+)/);
    if (!qtyMatch) {
      console.log('No quantity found');
      return null;
    }
    const qty = parseInt(qtyMatch[1]);
    console.log(`Quantity: ${qty}`);
    
    // Skip UOM and find rate (decimal number)
    const rateMatch = afterHsn.match(/(\d+\.\d{2})/);
    if (!rateMatch) {
      console.log('No rate found');
      return null;
    }
    const rate = parseFloat(rateMatch[1]);
    console.log(`Rate: ${rate}`);
    
    const total = qty * rate;
    console.log(`Total: ${total}`);
    
    return {
      slNo,
      itemCode,
      itemName,
      hsnCode,
      qty,
      uom: 'NOS', // Default UOM
      rate,
      total
    };
  }

  /**
   * Get page count from text
   * @param {Array} lines - Array of text lines
   * @returns {number} Page count
   */
  getPageCount(lines) {
    const pageMatches = lines.filter(line => line.includes('Page No:')).length;
    return pageMatches > 0 ? pageMatches : 1;
  }

  /**
   * Check if date is today
   * @param {string} dateStr - Date string in YYYY-MM-DD format
   * @returns {boolean} True if date is today
   */
  isToday(dateStr) {
    if (!dateStr) return false;
    const today = new Date();
    const invoiceDate = new Date(dateStr);
    return invoiceDate.toDateString() === today.toDateString();
  }

  /**
   * Parse invoice from file
   * @param {string} filePath - Path to invoice file
   * @returns {Object} Parsed invoice data
   */
  async parseFromFile(filePath) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      
      if (ext === '.txt') {
        const textContent = fs.readFileSync(filePath, 'utf8');
        return this.parseFromText(textContent);
      } else if (ext === '.pdf') {
        // Parse PDF using pdf-parse
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdf(dataBuffer);
        return this.parseFromText(pdfData.text);
      } else {
        return {
          success: false,
          error: `Unsupported file format: ${ext}`
        };
      }
    } catch (error) {
      console.error('Error parsing invoice file:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate parsed invoice data
   * @param {Object} parsedData - Parsed invoice data
   * @returns {Object} Validation result
   */
  validateParsedData(parsedData) {
    const errors = [];
    
    if (!parsedData.invoices || parsedData.invoices.length === 0) {
      errors.push('No invoices found in document');
      return { isValid: false, errors };
    }
    
    // Validate each invoice
    parsedData.invoices.forEach((invoice, invIndex) => {
      if (!invoice.invoiceDate) {
        errors.push(`Invoice ${invIndex + 1}: Date not found`);
      }
      
      if (!invoice.invoiceNo) {
        errors.push(`Invoice ${invIndex + 1}: Invoice number not found`);
      }
      
      if (!invoice.items || invoice.items.length === 0) {
        errors.push(`Invoice ${invIndex + 1}: No items found`);
      }
      
      // Validate each item
      invoice.items?.forEach((item, index) => {
        if (!item.itemCode) {
          errors.push(`Invoice ${invIndex + 1}, Item ${index + 1}: Item code missing`);
        }
        if (!item.qty || item.qty <= 0) {
          errors.push(`Invoice ${invIndex + 1}, Item ${index + 1}: Invalid quantity`);
        }
        if (!item.rate || item.rate <= 0) {
          errors.push(`Invoice ${invIndex + 1}, Item ${index + 1}: Invalid rate`);
        }
      });
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = InvoiceParser;
