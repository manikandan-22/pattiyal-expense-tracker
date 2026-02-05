import { google, sheets_v4 } from 'googleapis';
import crypto from 'crypto';
import { Expense, Category, UserSettings, DEFAULT_CATEGORIES, DEFAULT_SETTINGS, PendingTransaction, TransactionRule } from '@/types';
import { extractYearFromId } from '@/lib/id-utils';

// ============================================
// In-memory cache with TTL
// ============================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cacheStore = new Map<string, CacheEntry<unknown>>();

function cacheGet<T>(key: string): T | null {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }
  return entry.data as T;
}

function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  cacheStore.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function cacheDelete(key: string): void {
  cacheStore.delete(key);
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
}

const SPREADSHEET_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const CATEGORIES_CACHE_TTL = 5 * 60 * 1000;   // 5 minutes
const SETTINGS_CACHE_TTL = 5 * 60 * 1000;     // 5 minutes

// Sheet names for main spreadsheet
const CATEGORIES_SHEET = 'Categories';
const SETTINGS_SHEET = 'Settings';
const getExpensesSheetName = (year: number) => `Expenses ${year}`;

// Sheet names for import spreadsheet
const AUTO_MAPPED_SHEET = 'AutoMapped';
const UNCATEGORIZED_SHEET = 'Uncategorized';
const IGNORED_SHEET = 'Ignored';

// Spreadsheet names
const MAIN_SPREADSHEET_NAME = 'Expense Tracker';
const IMPORT_SPREADSHEET_NAME = 'Expense Tracker - Import';
const LEGACY_SPREADSHEET_NAME = 'Expense Tracker Data';

// Transaction columns for import sheets
const TRANSACTION_HEADERS = ['id', 'date', 'description', 'amount', 'category', 'matchedRuleId', 'createdAt'];

export function createSheetsClient(accessToken: string): sheets_v4.Sheets {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: 'v4', auth });
}

export function createDriveClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth });
}

// ============================================
// Main Spreadsheet Operations
// ============================================

/**
 * Get or create the main spreadsheet (single file for all data)
 */
export async function getOrCreateSpreadsheet(
  accessToken: string,
  _year?: number // Keep parameter for backwards compatibility but ignore it
): Promise<string> {
  const cacheKey = `spreadsheet:${hashToken(accessToken)}`;
  const cached = cacheGet<string>(cacheKey);
  if (cached) return cached;

  const drive = createDriveClient(accessToken);
  const sheets = createSheetsClient(accessToken);

  // Search for main spreadsheet first
  let searchResponse = await drive.files.list({
    q: `name='${MAIN_SPREADSHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  let files = searchResponse.data.files;
  if (files && files.length > 0 && files[0].id) {
    cacheSet(cacheKey, files[0].id, SPREADSHEET_CACHE_TTL);
    return files[0].id;
  }

  // Fall back to legacy name ("Expense Tracker Data")
  searchResponse = await drive.files.list({
    q: `name='${LEGACY_SPREADSHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  files = searchResponse.data.files;
  if (files && files.length > 0 && files[0].id) {
    cacheSet(cacheKey, files[0].id, SPREADSHEET_CACHE_TTL);
    return files[0].id;
  }

  // Create new main spreadsheet
  const currentYear = new Date().getFullYear();
  const createResponse = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: MAIN_SPREADSHEET_NAME,
      },
      sheets: [
        {
          properties: {
            title: CATEGORIES_SHEET,
            gridProperties: { frozenRowCount: 1 },
          },
        },
        {
          properties: {
            title: SETTINGS_SHEET,
            gridProperties: { frozenRowCount: 1 },
          },
        },
        {
          properties: {
            title: getExpensesSheetName(currentYear),
            gridProperties: { frozenRowCount: 1 },
          },
        },
      ],
    },
  });

  const spreadsheetId = createResponse.data.spreadsheetId!;
  cacheSet(cacheKey, spreadsheetId, SPREADSHEET_CACHE_TTL);

  // Add headers to Categories sheet
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${CATEGORIES_SHEET}!A1:D1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [['id', 'name', 'color', 'icon']],
    },
  });

  // Add default categories
  const categoryRows = DEFAULT_CATEGORIES.map((cat) => [
    cat.id,
    cat.name,
    cat.color,
    cat.icon || '',
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${CATEGORIES_SHEET}!A2:D`,
    valueInputOption: 'RAW',
    requestBody: {
      values: categoryRows,
    },
  });

  // Add headers to Settings sheet
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SETTINGS_SHEET}!A1:B1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [['key', 'value']],
    },
  });

  // Add default settings
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SETTINGS_SHEET}!A2:B`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        ['currency', DEFAULT_SETTINGS.currency],
        ['onboardingCompleted', 'false'],
        ['rules', '[]'],
      ],
    },
  });

  // Add headers to current year Expenses sheet
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${getExpensesSheetName(currentYear)}'!A1:G1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [['id', 'amount', 'date', 'category', 'description', 'createdAt', 'updatedAt']],
    },
  });

  return spreadsheetId;
}

