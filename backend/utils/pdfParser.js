// const pdf = require('pdf-parse');
// const moment = require('moment');
// const fs = require('fs');

// const parseInvoice = async (buffer, expectedDate = null) => {
//   try {
//     const data = await pdf(buffer);
//     const text = data.text;
    
//     // Save extracted text for debugging
//     fs.writeFileSync('debug_pdf_text.txt', text);
//     console.log('PDF text saved to debug_pdf_text.txt');
    
//     // Extract invoice date
//     const invoiceDateMatch = text.match(/Invoice Date\s*:\s*(\d{2}\/\d{2}\/\d{4})/);
//     if (!invoiceDateMatch) {
//       throw new Error('Invoice date not found in the document');
//     }
    
//     const invoiceDate = moment(invoiceDateMatch[1], 'DD/MM/YYYY');
//     const today = moment().startOf('day');
    
//     // Extract store information
//     const storeMatch = text.match(/OM SHREE ASHTAVINAYAK ENTERPRISE \( SHAHAD \) - R3309/);
//     if (!storeMatch) {
//       throw new Error('Store information not found or does not match R3309');
//     }
    
//     // Extract invoice number
//     const invoiceNoMatch = text.match(/Invoice No\.\s*:\s*([A-Z0-9\/]+)/);
//     const invoiceNo = invoiceNoMatch ? invoiceNoMatch[1] : 'Unknown';
    
//     // Parse table data with regex approach
//     const { items, totalQty, totalAmount } = parseTableDataRegex(text);
    
//     // Extract net value
//     const netValueMatch = text.match(/Net Value\s*(\d+\.\d{2})/);
//     const netValue = netValueMatch ? parseFloat(netValueMatch[1]) : totalAmount;
    
//     // Get page count
//     const pageCount = getPageCount(text);
    
//     console.log(`Parsed ${items.length} items from invoice, total quantity: ${totalQty}, total amount: ${netValue}`);
    
//     return {
//       invoiceNo,
//       invoiceDate: invoiceDate.format('YYYY-MM-DD'),
//       store: 'OM SHREE ASHTAVINAYAK ENTERPRISE ( SHAHAD ) - R3309',
//       items: items,
//       totalQty,
//       totalAmount: netValue,
//       pageCount,
//       validation: {
//         isToday: invoiceDate.isSame(today, 'day'),
//         isCorrectStore: true,
//         isValid: items.length > 0
//       }
//     };
//   } catch (error) {
//     throw new Error('Failed to parse PDF: ' + error.message);
//   }
// };

// const parseTableDataRegex = (text) => {
//   const items = [];
//   let totalQty = 0;
//   let totalAmount = 0;
  
//   // Simplified regex: Flexible capture based on position and patterns
//   const rowRegex = /(\d{1,2})([A-Z0-9]{5})(.{1,30}?)(?=\d{8})(\d{8})(\d{1,3})N([A-Z]+)(\d+\.\d{2})/gm;
  
//   let match;
//   while ((match = rowRegex.exec(text)) !== null) {
//     const slNo = parseInt(match[1]) || 0;
//     const itemCode = match[2];
//     let itemName = match[3].trim().substring(0, 30); // Limit to 30 chars
//     itemName = itemName.replace(/\s*\d+$/, '').trim(); // Clean trailing numbers
//     const hsnCode = match[4].trim();
//     const qty = parseInt(match[5]) || 0;
//     const uom = match[6];
//     const rate = parseFloat(match[7]) || 0;
//     const total = qty * rate;

//     // Detailed debug logs
//     console.log(`Match ${slNo}: Full=[${match[0]}], slNo=${match[1]}, itemCode=${match[2]}, itemName="${match[3]}", hsn=${match[4]}, qty=${match[5]}, uom=${match[6]}, rate=${match[7]}, total=${total}`);

//     // Validate and add item
//     if (slNo > 0 && itemCode.length === 5 && itemName.length > 0 && qty > 0 && rate > 0) {
//       const item = {
//         slNo,
//         itemCode,
//         itemName,
//         hsnCode,
//         qty,
//         uom,
//         rate,
//         total
//       };
//       items.push(item);
//       totalQty += qty;
//       totalAmount += total;
      
