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
    
    // Extract invoice date
    const invoiceDateMatch = text.match(/Invoice Date\s*:\s*(\d{2}\/\d{2}\/\d{4})/);
    if (!invoiceDateMatch) {
      throw new Error('Invoice date not found in the document');
    }
    
    const invoiceDate = moment(invoiceDateMatch[1], 'DD/MM/YYYY');
    const today = moment().startOf('day');
    
    // Extract store information
    const storeMatch = text.match(/OM SHREE ASHTAVINAYAK ENTERPRISE \( SHAHAD \) - R3309/);
    if (!storeMatch) {
      throw new Error('Store information not found or does not match R3309');
    }
    
    // Extract invoice number
    const invoiceNoMatch = text.match(/Invoice No\.\s*:\s*([A-Z0-9\/]+)/);
    const invoiceNo = invoiceNoMatch ? invoiceNoMatch[1] : 'Unknown';
    
    // Parse table data with regex approach
    const { items, totalQty, totalAmount } = parseTableDataRegex(text);
    
    // Extract net value
    const netValueMatch = text.match(/Net Value\s*(\d+\.\d{2})/);
    const netValue = netValueMatch ? parseFloat(netValueMatch[1]) : totalAmount;
    
    // Get page count
    const pageCount = getPageCount(text);
    
    console.log(`Parsed ${items.length} items from invoice, total quantity: ${totalQty}, total amount: ${netValue}`);
    
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
    throw new Error('Failed to parse PDF: ' + error.message);
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
  
  console.log(`Parsed ${items.length} items, total quantity: ${totalQty}, total amount: ${totalAmount}`);
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