/**
 * Ensure a year-specific expenses sheet exists in the main spreadsheet
 */
async function ensureYearExpensesSheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  year: number
): Promise<void> {
  const sheetName = getExpensesSheetName(year);
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetExists = spreadsheet.data.sheets?.some(
    (s) => s.properties?.title === sheetName
  );

  if (!sheetExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          },
        ],
      },
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!A1:G1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['id', 'amount', 'date', 'category', 'description', 'createdAt', 'updatedAt']],
      },
    });
  }
}

// ============================================
// Import Spreadsheet Operations
// ============================================

/**
 * Get or create the import spreadsheet (separate file for pending transactions)
 */
export async function getOrCreateImportSpreadsheet(accessToken: string): Promise<string> {
  const drive = createDriveClient(accessToken);
  const sheets = createSheetsClient(accessToken);

  // Search for import spreadsheet
  const searchResponse = await drive.files.list({
    q: `name='${IMPORT_SPREADSHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  const files = searchResponse.data.files;
  if (files && files.length > 0 && files[0].id) {
    return files[0].id;
  }

  // Create new import spreadsheet
  const createResponse = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: IMPORT_SPREADSHEET_NAME,
      },
      sheets: [
        {
          properties: {
            title: AUTO_MAPPED_SHEET,
            gridProperties: { frozenRowCount: 1 },
          },
        },
        {
          properties: {
            title: UNCATEGORIZED_SHEET,
            gridProperties: { frozenRowCount: 1 },
          },
        },
        {
          properties: {
            title: IGNORED_SHEET,
            gridProperties: { frozenRowCount: 1 },
          },
        },
      ],
    },
  });

  const spreadsheetId = createResponse.data.spreadsheetId!;

  // Add headers to all import sheets
  for (const sheetName of [AUTO_MAPPED_SHEET, UNCATEGORIZED_SHEET, IGNORED_SHEET]) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:G1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [TRANSACTION_HEADERS],
      },
    });
  }

  return spreadsheetId;
}

/**
 * Ensure import sheet exists with correct headers
 */
async function ensureImportSheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string
): Promise<void> {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetExists = spreadsheet.data.sheets?.some(
    (s) => s.properties?.title === sheetName
  );

  if (!sheetExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          },
        ],
      },
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:G1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [TRANSACTION_HEADERS],
      },
    });
  }
}

// ============================================
// Expense Operations (using year-specific sheets)
// ============================================

export async function getExpenses(
  accessToken: string,
  spreadsheetId: string,
  year?: number
): Promise<Expense[]> {
  const sheets = createSheetsClient(accessToken);
  const targetYear = year || new Date().getFullYear();
  const sheetName = getExpensesSheetName(targetYear);

  try {
    await ensureYearExpensesSheet(sheets, spreadsheetId, targetYear);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A2:G`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    return rows.map((row) => ({
      id: row[0] || '',
      amount: parseFloat(row[1]) || 0,
      date: row[2] || '',
      category: row[3] || '',
      description: row[4] || '',
      createdAt: row[5] || '',
      updatedAt: row[6] || '',
    }));
  } catch (error) {
    console.error(`Error reading expenses for year ${targetYear}:`, error);
    return [];
  }
}

/**
 * Get expenses from all years (for reports, etc.)
 */
export async function getAllExpenses(
  accessToken: string,
  spreadsheetId: string
): Promise<Expense[]> {
  const sheets = createSheetsClient(accessToken);
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });

  const expenseSheets = spreadsheet.data.sheets?.filter(
    (s) => s.properties?.title?.startsWith('Expenses ')
  ) || [];

  const allExpenses: Expense[] = [];

  for (const sheet of expenseSheets) {
    const sheetName = sheet.properties?.title;
    if (!sheetName) continue;

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!A2:G`,
      });

      const rows = response.data.values;
      if (rows && rows.length > 0) {
        const expenses = rows.map((row) => ({
          id: row[0] || '',
          amount: parseFloat(row[1]) || 0,
          date: row[2] || '',
          category: row[3] || '',
          description: row[4] || '',
          createdAt: row[5] || '',
          updatedAt: row[6] || '',
        }));
        allExpenses.push(...expenses);
      }
    } catch {
      // Continue with other sheets if one fails
    }
  }

  return allExpenses;
}

export async function addExpense(
  accessToken: string,
  expense: Expense
): Promise<void> {
  const spreadsheetId = await getOrCreateSpreadsheet(accessToken);
  const sheets = createSheetsClient(accessToken);
  const year = new Date(expense.date).getFullYear();
  const sheetName = getExpensesSheetName(year);

  await ensureYearExpensesSheet(sheets, spreadsheetId, year);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${sheetName}'!A2:G`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[
        expense.id,
        expense.amount,
        expense.date,
        expense.category,
        expense.description,
        expense.createdAt,
        expense.updatedAt,
      ]],
    },
  });
}

