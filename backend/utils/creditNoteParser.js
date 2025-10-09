// File: backend/utils/creditNoteParser.js
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

class CreditNoteParser {
  constructor() {
    this.supportedFormats = ['pdf', 'txt'];
  }

  /**
   * Parse credit note from text content
   * @param {string} textContent - Raw text from PDF
   * @returns {Object} Parsed credit note data
   */
  parseFromText(textContent) {
    try {
      const lines = textContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      // Debug: Log first 20 lines to see what we're working with
      console.log('=== PDF TEXT EXTRACTION DEBUG ===');
      console.log('Total lines:', lines.length);
      console.log('First 20 lines:');
      lines.slice(0, 20).forEach((line, index) => {
        console.log(`${index + 1}: ${line}`);
      });
      console.log('=== END DEBUG ===');
      
      // Split into multiple credit notes if present
      const creditNotes = this.splitIntoMultipleCreditNotes(lines);
      
      const parsedCreditNotes = [];
      
      console.log(`\n=== PROCESSING ${creditNotes.length} CREDIT NOTES ===`);
      
      for (let i = 0; i < creditNotes.length; i++) {
        console.log(`\n--- Processing Credit Note ${i + 1}/${creditNotes.length} ---`);
        const creditNoteData = this.parseSingleCreditNote(creditNotes[i], i);
        
        // parseSingleCreditNote now returns an array of credit notes (split by return date)
        if (Array.isArray(creditNoteData)) {
          // Filter out credit notes without items
          const validCreditNotes = creditNoteData.filter(cn => cn.items && cn.items.length > 0);
          console.log(`Credit Note ${i + 1} split into ${creditNoteData.length} entries, ${validCreditNotes.length} with items`);
          parsedCreditNotes.push(...validCreditNotes);
        } else {
          // Only add if it has items
          if (creditNoteData.items && creditNoteData.items.length > 0) {
            console.log(`Credit Note ${i + 1} created 1 entry with items`);
            parsedCreditNotes.push(creditNoteData);
          } else {
            console.log(`Credit Note ${i + 1} has no items, skipping`);
          }
        }
      }
      
      console.log(`\n=== FINAL RESULT: ${parsedCreditNotes.length} TOTAL ENTRIES ===`);
      
      return {
        success: true,
        creditNotes: parsedCreditNotes,
        totalCreditNotes: parsedCreditNotes.length,
        debugInfo: {
          totalLines: lines.length,
          firstLines: lines.slice(0, 10)
        }
      };
    } catch (error) {
      console.error('Error parsing credit note text:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Split text into multiple credit notes
   * @param {Array} lines - Array of text lines
   * @returns {Array} Array of credit note line arrays
   */
  splitIntoMultipleCreditNotes(lines) {
    const creditNotes = [];
    let currentCreditNote = [];
    let inCreditNote = false;
    
    console.log('=== CREDIT NOTE DETECTION DEBUG ===');
    console.log('Looking for credit note patterns...');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this line starts a new credit note
      // Look for "CREDIT NOTE" followed by company name or credit note number pattern
      if (line.includes('CREDIT NOTE') || 
          line.match(/Credit Note No\.?\s*:\s*[A-Z0-9\/]+/i)) {
        
        console.log(`Found credit note header at line ${i + 1}: ${line}`);
        
        // If we're already in a credit note, save it before starting a new one
        if (inCreditNote && currentCreditNote.length > 0) {
          creditNotes.push([...currentCreditNote]);
          console.log(`Saved previous credit note with ${currentCreditNote.length} lines`);
        }
        
        // Start new credit note
        currentCreditNote = [line];
        inCreditNote = true;
      } else if (inCreditNote) {
        // Add line to current credit note
        currentCreditNote.push(line);
        
        // Check if we've reached the end of this credit note
        // Look for signature lines or next page indicators
        if (line.includes('Authorised Signatory') || 
            line.includes('Receiver\'s Signature') ||
            line.includes('Subject to Mumbai Jurisdiction') ||
            (line.includes('Page') && line.includes('of'))) {
          console.log(`Found end of credit note at line ${i + 1}: ${line}`);
          // Don't end here, continue collecting until we find the next credit note
        }
      }
    }
    
    // Add the last credit note
    if (inCreditNote && currentCreditNote.length > 0) {
      creditNotes.push(currentCreditNote);
      console.log(`Saved final credit note with ${currentCreditNote.length} lines`);
    }
    
    console.log(`Total credit notes found: ${creditNotes.length}`);
    if (creditNotes.length > 0) {
      creditNotes.forEach((cn, index) => {
        console.log(`Credit Note ${index + 1}: ${cn.length} lines`);
        // Show first few lines to identify the credit note
        const firstLines = cn.slice(0, 3).join(' | ');
        console.log(`  First lines: ${firstLines}`);
      });
    }
    console.log('=== END CREDIT NOTE DETECTION ===');
    
    return creditNotes.length > 0 ? creditNotes : [lines];
  }

  /**
   * Parse a single credit note
   * @param {Array} lines - Lines for a single credit note
   * @param {number} index - Credit note index
   * @returns {Object} Parsed credit note data
   */
  parseSingleCreditNote(lines, index) {
    try {
      // Extract credit note number
      const creditNoteNumber = this.extractCreditNoteNumber(lines);
      
      // Extract date
      const date = this.extractDate(lines);
      
      // Extract items first
      const items = this.extractItems(lines);
      
      // Only extract other details if we have items
      if (items.length === 0) {
        console.log(`Credit Note ${index + 1} has no items, skipping detailed extraction`);
        return [];
      }
      
      // Extract receiver details
      const receiver = this.extractReceiverDetails(lines);
      
      // Extract totals
      const totals = this.extractTotals(lines);
      
      // Extract reason
      const reason = this.extractReason(lines);
      
      // Group items by return date
      const itemsByReturnDate = this.groupItemsByReturnDate(items);
      
      // Create separate credit note entries for each return date
      const creditNotes = [];
      
      for (const [returnDate, dateItems] of itemsByReturnDate) {
        // Calculate totals for this specific return date
        const dateTotals = this.calculateTotalsForItems(dateItems);
        
        creditNotes.push({
          creditNoteNumber,
          date, // Original credit note date
          returnDate, // Primary date for this entry
          receiver,
          items: dateItems,
          totals: dateTotals,
          reason,
          totalItems: dateItems.length,
          index: `${index}_${returnDate}` // Unique index for each return date
        });
      }
      
      return creditNotes;
    } catch (error) {
      console.error(`Error parsing credit note ${index}:`, error);
      return [{
        success: false,
        error: error.message,
        index
      }];
    }
  }

  /**
   * Extract credit note number
   * @param {Array} lines - Array of text lines
   * @returns {string|null} Credit note number
   */
  extractCreditNoteNumber(lines) {
    for (const line of lines) {
      const match = line.match(/Credit Note No\.?\s*:\s*([A-Z0-9\/]+)/i);
      if (match) {
        return match[1].trim();
      }
    }
    return null;
  }

  /**
   * Extract date from credit note text
   * @param {Array} lines - Array of text lines
   * @returns {string|null} Extracted date in YYYY-MM-DD format
   */
  extractDate(lines) {
    for (const line of lines) {
      // Look for "Date:" followed by date - handle both formats
      const match = line.match(/Date\s*:\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
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
   * Extract receiver details
   * @param {Array} lines - Array of text lines
   * @returns {Object} Receiver details
   */
  extractReceiverDetails(lines) {
    const receiver = {};
    
    console.log('=== RECEIVER EXTRACTION DEBUG ===');
    
    // Look for receiver details in multiple ways
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Method 1: Look for "Details of Receiver" section
      if (line.includes('Details of Receiver') || line.includes('Details of Returns of Goods')) {
        console.log(`Found receiver section at line ${i + 1}: ${line}`);
        
        // Look for receiver name in the next few lines - try to combine multiple lines
        let receiverName = '';
        for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
          const nextLine = lines[j].trim();
          
          // Look for lines that contain receiver name patterns
          if (nextLine.includes('ENTERPRISE') || 
              nextLine.includes('R3309') || 
              nextLine.includes('SHOP NO') ||
              nextLine.includes('Thane Maharashtra')) {
            
            // If this line contains the full name, use it
            if (nextLine.includes('ENTERPRISE') && nextLine.includes('R3309')) {
              receiverName = nextLine;
            } else if (nextLine.includes('ENTERPRISE')) {
              // This might be the first part, check next lines for R3309
              receiverName = nextLine;
              for (let k = j + 1; k < Math.min(j + 3, lines.length); k++) {
                const followingLine = lines[k].trim();
                if (followingLine.includes('R3309')) {
                  receiverName += ' ' + followingLine;
                  break;
                }
              }
            } else if (nextLine.includes('R3309')) {
              // This might be the second part, check previous lines for ENTERPRISE
              for (let k = j - 1; k >= Math.max(j - 3, i + 1); k--) {
                const prevLine = lines[k].trim();
                if (prevLine.includes('ENTERPRISE')) {
                  receiverName = prevLine + ' ' + nextLine;
                  break;
                }
              }
              if (!receiverName) {
                receiverName = nextLine;
              }
            } else {
              receiverName = nextLine;
            }
            
            if (receiverName) {
              receiver.name = receiverName;
              console.log(`Found receiver name: ${receiver.name}`);
              break;
            }
          }
        }
        
        // Look for GSTIN in the same section
        for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
          const gstinMatch = lines[j].match(/GSTIN\s*:\s*([A-Z0-9]+)/i);
          if (gstinMatch) {
            receiver.gstin = gstinMatch[1];
            console.log(`Found GSTIN: ${receiver.gstin}`);
            break;
          }
        }
        
        if (receiver.name) break;
      }
      
      // Method 2: Look for receiver name pattern directly
      if (line.includes('ENTERPRISE') || line.includes('R3309')) {
        let receiverName = line.trim();
        
        // If this line has ENTERPRISE but not R3309, look for R3309 in next lines
        if (receiverName.includes('ENTERPRISE') && !receiverName.includes('R3309')) {
          for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
            const nextLine = lines[j].trim();
            if (nextLine.includes('R3309')) {
              receiverName += ' ' + nextLine;
              break;
            }
          }
        }
        
        receiver.name = receiverName;
        console.log(`Found receiver: ${receiver.name}`);
        
        // Get GSTIN from next few lines
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          const gstinMatch = lines[j].match(/GSTIN\s*:\s*([A-Z0-9]+)/i);
          if (gstinMatch) {
            receiver.gstin = gstinMatch[1];
            console.log(`Found GSTIN: ${receiver.gstin}`);
            break;
          }
        }
        break;
      }
    }
    
    // If no receiver found, try a more aggressive search
    if (!receiver.name) {
      console.log('No receiver found in standard patterns, trying aggressive search...');
      
      // Look for any line containing ENTERPRISE or R3309
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('ENTERPRISE') || line.includes('R3309')) {
          receiver.name = line;
          console.log(`Found receiver in aggressive search: ${receiver.name}`);
          
          // Look for GSTIN in nearby lines
          for (let j = Math.max(0, i - 5); j < Math.min(i + 10, lines.length); j++) {
            const gstinMatch = lines[j].match(/GSTIN\s*:\s*([A-Z0-9]+)/i);
            if (gstinMatch) {
              receiver.gstin = gstinMatch[1];
              console.log(`Found GSTIN in aggressive search: ${receiver.gstin}`);
              break;
            }
          }
          break;
        }
      }
      
