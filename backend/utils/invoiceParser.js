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
    const invoices = [];
    
    console.log('=== INVOICE DETECTION DEBUG ===');
    console.log('Looking for invoice patterns...');
    
    // First, extract all unique invoice numbers from the document
    const uniqueInvoiceNumbers = new Set();
    const invoiceNumberPositions = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for "Invoice No. : MUM2526/61782" pattern
      const match = line.match(/Invoice No\.?\s*:\s*([A-Z0-9\/]+)/i);
      if (match) {
        const invoiceNumber = match[1].trim();
        uniqueInvoiceNumbers.add(invoiceNumber);
        invoiceNumberPositions.push({ lineIndex: i, invoiceNumber: invoiceNumber });
        console.log(`Found invoice number "${invoiceNumber}" at line ${i + 1}`);
      }
    }
    
    console.log(`Found ${uniqueInvoiceNumbers.size} unique invoice numbers:`, Array.from(uniqueInvoiceNumbers));
    console.log(`Found ${invoiceNumberPositions.length} invoice number occurrences`);
    
    // If we have multiple unique invoice numbers, split by them
    if (uniqueInvoiceNumbers.size > 1) {
      console.log('Multiple unique invoices detected, splitting by invoice numbers...');
      
      // Sort positions by line index
      invoiceNumberPositions.sort((a, b) => a.lineIndex - b.lineIndex);
      
      // Create splits based on unique invoice numbers
      let currentStart = 0;
      let currentInvoiceNumber = null;
      
      for (let i = 0; i < invoiceNumberPositions.length; i++) {
        const position = invoiceNumberPositions[i];
        
        // If this is a new invoice number, create a split
        if (currentInvoiceNumber !== null && position.invoiceNumber !== currentInvoiceNumber) {
          // End current invoice and start new one
          const invoiceLines = lines.slice(currentStart, position.lineIndex);
          if (invoiceLines.length > 0) {
            invoices.push(invoiceLines);
            console.log(`Invoice "${currentInvoiceNumber}": lines ${currentStart + 1} to ${position.lineIndex} (${invoiceLines.length} lines)`);
          }
          currentStart = position.lineIndex;
        }
        
        // If this is the first occurrence of this invoice number, start tracking it
        if (currentInvoiceNumber === null) {
          currentInvoiceNumber = position.invoiceNumber;
        }
      }
      
      // Add the last invoice
      const lastInvoiceLines = lines.slice(currentStart);
      if (lastInvoiceLines.length > 0) {
        invoices.push(lastInvoiceLines);
        console.log(`Last invoice "${currentInvoiceNumber}": lines ${currentStart + 1} to ${lines.length} (${lastInvoiceLines.length} lines)`);
      }
      
    } else if (uniqueInvoiceNumbers.size === 1) {
      // Single unique invoice number - treat entire document as one invoice
      console.log('Single unique invoice detected, treating entire document as one invoice');
      invoices.push(lines);
    } else {
      // No invoice numbers found - treat entire document as one invoice
      console.log('No invoice numbers found, treating entire document as one invoice');
      invoices.push(lines);
    }
    
    console.log(`Total invoices found: ${invoices.length}`);
    if (invoices.length > 0) {
      invoices.forEach((inv, index) => {
        console.log(`Invoice ${index + 1}: ${inv.length} lines`);
        // Show first few lines to identify the invoice
        const firstLines = inv.slice(0, 3).join(' | ');
        console.log(`  First lines: ${firstLines}`);
      });
    }
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
    
    console.log('=== ITEMS EXTRACTION DEBUG ===');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if we're entering the items section
      // Look for items table header patterns
      if ((line.includes('Sl.Item') && line.includes('Description')) ||
          (line.includes('Sl.Item') && line.includes('Code')) ||
          (line.includes('Item Name') && line.includes('HSN')) ||
          /^\d+[A-Z0-9]{5}/.test(line)) { // Direct item line pattern
        console.log(`Found items header at line ${i + 1}: ${line}`);
        inItemsSection = true;
        // If this is already an item line, process it
        if (/^\d+[A-Z0-9]{5}/.test(line)) {
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
      
      // Check if we're leaving the items section
      if (inItemsSection && (line.includes('Tax Summary') || line.includes('Gross Value') || line.includes('RUPEES'))) {
        console.log(`Leaving items section at line ${i + 1}: ${line}`);
        break;
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