export async function updateExpense(
  accessToken: string,
  expense: Expense
): Promise<void> {
  const spreadsheetId = await getOrCreateSpreadsheet(accessToken);
  const sheets = createSheetsClient(accessToken);
  const year = new Date(expense.date).getFullYear();
  const sheetName = getExpensesSheetName(year);

  await ensureYearExpensesSheet(sheets, spreadsheetId, year);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'!A:A`,
  });

  const rows = response.data.values;
  if (!rows) return;

  const rowIndex = rows.findIndex((row) => row[0] === expense.id);
  if (rowIndex === -1) return;

  const sheetRow = rowIndex + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!A${sheetRow}:G${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        expense.id,
        expense.amount,
        expense.date,
        expense.category,
        expense.description,
        expense.createdAt,
        expense.updatedAt,
      ]],
    },
  });
}

export async function deleteExpense(
  accessToken: string,
  spreadsheetId: string,
  expenseId: string,
  year?: number
): Promise<void> {
  const sheets = createSheetsClient(accessToken);
  const targetYear = year || extractYearFromId(expenseId);

  if (!targetYear) {
    throw new Error(`Cannot determine year for expense ID: ${expenseId}`);
  }

  const sheetName = getExpensesSheetName(targetYear);
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === sheetName
  );
  if (!sheet?.properties?.sheetId) return;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'!A:A`,
  });

  const rows = response.data.values;
  if (!rows) return;

  const rowIndex = rows.findIndex((row) => row[0] === expenseId);
  if (rowIndex === -1) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });
}

export async function addExpensesBatch(
  accessToken: string,
  expenses: Expense[]
): Promise<void> {
  const spreadsheetId = await getOrCreateSpreadsheet(accessToken);
  const sheets = createSheetsClient(accessToken);

  // Group expenses by year
  const expensesByYear = expenses.reduce((acc, expense) => {
    const year = new Date(expense.date).getFullYear();
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(expense);
    return acc;
  }, {} as Record<number, Expense[]>);

  for (const yearStr in expensesByYear) {
    const year = parseInt(yearStr);
    const sheetName = getExpensesSheetName(year);

    await ensureYearExpensesSheet(sheets, spreadsheetId, year);

    const values = expensesByYear[year].map((expense) => [
      expense.id,
      expense.amount,
      expense.date,
      expense.category,
      expense.description,
      expense.createdAt,
      expense.updatedAt,
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${sheetName}'!A2:G`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values,
      },
    });
  }
}

// ============================================
// Category Operations
// ============================================