//       console.log(`Parsed item ${slNo}: ${itemCode} - ${itemName} - HSN: ${hsnCode} - Qty: ${qty} - Rate: ${rate} - Total: ${total}`);
//     } else {
//       console.log(`Rejected item ${slNo}: Validation failed - Code=${itemCode}, Name="${itemName}", Qty=${qty}, Rate=${rate}`);
//     }
//   }
  
//   // Stop at "Total" line
//   if (text.includes('Total67')) {
//     console.log('Table end detected');
//   }
  
//   return { items, totalQty, totalAmount };
// };

// const getPageCount = (text) => {
//   // Count all "Page No:" occurrences to determine total pages
//   const pageMatches = text.match(/Page No:\s*\d+/g) || [];
//   return pageMatches.length;
// };

// const validateInvoice = async (buffer, expectedDate = null) => {
//   try {
//     const data = await pdf(buffer);
//     const text = data.text;
    
//     const invoiceDateMatch = text.match(/Invoice Date\s*:\s*(\d{2}\/\d{2}\/\d{4})/);
//     if (!invoiceDateMatch) {
//       return { isValid: false, error: 'Invoice date not found' };
//     }
    
//     const invoiceDate = moment(invoiceDateMatch[1], 'DD/MM/YYYY');
//     const today = moment().startOf('day');
    
//     const storeMatch = text.match(/OM SHREE ASHTAVINAYAK ENTERPRISE \( SHAHAD \) - R3309/);
//     if (!storeMatch) {
//       return { isValid: false, error: 'Store information not found or does not match R3309' };
//     }
    
//     return {
//       isValid: true,
//       invoiceDate: invoiceDate.format('YYYY-MM-DD'),
//       invoiceNo: text.match(/Invoice No\.\s*:\s*([A-Z0-9\/]+)/)?.[1] || 'Unknown'
//     };
//   } catch (error) {
//     return { isValid: false, error: 'Failed to validate PDF: ' + error.message };
//   }
// };

// module.exports = { parseInvoice, validateInvoice };

const pdf = require('pdf-parse');
const moment = require('moment');
const fs = require('fs');

const parseInvoice = async (buffer, expectedDate = null) => {
  try {
    const data = await pdf(buffer);
    const text = data.text;
    
    // Save extracted text for debugging
    fs.writeFileSync('debug_pdf_text.txt', text);
    console.log('PDF text saved to debug_pdf_text.txt');
    
    // Debug: Log first 20 lines to see what we're working with
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    console.log('=== PDF TEXT EXTRACTION DEBUG ===');
    console.log('Total lines:', lines.length);
    console.log('First 20 lines:');
    lines.slice(0, 20).forEach((line, index) => {
      console.log(`${index + 1}: ${line}`);
    });
    console.log('=== END DEBUG ===');
    
    // Split into multiple invoices if present
    const invoices = splitIntoMultipleInvoices(lines);
    
    const parsedInvoices = [];
    
    console.log(`\n=== PROCESSING ${invoices.length} INVOICES ===`);
    
    for (let i = 0; i < invoices.length; i++) {
      console.log(`\n--- Processing Invoice ${i + 1}/${invoices.length} ---`);
      const invoiceData = parseSingleInvoice(invoices[i], i);
      
      if (invoiceData && invoiceData.items && invoiceData.items.length > 0) {
        console.log(`Invoice ${i + 1} created with ${invoiceData.items.length} items`);
        parsedInvoices.push(invoiceData);
      } else {
        console.log(`Invoice ${i + 1} has no items, skipping`);
      }
    }
    
    console.log(`\n=== FINAL RESULT: ${parsedInvoices.length} TOTAL INVOICES ===`);
    
    // Return the first invoice for backward compatibility, but with all invoices in the response
    if (parsedInvoices.length === 0) {
      throw new Error('No valid invoices found in the document');
    }
    
    const firstInvoice = parsedInvoices[0];
    
    return {
      invoiceNo: firstInvoice.invoiceNo,
      invoiceDate: firstInvoice.invoiceDate,
      store: firstInvoice.store,
      items: firstInvoice.items,
      totalQty: firstInvoice.totalQty,
      totalAmount: firstInvoice.totalAmount,
      pageCount: firstInvoice.pageCount,
      validation: firstInvoice.validation,
      // Add multiple invoices support
      allInvoices: parsedInvoices,
      invoiceCount: parsedInvoices.length
    };
  } catch (error) {
    throw new Error('Failed to parse PDF: ' + error.message);
  }
};