      // If still no receiver found, set default values
      if (!receiver.name) {
        receiver.name = 'Unknown Receiver';
        receiver.gstin = 'Unknown GSTIN';
        console.log('No receiver found, using defaults');
      }
    }
    
    console.log('=== END RECEIVER EXTRACTION ===');
    
    return receiver;
  }

  /**
   * Extract items from credit note text
   * @param {Array} lines - Array of text lines
   * @returns {Array} Array of item objects
   */
  extractItems(lines) {
    const items = [];
    let inItemsSection = false;
    const itemDates = new Map(); // Store dates by item index
    
    console.log('=== ITEMS EXTRACTION DEBUG ===');
    
    // Get the main credit note date (fallback for all items)
    const mainDate = this.extractDate(lines);
    console.log(`Main credit note date: ${mainDate}`);
    
    // First pass: collect all item-specific dates (if any)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const dateMatch = line.match(/: \d+\s+Date : (\d{1,2}\/\d{1,2}\/\d{4})/);
      if (dateMatch) {
        const itemIndex = parseInt(line.match(/: (\d+)/)[1]);
        const date = this.formatDate(dateMatch[1]);
        itemDates.set(itemIndex, date);
        console.log(`Found item-specific date for item ${itemIndex}: ${date}`);
      }
    }
    
    // If no item-specific dates found, use main date for all items
    if (itemDates.size === 0) {
      console.log(`No item-specific dates found, using main date ${mainDate} for all items`);
    }
    
    // Map dates to items by looking for date lines followed by item lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this line contains a date
      const dateMatch = line.match(/: \d+\s+Date : (\d{1,2}\/\d{1,2}\/\d{4})/);
      if (dateMatch) {
        const currentDate = this.formatDate(dateMatch[1]);
        console.log(`Found date line: ${line} -> ${currentDate}`);
        
        // Look for the next item line after this date line
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j];
          
          // Check if this is an item line (starts with digit)
          if (/^\d+/.test(nextLine)) {
            const slMatch = nextLine.match(/^(\d+)/);
            if (slMatch) {
              const serial = parseInt(slMatch[1]);
              itemDates.set(serial, currentDate);
              console.log(`Mapped date ${currentDate} to serial ${serial} for line: ${nextLine}`);
              break; // Found the item for this date, move to next date
            }
          }
          
          // If we hit another date line or end of items section, stop looking
          if (nextLine.includes('Date :') || nextLine.includes('Gross Total') || nextLine.includes('Tax Summary')) {
            break;
          }
        }
      }
    }
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if we're entering the items section
      if (line.includes('Sl.Item') && line.includes('Description')) {
        console.log(`Found items header at line ${i + 1}: ${line}`);
        inItemsSection = true;
        continue;
      }
      
      // Check if we're leaving the items section
      if (inItemsSection && (line.includes('Gross Total') || line.includes('Tax Summary'))) {
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
          const parsedItem = this.parseSingleLineItem(line, itemDates, mainDate);
          if (parsedItem) {
            console.log(`✓ Parsed item: ${parsedItem.itemCode} - ${parsedItem.description} - Qty: ${parsedItem.quantity} - RTD: ${parsedItem.rtd} - Return Date: ${parsedItem.returnDate}`);
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
   * Parse a single-line item format
   * @param {string} line - The item line to parse
   * @param {Map} itemDates - Map of item indices to dates
   * @returns {Object|null} Parsed item object or null if parsing fails
   */
  parseSingleLineItem(line, itemDates, mainDate = null) {
    console.log(`Parsing single-line item: ${line}`);
    
    // Extract serial number (starts with digit)
    const slMatch = line.match(/^(\d+)/);
    if (!slMatch) {
      console.log('No serial number found');
      return null;
    }
    const sl = parseInt(slMatch[1]);
    console.log(`Serial: ${sl}`);
    
    // Get the date for this item (use item-specific date if available, otherwise main date)
    const returnDate = itemDates.get(sl) || mainDate || null;
    console.log(`Return Date: ${returnDate}`);
    
    // Extract item code (5 characters after serial, no space)
    const itemCodeMatch = line.match(/^\d+([A-Z0-9]{5})/);
    if (!itemCodeMatch) {
      console.log('No item code found');
      return null;
    }
    const itemCode = itemCodeMatch[1];
    console.log(`Item Code: ${itemCode}`);
    
    // Extract HSN code (8 digits starting with 19, ending with 0)
    const hsnMatch = line.match(/19\d{5}0/);
    if (!hsnMatch) {
      console.log('No HSN code found');
      return null;
    }
    const hsnCode = hsnMatch[0];
    const hsnIndex = line.indexOf(hsnCode);
    console.log(`HSN Code: ${hsnCode} at position ${hsnIndex}`);
    
    // Extract description (between item code and HSN code)
    const itemCodeIndex = line.indexOf(itemCode);
    const description = line.substring(itemCodeIndex + itemCode.length, hsnIndex).trim();
    console.log(`Description: ${description}`);
    
    // Everything after HSN code
    const afterHsn = line.substring(hsnIndex + hsnCode.length);
    console.log(`After HSN: "${afterHsn}"`);
    
    // Find NOS position
    const nosIndex = afterHsn.indexOf('NOS');
    if (nosIndex === -1) {
      console.log('No NOS found');
      return null;
    }
    
    // Quantity is between HSN and NOS
    const qtyStr = afterHsn.substring(0, nosIndex);
    const quantity = parseFloat(qtyStr);
    if (isNaN(quantity)) {
      console.log('Invalid quantity');
      return null;
    }
    console.log(`Quantity: ${quantity}`);
    
    // After NOS, extract all decimal numbers
    const afterNos = afterHsn.substring(nosIndex + 3);
    console.log(`After NOS: "${afterNos}"`);
    
    // Extract all decimal numbers ending with .XX pattern
    const numbers = afterNos.match(/\d+\.\d{2}/g);
    if (!numbers || numbers.length < 6) {
      console.log(`Not enough numbers found: ${numbers ? numbers.length : 0}`);
      return null;
    }
    
    console.log(`Numbers extracted: ${numbers.join(', ')}`);
    
    // Pattern: rate, total, rtd, taxable, taxRate, amount
    const rate = parseFloat(numbers[0]);
    const total = parseFloat(numbers[1]);
    const rtd = parseFloat(numbers[2]);
    const taxable = parseFloat(numbers[3]);
    const taxRate = parseFloat(numbers[4]);
    const amount = parseFloat(numbers[5]);
    
    console.log(`Rate: ${rate}, Total: ${total}, RTD: ${rtd}, Taxable: ${taxable}, TaxRate: ${taxRate}, Amount: ${amount}`);
    
    // Validate RTD value (should be 0.00 or 15.00)
    if (rtd !== 15.00 && rtd !== 0.00) {
      console.log(`Invalid RTD value ${rtd}, skipping item`);
      return null;
    }
    
    // Log RTD type for debugging
    const rtdType = rtd === 15.00 ? 'GRM' : 'GVN';
    console.log(`RTD Type: ${rtdType} (${rtd})`);
    
    return {
      itemCode,
      description,
      hsnCode,
      quantity,
      rate,
      total,
      rtd,
      taxable,
      taxRate,
      amount,
      returnDate, // Item-specific return date
      sl
    };
  }

  /**
   * Parse a multi-line item format (3 lines per item)
   * @param {Array} lines - Array of all lines
   * @param {number} startIndex - Index where the item starts
   * @returns {Object|null} Parsed item object or null if parsing fails
   */
  parseMultiLineItem(lines, startIndex) {
    console.log(`Parsing multi-line item starting at line ${startIndex + 1}`);
    
    // Line 1: Serial + Item Code + Description
    const line1 = lines[startIndex];
    console.log(`Line 1: ${line1}`);
    
    // Line 2: Date: DD/MM/YYYY
    const line2 = lines[startIndex + 1];
    console.log(`Line 2: ${line2}`);
    
    // Line 3: HSN + Qty + UOM + Rate + Total + RTD + Taxable + TaxRate + Amount
    const line3 = lines[startIndex + 2];
    console.log(`Line 3: ${line3}`);
    
    if (!line1 || !line2 || !line3) {
      console.log('Missing lines for multi-line item');
      return null;
    }
    
    // Parse Line 1: Extract serial, item code, and description
    const slMatch = line1.match(/^(\d+)/);
    if (!slMatch) {
      console.log('No serial number found in line 1');
      return null;
    }
    const sl = slMatch[1];
    
    // Extract item code (5 characters after serial)
    const itemCodeMatch = line1.match(/^\d+\s+([A-Z0-9]{5})/);
    if (!itemCodeMatch) {
      console.log('No item code found in line 1');
      return null;
    }
    const itemCode = itemCodeMatch[1];
    
    // Extract description (everything after item code)
    const itemCodeIndex = line1.indexOf(itemCode);
    const description = line1.substring(itemCodeIndex + itemCode.length).trim();
    
    console.log(`Serial: ${sl}, Item Code: ${itemCode}, Description: ${description}`);
    
    // Parse Line 2: Extract return date
    const dateMatch = line2.match(/Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (!dateMatch) {
      console.log('No date found in line 2');
      return null;
    }
    const returnDate = this.formatDate(dateMatch[1]);
    console.log(`Return Date: ${returnDate}`);
    
    // Parse Line 3: Extract all the numerical data
    const numbers = line3.match(/\d+\.\d{2}/g);
    if (!numbers || numbers.length < 6) {
      console.log(`Not enough numbers found in line 3: ${numbers ? numbers.length : 0}`);
      return null;
    }
    
    console.log(`Numbers extracted: ${numbers.join(', ')}`);
    
    // Pattern: hsnCode + qty + UOM + rate + total + rtd + taxable + taxRate + amount
    // But we need to extract HSN code first
    const hsnMatch = line3.match(/19\d{5}0/);
    if (!hsnMatch) {
      console.log('No HSN code found in line 3');
      return null;
    }
    const hsnCode = hsnMatch[0];
    const hsnIndex = line3.indexOf(hsnCode);
    
    // Everything after HSN code
    const afterHsn = line3.substring(hsnIndex + hsnCode.length);
    
    // Find NOS position
    const nosIndex = afterHsn.indexOf('NOS');
    if (nosIndex === -1) {
      console.log('No NOS found in line 3');
      return null;
    }
    
    // Quantity is between HSN and NOS
    const qtyStr = afterHsn.substring(0, nosIndex);
    const quantity = parseFloat(qtyStr);
    if (isNaN(quantity)) {
      console.log('Invalid quantity');
      return null;
    }
    
    // After NOS, extract all decimal numbers
    const afterNos = afterHsn.substring(nosIndex + 3);
    const afterNosNumbers = afterNos.match(/\d+\.\d{2}/g);
    if (!afterNosNumbers || afterNosNumbers.length < 6) {
      console.log(`Not enough numbers after NOS: ${afterNosNumbers ? afterNosNumbers.length : 0}`);
      return null;
    }
    
    // Pattern: rate, total, rtd, taxable, taxRate, amount
    const rate = parseFloat(afterNosNumbers[0]);
    const total = parseFloat(afterNosNumbers[1]);
    const rtd = parseFloat(afterNosNumbers[2]);
    const taxable = parseFloat(afterNosNumbers[3]);
    const taxRate = parseFloat(afterNosNumbers[4]);
    const amount = parseFloat(afterNosNumbers[5]);
    
    console.log(`HSN: ${hsnCode}, Qty: ${quantity}, Rate: ${rate}, Total: ${total}, RTD: ${rtd}, Taxable: ${taxable}, TaxRate: ${taxRate}, Amount: ${amount}`);
    
    // Validate RTD value (should be 0.00 or 15.00)
    if (rtd !== 15.00 && rtd !== 0.00) {
      console.log(`Invalid RTD value ${rtd}, skipping item`);
      return null;
    }
    
    return {
      itemCode,
      description,
      hsnCode,
      quantity,
      rate,
      total,
      rtd,
      taxable,
      taxRate,
      amount,
      returnDate, // This is the key addition - item-specific return date
      sl: parseInt(sl)
    };
  }

  /**
   * Format date from DD/MM/YYYY to YYYY-MM-DD
   * @param {string} dateStr - Date in DD/MM/YYYY format
   * @returns {string} Date in YYYY-MM-DD format
   */
  formatDate(dateStr) {
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  /**
   * Group items by their return date
   * @param {Array} items - Array of item objects
   * @returns {Map} Map of return dates to items
   */
  groupItemsByReturnDate(items) {
    const itemsByReturnDate = new Map();
    
    for (const item of items) {
      const returnDate = item.returnDate || 'unknown';
      
      if (!itemsByReturnDate.has(returnDate)) {
        itemsByReturnDate.set(returnDate, []);
      }
      
      itemsByReturnDate.get(returnDate).push(item);
    }
    
    return itemsByReturnDate;
  }

  /**
   * Calculate totals for a specific set of items
   * @param {Array} items - Array of item objects
   * @returns {Object} Calculated totals
   */
  calculateTotalsForItems(items) {
    let totalQuantity = 0;
    let grossValue = 0;
    let taxableValue = 0;
    let totalAmount = 0;
    
    for (const item of items) {
      totalQuantity += item.quantity || 0;
      grossValue += item.total || 0;
      taxableValue += item.taxable || 0;
      totalAmount += item.amount || 0;
    }
    
    return {
      totalQuantity,
      grossValue,
      taxableValue,
      totalAmount,
      netValue: grossValue // Net value is same as gross value for now
    };
  }

  /**
   * Parse a single item line based on the exact pattern
   * @param {string} line - The item line to parse
   * @returns {Object|null} Parsed item object or null if parsing fails
   */
  parseItemLine(line) {
    console.log(`Parsing line: ${line}`);
    
    // Pattern: sl + itemCode(5) + description(variable) + hsnCode(8) + quantity(.00) + NOS + rate(.XX) + total(.XX) + rtd(.XX) + taxable(.XX) + rate(.XX) + amount(.XX)
    
    // Extract serial number (starts with digit)
    const slMatch = line.match(/^(\d+)/);
    if (!slMatch) {
      console.log('No serial number found');
      return null;
    }
    const sl = slMatch[1];
    console.log(`Serial: ${sl}`);
    
    // Extract item code (5 characters after serial)
    const itemCodeMatch = line.match(/^\d+([A-Z0-9]{5})/);
    if (!itemCodeMatch) {
      console.log('No item code found');
      return null;
    }
    const itemCode = itemCodeMatch[1];
    console.log(`Item Code: ${itemCode}`);
    
    // Extract HSN code (8 digits starting with 19, ending with 0)
    const hsnMatch = line.match(/19\d{5}0/);
    if (!hsnMatch) {
      console.log('No HSN code found');
      return null;
    }
    const hsnCode = hsnMatch[0];
    const hsnIndex = line.indexOf(hsnCode);
    console.log(`HSN Code: ${hsnCode} at position ${hsnIndex}`);
    
    // Extract description (between item code and HSN code)
    const itemCodeIndex = line.indexOf(itemCode);
    const description = line.substring(itemCodeIndex + itemCode.length, hsnIndex).trim();
    console.log(`Description: ${description}`);
    
    // Everything after HSN code
    const afterHsn = line.substring(hsnIndex + hsnCode.length);
    console.log(`After HSN: "${afterHsn}"`);
    
    // Find NOS position
    const nosIndex = afterHsn.indexOf('NOS');
    if (nosIndex === -1) {
      console.log('No NOS found');
      return null;
    }
    
    // Quantity is between HSN and NOS (ends with .00)
    const qtyStr = afterHsn.substring(0, nosIndex);
    const quantity = parseFloat(qtyStr);
    if (isNaN(quantity)) {
      console.log('Invalid quantity');
      return null;
    }
    console.log(`Quantity: ${quantity}`);
    
    // After NOS, extract all decimal numbers ending with .XX
    const afterNos = afterHsn.substring(nosIndex + 3);
    console.log(`After NOS: "${afterNos}"`);
    
    // Extract all decimal numbers ending with .XX pattern
    const numbers = afterNos.match(/\d+\.\d{2}/g);
    if (!numbers || numbers.length < 6) {
      console.log(`Not enough numbers found: ${numbers ? numbers.length : 0}`);
      return null;
    }
    
    console.log(`Numbers extracted: ${numbers.join(', ')}`);
    
    // Pattern: rate(.XX), total(.XX), rtd(.XX), taxable(.XX), rate(.XX), amount(.XX)
    const rate = parseFloat(numbers[0]);
    const total = parseFloat(numbers[1]);
    const rtd = parseFloat(numbers[2]);
    const taxable = parseFloat(numbers[3]);
    const taxRate = parseFloat(numbers[4]);
    const amount = parseFloat(numbers[5]);
    
    console.log(`Rate: ${rate}, Total: ${total}, RTD: ${rtd}, Taxable: ${taxable}, TaxRate: ${taxRate}, Amount: ${amount}`);
    
    // Validate RTD value (should be 0.00 or 15.00)
    if (rtd !== 15.00 && rtd !== 0.00) {
      console.log(`Invalid RTD value ${rtd}, skipping item`);
      return null;
    }
    
    return {
      itemCode,
      description,
      hsnCode,
      quantity,
      rate,
      total,
      rtd
    };
  }

  /**
   * Extract totals from credit note
   * @param {Array} lines - Array of text lines
   * @returns {Object} Totals object
   */
  extractTotals(lines) {
    const totals = {};
    
    console.log('=== TOTALS EXTRACTION DEBUG ===');
    
    for (const line of lines) {
      // Extract gross value - format: "Gross Value1083.09"
      const grossMatch = line.match(/Gross Value([\d.]+)/i);
      if (grossMatch) {
        totals.grossValue = parseFloat(grossMatch[1]);
        console.log(`Found gross value: ${totals.grossValue}`);
      }
      
      // Extract net value - format: "Net Value1083.00"
      const netMatch = line.match(/Net Value([\d.]+)/i);
      if (netMatch) {
        totals.netValue = parseFloat(netMatch[1]);
        console.log(`Found net value: ${totals.netValue}`);
      }
      
      // Extract total quantity from Gross Total line
      const qtyMatch = line.match(/Gross Total([\d.]+)/i);
      if (qtyMatch) {
        totals.totalQuantity = parseFloat(qtyMatch[1]);
        console.log(`Found total quantity: ${totals.totalQuantity}`);
      }
    }
    
    console.log('=== END TOTALS EXTRACTION ===');
    
    return totals;
  }

  /**
   * Extract reason for credit note
   * @param {Array} lines - Array of text lines
   * @returns {string|null} Reason for credit note
   */
  extractReason(lines) {
    console.log('=== REASON EXTRACTION DEBUG ===');
    
    for (const line of lines) {
      // Look for lines with "EXPIRED GOODS" or "DAMAGED GOODS"
      if (line.match(/\d+\s*(EXPIRED GOODS|DAMAGED GOODS)/i)) {
        const match = line.match(/\d+\s*(EXPIRED GOODS|DAMAGED GOODS)/i);
        const reason = match[1].trim();
        console.log(`Found reason: ${reason}`);
        return reason;
      }
      
      if (line.includes('EXPIRED GOODS')) {
        console.log(`Found reason: EXPIRED GOODS`);
        return 'EXPIRED GOODS';
      }
      
      if (line.includes('DAMAGED GOODS')) {
        console.log(`Found reason: DAMAGED GOODS`);
        return 'DAMAGED GOODS';
      }
    }
    
    // Default reason if not found
    console.log('No specific reason found, using default');
    return 'EXPIRED GOODS';
  }

  /**
   * Parse credit note from file
   * @param {string} filePath - Path to credit note file
   * @returns {Object} Parsed credit note data
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
      console.error('Error parsing credit note file:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Parse credit note from buffer (for Cloudinary integration)
   * @param {Buffer} buffer - File buffer
   * @param {string} originalName - Original filename to determine file type
   * @returns {Object} Parsed credit note data
   */
  async parseFromBuffer(buffer, originalName = '') {
    try {
      const ext = path.extname(originalName).toLowerCase();
      
      if (ext === '.txt') {
        const textContent = buffer.toString('utf8');
        return this.parseFromText(textContent);
      } else if (ext === '.pdf') {
        // Parse PDF using pdf-parse
        const pdfData = await pdf(buffer);
        return this.parseFromText(pdfData.text);
      } else {
        return {
          success: false,
          error: `Unsupported file format: ${ext}`
        };
      }
    } catch (error) {
      console.error('Error parsing credit note buffer:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Group items by their return date
   * @param {Array} items - Array of items
   * @returns {Map} Map of return date to items array
   */
  groupItemsByReturnDate(items) {
    const grouped = new Map();
    
    for (const item of items) {
      const returnDate = item.returnDate || 'unknown';
      
      if (!grouped.has(returnDate)) {
        grouped.set(returnDate, []);
      }
      
      grouped.get(returnDate).push(item);
    }
    
    console.log(`Grouped items by return date:`, Array.from(grouped.entries()).map(([date, items]) => `${date}: ${items.length} items`));
    
    return grouped;
  }

  /**
   * Calculate totals for a specific set of items
   * @param {Array} items - Array of items
   * @returns {Object} Calculated totals
   */
  calculateTotalsForItems(items) {
    const totals = {
      grossValue: 0,
      netValue: 0,
      totalQuantity: 0
    };
    
    for (const item of items) {
      totals.grossValue += (item.total || 0);
      totals.netValue += (item.total || 0);
      totals.totalQuantity += (item.quantity || 0);
    }
    
    return totals;
  }

  /**
   * Validate parsed credit note data
   * @param {Object} parsedData - Parsed credit note data
   * @returns {Object} Validation result
   */
  validateParsedData(parsedData) {
    const errors = [];
    
    if (!parsedData.creditNotes || parsedData.creditNotes.length === 0) {
      errors.push('No credit notes found in document');
      return { isValid: false, errors };
    }
    
    // Validate each credit note
    parsedData.creditNotes.forEach((creditNote, cnIndex) => {
      if (!creditNote.date) {
        errors.push(`Credit Note ${cnIndex + 1}: Date not found`);
      }
      
      if (!creditNote.creditNoteNumber) {
        errors.push(`Credit Note ${cnIndex + 1}: Credit note number not found`);
      }
      
      if (!creditNote.items || creditNote.items.length === 0) {
        errors.push(`Credit Note ${cnIndex + 1}: No items found`);
      }
      
      // Validate each item
      creditNote.items?.forEach((item, index) => {
        if (!item.itemCode) {
          errors.push(`Credit Note ${cnIndex + 1}, Item ${index + 1}: Item code missing`);
        }
        if (!item.quantity || item.quantity <= 0) {
          errors.push(`Credit Note ${cnIndex + 1}, Item ${index + 1}: Invalid quantity`);
        }
        if (item.rtd !== 15.00 && item.rtd !== 0.00) {
          errors.push(`Credit Note ${cnIndex + 1}, Item ${index + 1}: Invalid RTD value (should be 15.00 or 0.00)`);
        }
      });
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = CreditNoteParser;