export async function getCategories(
  accessToken: string,
  spreadsheetId: string
): Promise<Category[]> {
  const cacheKey = `categories:${spreadsheetId}`;
  const cached = cacheGet<Category[]>(cacheKey);
  if (cached) return cached;

  const sheets = createSheetsClient(accessToken);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${CATEGORIES_SHEET}!A2:D`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    cacheSet(cacheKey, DEFAULT_CATEGORIES, CATEGORIES_CACHE_TTL);
    return DEFAULT_CATEGORIES;
  }

  const categories = rows.map((row) => ({
    id: row[0] || '',
    name: row[1] || '',
    color: row[2] || '#D4D4D4',
    icon: row[3] || undefined,
  }));
  cacheSet(cacheKey, categories, CATEGORIES_CACHE_TTL);
  return categories;
}

export async function addCategory(
  accessToken: string,
  spreadsheetId: string,
  category: Category
): Promise<void> {
  const sheets = createSheetsClient(accessToken);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${CATEGORIES_SHEET}!A2:D`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[
        category.id,
        category.name,
        category.color,
        category.icon || '',
      ]],
    },
  });
  cacheDelete(`categories:${spreadsheetId}`);
}

export async function updateCategory(
  accessToken: string,
  spreadsheetId: string,
  category: Category
): Promise<void> {
  const sheets = createSheetsClient(accessToken);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${CATEGORIES_SHEET}!A:A`,
  });

  const rows = response.data.values;
  if (!rows) return;

  const rowIndex = rows.findIndex((row) => row[0] === category.id);
  if (rowIndex === -1) return;

  const sheetRow = rowIndex + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${CATEGORIES_SHEET}!A${sheetRow}:D${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        category.id,
        category.name,
        category.color,
        category.icon || '',
      ]],
    },
  });
  cacheDelete(`categories:${spreadsheetId}`);
}

export async function deleteCategory(
  accessToken: string,
  spreadsheetId: string,
  categoryId: string
): Promise<void> {
  const sheets = createSheetsClient(accessToken);

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const categoriesSheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === CATEGORIES_SHEET
  );
  if (!categoriesSheet?.properties?.sheetId) return;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${CATEGORIES_SHEET}!A:A`,
  });

  const rows = response.data.values;
  if (!rows) return;

  const rowIndex = rows.findIndex((row) => row[0] === categoryId);
  if (rowIndex === -1) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: categoriesSheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });
  cacheDelete(`categories:${spreadsheetId}`);
}

// ============================================
// Settings Operations
// ============================================

export async function getSettings(
  accessToken: string,
  spreadsheetId: string
): Promise<UserSettings> {
  const cacheKey = `settings:${spreadsheetId}`;
  const cached = cacheGet<UserSettings>(cacheKey);
  if (cached) return cached;

  const sheets = createSheetsClient(accessToken);

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SETTINGS_SHEET}!A2:B`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      cacheSet(cacheKey, DEFAULT_SETTINGS, SETTINGS_CACHE_TTL);
      return DEFAULT_SETTINGS;
    }

    const settings: UserSettings = { ...DEFAULT_SETTINGS };

    for (const row of rows) {
      const key = row[0];
      const value = row[1];

      if (key === 'currency') {
        settings.currency = value as UserSettings['currency'];
      } else if (key === 'onboardingCompleted') {
        settings.onboardingCompleted = value === 'true';
      }
    }

    cacheSet(cacheKey, settings, SETTINGS_CACHE_TTL);
    return settings;
  } catch (error) {
    console.error('Error reading settings, using defaults:', error);
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(
  accessToken: string,
  spreadsheetId: string,
  settings: UserSettings
): Promise<void> {
  const sheets = createSheetsClient(accessToken);

  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const settingsSheetExists = spreadsheet.data.sheets?.some(
      (s) => s.properties?.title === SETTINGS_SHEET
    );

    if (!settingsSheetExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: SETTINGS_SHEET,
                  gridProperties: { frozenRowCount: 1 },
                },
              },
            },
          ],
        },
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SETTINGS_SHEET}!A1:B1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['key', 'value']],
        },
      });
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SETTINGS_SHEET}!A2:B3`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          ['currency', settings.currency],
          ['onboardingCompleted', settings.onboardingCompleted.toString()],
        ],
      },
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    throw error;
  }
  cacheDelete(`settings:${spreadsheetId}`);
}

// ============================================
// Pending Transactions Operations (Import Spreadsheet)
// ============================================

function getSheetNameForStatus(status: PendingTransaction['status']): string {
  switch (status) {
    case 'auto-mapped':
      return AUTO_MAPPED_SHEET;
    case 'ignored':
      return IGNORED_SHEET;
    default:
      return UNCATEGORIZED_SHEET;
  }
}