const splitIntoMultipleInvoices = (lines) => {
  const invoices = [];
  let currentInvoice = [];
  let inInvoice = false;
  
  console.log('=== INVOICE DETECTION DEBUG ===');
  console.log('Looking for invoice patterns...');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line starts a new invoice
    // Look for "INVOICE" followed by invoice number pattern or invoice date
    if (line.includes('INVOICE') || 
        line.match(/Invoice No\.?\s*:\s*[A-Z0-9\/]+/i) ||
        line.match(/Invoice Date\s*:\s*\d{2}\/\d{2}\/\d{4}/i)) {
      
      console.log(`Found invoice header at line ${i + 1}: ${line}`);
      
      // If we're already in an invoice, save it before starting a new one
      if (inInvoice && currentInvoice.length > 0) {
        invoices.push([...currentInvoice]);
        console.log(`Saved previous invoice with ${currentInvoice.length} lines`);
      }
      
      // Start new invoice
      currentInvoice = [line];
      inInvoice = true;
    } else if (inInvoice) {
      // Add line to current invoice
      currentInvoice.push(line);
      
      // Check if we've reached the end of this invoice
      // Look for signature lines or next page indicators
      if (line.includes('Authorised Signatory') || 
          line.includes('Receiver\'s Signature') ||
          line.includes('Subject to Mumbai Jurisdiction') ||
          (line.includes('Page') && line.includes('of'))) {
        console.log(`Found end of invoice at line ${i + 1}: ${line}`);
        // Don't end here, continue collecting until we find the next invoice
      }
    }
  }
  
  // Add the last invoice
  if (inInvoice && currentInvoice.length > 0) {
    invoices.push(currentInvoice);
    console.log(`Saved final invoice with ${currentInvoice.length} lines`);
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
  
  return invoices.length > 0 ? invoices : [lines];
};

const parseSingleInvoice = (lines, index) => {
  try {
    const text = lines.join('\n');
    
    // Extract invoice date
    const invoiceDateMatch = text.match(/Invoice Date\s*:\s*(\d{2}\/\d{2}\/\d{4})/);
    if (!invoiceDateMatch) {
      console.log(`Invoice ${index + 1}: No invoice date found`);
      return null;
    }
    
    const invoiceDate = moment(invoiceDateMatch[1], 'DD/MM/YYYY');
    const today = moment().startOf('day');
    
    // Extract store information
    const storeMatch = text.match(/OM SHREE ASHTAVINAYAK ENTERPRISE \( SHAHAD \) - R3309/);
    if (!storeMatch) {
      console.log(`Invoice ${index + 1}: Store information not found`);
      return null;
    }
    
    // Extract invoice number
    const invoiceNoMatch = text.match(/Invoice No\.\s*:\s*([A-Z0-9\/]+)/);
    const invoiceNo = invoiceNoMatch ? invoiceNoMatch[1] : `Unknown-${index + 1}`;
    
    console.log(`Invoice ${index + 1}: Parsing invoice ${invoiceNo}`);
    
    // Parse table data with regex approach
    const { items, totalQty, totalAmount } = parseTableDataRegex(text);
    
    // Extract net value
    const netValueMatch = text.match(/Net Value\s*(\d+\.\d{2})/);
    const netValue = netValueMatch ? parseFloat(netValueMatch[1]) : totalAmount;
    
    // Get page count
    const pageCount = getPageCount(text);
    
    console.log(`Invoice ${index + 1}: Parsed ${items.length} items, total quantity: ${totalQty}, total amount: ${netValue}`);
    
    return {
      invoiceNo,
      invoiceDate: invoiceDate.format('YYYY-MM-DD'),
      store: 'OM SHREE ASHTAVINAYAK ENTERPRISE ( SHAHAD ) - R3309',
      items: items,
      totalQty,
      totalAmount: netValue,
      pageCount,
      validation: {
        isToday: invoiceDate.isSame(today, 'day'),
        isCorrectStore: true,
        isValid: items.length > 0
      }
    };
  } catch (error) {
    console.error(`Error parsing invoice ${index + 1}:`, error.message);
    return null;
  }
};

