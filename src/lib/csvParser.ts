import { CsvTransaction } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface CsvColumnMapping {
  dateIndex: number;
  descriptionIndex: number;
  amountIndex: number;
  categoryIndex?: number;
}

// Suggest category based on transaction description
function suggestCategory(description: string): string | undefined {
  const desc = description.toLowerCase();

  const categoryKeywords: Record<string, string[]> = {
    groceries: ['grocery', 'walmart', 'target', 'costco', 'kroger', 'safeway', 'whole foods', 'trader joe', 'supermarket', 'fresh', 'market'],
    transport: ['uber', 'lyft', 'gas', 'shell', 'chevron', 'exxon', 'parking', 'transit', 'petrol', 'fuel', 'metro', 'bus', 'train'],
    dining: ['restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonald', 'chipotle', 'domino', 'pizza', 'doordash', 'grubhub', 'zomato', 'swiggy', 'food'],
    utilities: ['electric', 'power', 'water', 'gas bill', 'internet', 'comcast', 'verizon', 'at&t', 'phone', 'broadband', 'wifi'],
    entertainment: ['netflix', 'spotify', 'hulu', 'disney', 'amazon prime', 'movie', 'theater', 'game', 'youtube', 'hotstar'],
    shopping: ['amazon', 'ebay', 'best buy', 'apple', 'clothing', 'fashion', 'store', 'flipkart', 'myntra'],
    health: ['pharmacy', 'cvs', 'walgreens', 'doctor', 'medical', 'hospital', 'gym', 'fitness', 'apollo', 'medplus'],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (desc.includes(keyword)) {
        return category;
      }
    }
  }

  return undefined;
}

export function parseCSV(csvContent: string): { headers: string[]; rows: string[][] } {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow).filter(row => row.some(cell => cell));

  return { headers, rows };
}

export function detectColumnMapping(headers: string[]): CsvColumnMapping | null {
  const lowerHeaders = headers.map(h => h.toLowerCase());

  // Common column name patterns for bank/credit card statements
  const datePatterns = ['date', 'transaction date', 'trans date', 'posting date', 'value date', 'txn date', 'time'];
  const descPatterns = ['description', 'desc', 'narrative', 'particulars', 'details', 'merchant', 'name', 'payee', 'memo', 'transaction', 'narration', 'remarks'];
  const amountPatterns = ['amount', 'debit', 'credit', 'withdrawal', 'deposit', 'value', 'sum', 'dr', 'cr'];
  const categoryPatterns = ['category', 'type', 'class', 'tag'];

  let dateIndex = -1;
  let descriptionIndex = -1;
  let amountIndex = -1;
  let categoryIndex = -1;

  for (let i = 0; i < lowerHeaders.length; i++) {
    const header = lowerHeaders[i];

    if (dateIndex === -1 && datePatterns.some(p => header.includes(p))) {
      dateIndex = i;
    }
    if (descriptionIndex === -1 && descPatterns.some(p => header.includes(p))) {
      descriptionIndex = i;
    }
    if (amountIndex === -1 && amountPatterns.some(p => header.includes(p))) {
      amountIndex = i;
    }
    if (categoryIndex === -1 && categoryPatterns.some(p => header.includes(p))) {
      categoryIndex = i;
    }
  }

  // If description not found but we have remaining columns, pick the longest text column
  if (descriptionIndex === -1 && headers.length >= 3) {
    for (let i = 0; i < headers.length; i++) {
      if (i !== dateIndex && i !== amountIndex && i !== categoryIndex) {
        descriptionIndex = i;
        break;
      }
    }
  }

  // If we couldn't find by name, try position-based detection
  if (dateIndex === -1 || descriptionIndex === -1 || amountIndex === -1) {
    // Common formats: Date, Description, Amount or Description, Amount, Date
    if (headers.length >= 3) {
      if (dateIndex === -1) {
        dateIndex = 0; // Assume first column is date
      }
      if (descriptionIndex === -1) {
        descriptionIndex = 1; // Assume second column is description
      }
      if (amountIndex === -1) {
        amountIndex = headers.length - 1; // Assume last column is amount
      }
    }
  }

  if (dateIndex === -1 || descriptionIndex === -1 || amountIndex === -1) {
    return null;
  }

  return {
    dateIndex,
    descriptionIndex,
    amountIndex,
    categoryIndex: categoryIndex !== -1 ? categoryIndex : undefined,
  };
}

function parseCsvDate(dateStr: string): string | null {
  if (!dateStr) return null;

  const cleaned = dateStr.replace(/"/g, '').trim();

  // Try ISO format first (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  // Try various other formats
  const formats = [
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/, // DD/MM/YYYY or MM/DD/YYYY
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})/, // DD/MM/YY or MM/DD/YY
    /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/, // YYYY/MM/DD
  ];

  for (const format of formats) {
    const match = cleaned.match(format);
    if (match) {
      let year: string, month: string, day: string;

      if (format.source.startsWith('(\\d{4})')) {
        // YYYY/MM/DD format
        [, year, month, day] = match;
      } else {
        // MM/DD/YYYY or DD/MM/YYYY - assume MM/DD/YYYY (US format)
        let part1, part2;
        [, part1, part2, year] = match;

        if (year.length === 2) {
          year = '20' + year;
        }

        // Heuristic: if first part > 12, it's likely day
        if (parseInt(part1) > 12) {
          day = part1;
          month = part2;
        } else {
          month = part1;
          day = part2;
        }
      }

      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }

  // Try native Date parsing as fallback
  const date = new Date(cleaned);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  return null;
}

export function parseCsvTransactions(
  rows: string[][],
  mapping: CsvColumnMapping
): CsvTransaction[] {
  const transactions: CsvTransaction[] = [];

  for (const row of rows) {
    if (row.length <= Math.max(mapping.dateIndex, mapping.descriptionIndex, mapping.amountIndex)) {
      continue;
    }

    const dateStr = row[mapping.dateIndex];
    const description = row[mapping.descriptionIndex];
    const amountStr = row[mapping.amountIndex];
    const categoryFromCsv = mapping.categoryIndex !== undefined ? row[mapping.categoryIndex] : undefined;

    // Parse amount - handle various formats
    const cleanAmount = amountStr
      .replace(/[^0-9.\-,]/g, '')
      .replace(/,(?=\d{3})/g, '') // Remove thousand separators
      .replace(',', '.'); // Convert European decimal separator

    let amount = parseFloat(cleanAmount);
    if (isNaN(amount)) continue;

    // Handle negative amounts (expenses are typically negative in statements)
    amount = Math.abs(amount);
    if (amount <= 0) continue;

    // Parse date
    const date = parseCsvDate(dateStr) || new Date().toISOString().split('T')[0];

    // Clean description
    const cleanDesc = description
      .replace(/"/g, '')
      .trim()
      .slice(0, 100);

    if (!cleanDesc) continue;

    transactions.push({
      id: uuidv4(),
      date,
      description: cleanDesc,
      amount,
      selected: true,
      category: categoryFromCsv?.toLowerCase() || suggestCategory(cleanDesc),
    });
  }

  return transactions;
}