function transactionToRow(t: PendingTransaction): (string | number)[] {
  return [
    t.id,
    t.date,
    t.description,
    t.amount,
    t.category || '',
    t.matchedRuleId || '',
    t.createdAt,
  ];
}

function rowToTransaction(row: string[], status: PendingTransaction['status']): PendingTransaction {
  return {
    id: row[0] || '',
    date: row[1] || '',
    description: row[2] || '',
    amount: parseFloat(row[3]) || 0,
    category: row[4] || undefined,
    status,
    matchedRuleId: row[5] || undefined,
    createdAt: row[6] || '',
  };
}

export async function getPendingTransactions(
  accessToken: string,
  _spreadsheetId?: string // Ignored, uses import spreadsheet
): Promise<PendingTransaction[]> {
  const importSpreadsheetId = await getOrCreateImportSpreadsheet(accessToken);
  const sheets = createSheetsClient(accessToken);
  const allTransactions: PendingTransaction[] = [];

  const sheetConfigs: { name: string; status: PendingTransaction['status'] }[] = [
    { name: AUTO_MAPPED_SHEET, status: 'auto-mapped' },
    { name: UNCATEGORIZED_SHEET, status: 'uncategorized' },
    { name: IGNORED_SHEET, status: 'ignored' },
  ];

  for (const config of sheetConfigs) {
    try {
      await ensureImportSheet(sheets, importSpreadsheetId, config.name);

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: importSpreadsheetId,
        range: `${config.name}!A2:G`,
      });

      const rows = response.data.values;
      if (rows && rows.length > 0) {
        const transactions = rows.map((row) => rowToTransaction(row, config.status));
        allTransactions.push(...transactions);
      }
    } catch (error) {
      console.error(`Error reading ${config.name} sheet:`, error);
    }
  }

  return allTransactions;
}

export async function addPendingTransactions(
  accessToken: string,
  _spreadsheetId: string, // Ignored
  transactions: PendingTransaction[]
): Promise<void> {
  const importSpreadsheetId = await getOrCreateImportSpreadsheet(accessToken);
  const sheets = createSheetsClient(accessToken);

  // Group transactions by status/sheet
  const bySheet: Record<string, PendingTransaction[]> = {};
  for (const t of transactions) {
    const sheetName = getSheetNameForStatus(t.status);
    if (!bySheet[sheetName]) {
      bySheet[sheetName] = [];
    }
    bySheet[sheetName].push(t);
  }

  for (const sheetName in bySheet) {
    await ensureImportSheet(sheets, importSpreadsheetId, sheetName);

    const values = bySheet[sheetName].map(transactionToRow);

    await sheets.spreadsheets.values.append({
      spreadsheetId: importSpreadsheetId,
      range: `${sheetName}!A2:G`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });
  }
}

