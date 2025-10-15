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
   * Split text into multiple invoices - CONSERVATIVE APPROACH
   * Only split if we find clear evidence of multiple invoices
   * @param {Array} lines - Array of text lines
   * @returns {Array} Array of invoice line arrays
   */
  splitIntoMultipleInvoices(lines) {
    const invoices = [];
    
    console.log('=== INVOICE DETECTION DEBUG ===');
    console.log('Looking for invoice patterns...');
    
    // Look for clear invoice headers that indicate multiple invoices
    const invoiceHeaders = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for "Invoice No. : MUM2526/61782" pattern
      if (line.match(/Invoice No\.?\s*:\s*[A-Z0-9\/]+/i)) {
        invoiceHeaders.push({ index: i, line: line });
        console.log(`Found invoice header at line ${i + 1}: "${line}"`);
      }
    }
    
    console.log(`Found ${invoiceHeaders.length} invoice headers`);
    
    // Only split if we find MORE THAN ONE clear invoice header
    if (invoiceHeaders.length > 1) {
      console.log('Multiple invoice headers detected, splitting...');
      
      for (let i = 0; i < invoiceHeaders.length; i++) {
        const startIndex = invoiceHeaders[i].index;
        const endIndex = i < invoiceHeaders.length - 1 ? invoiceHeaders[i + 1].index : lines.length;
        
        const invoiceLines = lines.slice(startIndex, endIndex);
        console.log(`Invoice ${i + 1}: lines ${startIndex + 1} to ${endIndex} (${invoiceLines.length} lines)`);
        invoices.push(invoiceLines);
      }
    } else {
      console.log('Single invoice detected, treating entire document as one invoice');
      invoices.push(lines);
    }
    
    return invoices;
  }

  /**
   * Parse a single invoice from its lines
   * @param {Array} lines - Lines for a single invoice
   * @param {number} index - Invoice index
   * @returns {Object} Parsed invoice data
   */
  parseSingleInvoice(lines, index) {
    try {
      console.log(`\n--- Parsing Invoice ${index + 1} ---`);
      console.log(`Total lines for this invoice: ${lines.length}`);
      
      // Extract invoice number
      const invoiceNumber = this.extractInvoiceNumber(lines);
      console.log(`Extracted invoice number: "${invoiceNumber}"`);
      
      // Extract date
      const date = this.extractDate(lines);
      console.log(`Extracted date: "${date}"`);
      
      // Extract store information
      const store = this.extractStoreInfo(lines);
      console.log(`Extracted store: "${store}"`);
      
      // Extract items
      const items = this.extractItems(lines);
      console.log(`Extracted items count: ${items.length}`);
      
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
      
      const result = {
        invoiceNo: invoiceNumber || 'Unknown',
        invoiceDate: date || new Date().toISOString().split('T')[0],
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
      
      console.log(`✅ Invoice ${index + 1} parsed successfully:`, {
        invoiceNo: result.invoiceNo,
        invoiceDate: result.invoiceDate,
        store: result.store,
        itemsCount: result.items.length,
        totalAmount: result.totalAmount
      });
      
      return result;
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
    console.log('🔍 Extracting invoice number from lines...');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for "Invoice No. : MUM2526/61782" pattern
      const match = line.match(/Invoice No\.?\s*:\s*([A-Z0-9\/]+)/i);
      if (match) {
        console.log(`✅ Found invoice number pattern: "${match[1]}"`);
        return match[1].trim();
      }
      
      // Also look for standalone invoice number pattern
      const standaloneMatch = line.match(/^([A-Z0-9]+\/[A-Z0-9]+)$/);
      if (standaloneMatch) {
        console.log(`✅ Found standalone invoice number: "${standaloneMatch[1]}"`);
        return standaloneMatch[1].trim();
      }
      
      // Look for any line that contains a pattern like MUM2526/61782
      const generalMatch = line.match(/([A-Z]{3}\d{4}\/\d{5})/);
      if (generalMatch) {
        console.log(`✅ Found general invoice number pattern: "${generalMatch[1]}"`);
        return generalMatch[1].trim();
      }
    }
    
    console.log('❌ No invoice number found in any line');
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
      if (line.includes('R3309')) {
        return line.trim();
      }
    }
    return 'Unknown Store';
  }

  /**
   * Extract items from invoice text
   * @param {Array} lines - Array of text lines
   * @returns {Array} Array of item objects
   */
  extractItems(lines) {
    const items = [];
    let inItemsSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for items table header
      if (line.includes('Sl No') || line.includes('Item Code') || line.includes('Item Name')) {
        inItemsSection = true;
        continue;
      }
      
      // Skip empty lines and headers
      if (!inItemsSection || line.length < 10) {
        continue;
      }
      
      // Look for item pattern: number, item code, item name, HSN, qty, rate, total
      const itemMatch = line.match(/^(\d+)\s+([A-Z0-9]+)\s+(.+?)\s+(\d+)\s+(\d+)\s+₹?([\d,]+\.?\d*)\s+₹?([\d,]+\.?\d*)$/);
      
      if (itemMatch) {
        const [, slNo, itemCode, itemName, hsnCode, qty, rate, total] = itemMatch;
        
        items.push({
          slNo: parseInt(slNo),
          itemCode: itemCode.trim(),
          itemName: itemName.trim(),
          hsnCode: hsnCode.trim(),
          qty: parseInt(qty),
          rate: parseFloat(rate.replace(/,/g, '')),
          total: parseFloat(total.replace(/,/g, ''))
        });
      }
    }
    
    return items;
  }

  /**
   * Get page count from lines
   * @param {Array} lines - Array of text lines
   * @returns {number} Page count
   */
  getPageCount(lines) {
    // Simple heuristic: count pages based on content length
    const totalChars = lines.join('').length;
    return Math.ceil(totalChars / 2000); // Rough estimate
  }

  /**
   * Check if date is today
   * @param {string} date - Date string
   * @returns {boolean} True if date is today
   */
  isToday(date) {
    if (!date) return false;
    const today = new Date().toISOString().split('T')[0];
    return date === today;
  }

  /**
   * Parse invoice from file
   * @param {string} filePath - Path to PDF file
   * @returns {Object} Parsed invoice data
   */
  async parseFromFile(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      return this.parseFromText(data.text);
    } catch (error) {
      console.error('Error parsing PDF file:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Parse invoice from buffer
   * @param {Buffer} buffer - PDF buffer
   * @param {string} filename - Original filename
   * @returns {Object} Parsed invoice data
   */
  async parseFromBuffer(buffer, filename = 'unknown.pdf') {
    try {
      const data = await pdf(buffer);
      return this.parseFromText(data.text);
    } catch (error) {
      console.error('Error parsing PDF buffer:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = InvoiceParser;