const parseTableDataRegex = (text) => {
  const items = [];
  let totalQty = 0;
  let totalAmount = 0;
  
  // Simple, flexible regex to catch all items including potato wafers
  // Pattern: SlNo + ItemCode + ItemName + HSNCode + Qty + UOM + Rate + Total
  const rowRegex = /(\d{1,2})\s+([A-Z0-9]{4,5})\s+(.+?)\s+(\d{8})\s+(\d{1,3})\s+([A-Z]+)\s+(\d+\.\d{2})/gm;
  
  let match;
  while ((match = rowRegex.exec(text)) !== null) {
    const slNo = parseInt(match[1]) || 0;
    const itemCode = match[2];
    let itemName = match[3].trim();
    
    // Clean up item name - remove extra spaces and limit length
    itemName = itemName.replace(/\s+/g, ' ').substring(0, 50);
    const hsnCode = match[4].trim();
    const qty = parseInt(match[5]) || 0;
    const uom = match[6];
    const rate = parseFloat(match[7]) || 0;
    const total = qty * rate;

    // Detailed debug logs
    console.log(`Match ${slNo}: Full=[${match[0]}], slNo=${match[1]}, itemCode=${match[2]}, itemName="${match[3]}", hsn=${match[4]}, qty=${match[5]}, uom=${match[6]}, rate=${match[7]}, total=${total}`);

    // Validate and add item - allow different item code lengths
    if (slNo > 0 && itemCode.length >= 4 && itemName.length > 0 && qty > 0 && rate > 0) {
      const item = {
        slNo,
        itemCode,
        itemName,
        hsnCode,
        qty,
        uom,
        rate,
        total
      };
      items.push(item);
      totalQty += qty;
      totalAmount += total;
      
      console.log(`Parsed item ${slNo}: ${itemCode} - ${itemName} - HSN: ${hsnCode} - Qty: ${qty} - Rate: ${rate} - Total: ${total}`);
    } else {
      console.log(`Rejected item ${slNo}: Validation failed - Code=${itemCode}, Name="${itemName}", Qty=${qty}, Rate=${rate}`);
    }
  }
  
  // Stop at "Total" line
  if (text.includes('Total67')) {
    console.log('Table end detected');
  }
  
  return { items, totalQty, totalAmount };
};

const getPageCount = (text) => {
  // Count all "Page No:" occurrences to determine total pages
  const pageMatches = text.match(/Page No:\s*\d+/g) || [];
  return pageMatches.length;
};

const validateInvoice = async (buffer, expectedDate = null) => {
  try {
    const data = await pdf(buffer);
    const text = data.text;
    
    const invoiceDateMatch = text.match(/Invoice Date\s*:\s*(\d{2}\/\d{2}\/\d{4})/);
    if (!invoiceDateMatch) {
      return { isValid: false, error: 'Invoice date not found' };
    }
    
    const invoiceDate = moment(invoiceDateMatch[1], 'DD/MM/YYYY');
    const today = moment().startOf('day');
    
    const storeMatch = text.match(/OM SHREE ASHTAVINAYAK ENTERPRISE \( SHAHAD \) - R3309/);
    if (!storeMatch) {
      return { isValid: false, error: 'Store information not found or does not match R3309' };
    }
    
    return {
      isValid: true,
      invoiceDate: invoiceDate.format('YYYY-MM-DD'),
      invoiceNo: text.match(/Invoice No\.\s*:\s*([A-Z0-9\/]+)/)?.[1] || 'Unknown'
    };
  } catch (error) {
    return { isValid: false, error: 'Failed to validate PDF: ' + error.message };
  }
};

module.exports = { parseInvoice, validateInvoice };