export async function updatePendingTransaction(
  accessToken: string,
  _spreadsheetId: string, // Ignored
  transaction: PendingTransaction
): Promise<void> {
  const importSpreadsheetId = await getOrCreateImportSpreadsheet(accessToken);
  const sheets = createSheetsClient(accessToken);

  // We need to find which sheet the transaction is currently in
  // and move it if the status changed
  const allSheets = [AUTO_MAPPED_SHEET, UNCATEGORIZED_SHEET, IGNORED_SHEET];
  const targetSheet = getSheetNameForStatus(transaction.status);

  for (const sheetName of allSheets) {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: importSpreadsheetId,
        range: `${sheetName}!A:A`,
      });

      const rows = response.data.values;
      if (!rows) continue;

      const rowIndex = rows.findIndex((row) => row[0] === transaction.id);
      if (rowIndex === -1) continue;

      // Found the transaction
      if (sheetName === targetSheet) {
        // Same sheet, just update
        const sheetRow = rowIndex + 1;
        await sheets.spreadsheets.values.update({
          spreadsheetId: importSpreadsheetId,
          range: `${sheetName}!A${sheetRow}:G${sheetRow}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [transactionToRow(transaction)],
          },
        });
      } else {
        // Different sheet, delete from old and add to new
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: importSpreadsheetId });
        const sheet = spreadsheet.data.sheets?.find(
          (s) => s.properties?.title === sheetName
        );

        if (sheet?.properties?.sheetId) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: importSpreadsheetId,
            requestBody: {
              requests: [
                {
                  deleteDimension: {
                    range: {
                      sheetId: sheet.properties.sheetId,
                      dimension: 'ROWS',
                      startIndex: rowIndex,
                      endIndex: rowIndex + 1,
                    },
                  },
                },
              ],
            },
          });
        }

        // Add to target sheet
        await ensureImportSheet(sheets, importSpreadsheetId, targetSheet);
        await sheets.spreadsheets.values.append({
          spreadsheetId: importSpreadsheetId,
          range: `${targetSheet}!A2:G`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: [transactionToRow(transaction)],
          },
        });
      }
      return;
    } catch {
      continue;
    }
  }
}

export async function deletePendingTransaction(
  accessToken: string,
  _spreadsheetId: string, // Ignored
  transactionId: string
): Promise<void> {
  const importSpreadsheetId = await getOrCreateImportSpreadsheet(accessToken);
  const sheets = createSheetsClient(accessToken);

  const allSheets = [AUTO_MAPPED_SHEET, UNCATEGORIZED_SHEET, IGNORED_SHEET];

  for (const sheetName of allSheets) {
    try {
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: importSpreadsheetId });
      const sheet = spreadsheet.data.sheets?.find(
        (s) => s.properties?.title === sheetName
      );
      if (!sheet?.properties?.sheetId) continue;

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: importSpreadsheetId,
        range: `${sheetName}!A:A`,
      });

      const rows = response.data.values;
      if (!rows) continue;

      const rowIndex = rows.findIndex((row) => row[0] === transactionId);
      if (rowIndex === -1) continue;

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: importSpreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: sheet.properties.sheetId,
                  dimension: 'ROWS',
                  startIndex: rowIndex,
                  endIndex: rowIndex + 1,
                },
              },
            },
          ],
        },
      });
      return;
    } catch {
      continue;
    }
  }
}

export async function updateAllPendingTransactions(
  accessToken: string,
  _spreadsheetId: string, // Ignored
  transactions: PendingTransaction[]
): Promise<void> {
  const importSpreadsheetId = await getOrCreateImportSpreadsheet(accessToken);
  const sheets = createSheetsClient(accessToken);

  // Group transactions by status/sheet
  const bySheet: Record<string, PendingTransaction[]> = {
    [AUTO_MAPPED_SHEET]: [],
    [UNCATEGORIZED_SHEET]: [],
    [IGNORED_SHEET]: [],
  };

  for (const t of transactions) {
    const sheetName = getSheetNameForStatus(t.status);
    bySheet[sheetName].push(t);
  }

  // Clear and repopulate each sheet
  for (const sheetName in bySheet) {
    await ensureImportSheet(sheets, importSpreadsheetId, sheetName);

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: importSpreadsheetId });
    const sheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === sheetName
    );

    if (sheet?.properties?.sheetId) {
      // Get current row count
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: importSpreadsheetId,
        range: `${sheetName}!A:A`,
      });

      const currentRows = response.data.values?.length || 1;

      if (currentRows > 1) {
        // Delete all rows except header
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: importSpreadsheetId,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: sheet.properties.sheetId,
                    dimension: 'ROWS',
                    startIndex: 1,
                    endIndex: currentRows,
                  },
                },
              },
            ],
          },
        });
      }
    }

    // Add transactions for this sheet
    if (bySheet[sheetName].length > 0) {
      const values = bySheet[sheetName].map(transactionToRow);

      await sheets.spreadsheets.values.append({
        spreadsheetId: importSpreadsheetId,
        range: `${sheetName}!A2:G`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values },
      });
    }
  }
}

/**
 * Move confirmed transactions from import sheets to expense sheets
 * and delete them from import spreadsheet
 */
export async function moveTransactionsToExpenses(
  accessToken: string,
  transactionIds: string[]
): Promise<void> {
  if (transactionIds.length === 0) return;

  const importSpreadsheetId = await getOrCreateImportSpreadsheet(accessToken);
  const mainSpreadsheetId = await getOrCreateSpreadsheet(accessToken);
  const sheets = createSheetsClient(accessToken);

  // Find and collect transactions to move
  const transactionsToMove: PendingTransaction[] = [];
  const idsToDelete: { sheetName: string; rowIndex: number; sheetId: number }[] = [];

  const allSheets = [AUTO_MAPPED_SHEET, UNCATEGORIZED_SHEET];

  for (const sheetName of allSheets) {
    try {
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: importSpreadsheetId });
      const sheet = spreadsheet.data.sheets?.find(
        (s) => s.properties?.title === sheetName
      );
      if (!sheet?.properties?.sheetId) continue;

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: importSpreadsheetId,
        range: `${sheetName}!A2:G`,
      });

      const rows = response.data.values;
      if (!rows) continue;

      const status = sheetName === AUTO_MAPPED_SHEET ? 'auto-mapped' : 'uncategorized';

      rows.forEach((row, idx) => {
        if (transactionIds.includes(row[0])) {
          transactionsToMove.push(rowToTransaction(row, status));
          idsToDelete.push({
            sheetName,
            rowIndex: idx + 2, // +2 for header and 1-based index
            sheetId: sheet.properties!.sheetId!,
          });
        }
      });
    } catch {
      continue;
    }
  }

  if (transactionsToMove.length === 0) return;

  // Convert to expenses and add to main spreadsheet
  const now = new Date().toISOString();
  const expenses: Expense[] = transactionsToMove.map((t) => ({
    id: t.id,
    amount: t.amount,
    date: t.date,
    category: t.category || '',
    description: t.description,
    createdAt: now,
    updatedAt: now,
  }));

  // Group by year and add to appropriate sheets
  const expensesByYear = expenses.reduce((acc, expense) => {
    const year = new Date(expense.date).getFullYear();
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(expense);
    return acc;
  }, {} as Record<number, Expense[]>);

  for (const yearStr in expensesByYear) {
    const year = parseInt(yearStr);
    const sheetName = getExpensesSheetName(year);

    await ensureYearExpensesSheet(sheets, mainSpreadsheetId, year);

    const values = expensesByYear[year].map((expense) => [
      expense.id,
      expense.amount,
      expense.date,
      expense.category,
      expense.description,
      expense.createdAt,
      expense.updatedAt,
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: mainSpreadsheetId,
      range: `'${sheetName}'!A2:G`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values,
      },
    });
  }

  // Delete from import spreadsheet (in reverse order to maintain row indices)
  idsToDelete.sort((a, b) => b.rowIndex - a.rowIndex);

  for (const { sheetId, rowIndex } of idsToDelete) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: importSpreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1, // Convert back to 0-based
                endIndex: rowIndex,
              },
            },
          },
        ],
      },
    });
  }
}

// ============================================
// Rules Operations (stored in Settings sheet of main spreadsheet)
// ============================================

export async function getRules(
  accessToken: string,
  _spreadsheetId?: string // Ignored, uses main spreadsheet
): Promise<TransactionRule[]> {
  const mainSpreadsheetId = await getOrCreateSpreadsheet(accessToken);
  const sheets = createSheetsClient(accessToken);

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: mainSpreadsheetId,
      range: `${SETTINGS_SHEET}!A2:B`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    const rulesRow = rows.find((row) => row[0] === 'rules');
    if (!rulesRow || !rulesRow[1]) {
      return [];
    }

    try {
      return JSON.parse(rulesRow[1]) as TransactionRule[];
    } catch {
      return [];
    }
  } catch (error) {
    console.error('Error reading rules:', error);
    return [];
  }
}

export async function saveRules(
  accessToken: string,
  _spreadsheetId: string, // Ignored
  rules: TransactionRule[]
): Promise<void> {
  const mainSpreadsheetId = await getOrCreateSpreadsheet(accessToken);
  const sheets = createSheetsClient(accessToken);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: mainSpreadsheetId,
    range: `${SETTINGS_SHEET}!A2:B`,
  });

  const rows = response.data.values || [];
  const rulesRowIndex = rows.findIndex((row) => row[0] === 'rules');

  if (rulesRowIndex !== -1) {
    const sheetRow = rulesRowIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: mainSpreadsheetId,
      range: `${SETTINGS_SHEET}!A${sheetRow}:B${sheetRow}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['rules', JSON.stringify(rules)]],
      },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: mainSpreadsheetId,
      range: `${SETTINGS_SHEET}!A2:B`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['rules', JSON.stringify(rules)]],
      },
    });
  }
}

// Legacy compatibility - keep old function signatures working
export async function getExpense(
  accessToken: string,
  spreadsheetId: string,
  expenseId: string
): Promise<Expense | null> {
  const expenses = await getAllExpenses(accessToken, spreadsheetId);
  return expenses.find((e) => e.id === expenseId) || null;
}
