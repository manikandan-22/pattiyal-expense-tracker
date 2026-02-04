import { google, sheets_v4 } from 'googleapis';
import { Expense, Category, UserSettings, DEFAULT_CATEGORIES, DEFAULT_SETTINGS, PendingTransaction, TransactionRule } from '@/types';

const EXPENSES_SHEET = 'Expenses';
const CATEGORIES_SHEET = 'Categories';
const SETTINGS_SHEET = 'Settings';
const PENDING_TRANSACTIONS_SHEET = 'PendingTransactions';

// Spreadsheet name patterns
const getYearlySpreadsheetName = (year?: number) =>
  `Expense Tracker ${year || new Date().getFullYear()}`;
const LEGACY_SPREADSHEET_NAME = 'Expense Tracker Data';

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

export async function getOrCreateSpreadsheet(
  accessToken: string,
  year?: number
): Promise<string> {
  const drive = createDriveClient(accessToken);
  const sheets = createSheetsClient(accessToken);
  const yearlyName = getYearlySpreadsheetName(year);

  // Search for year-specific spreadsheet first (e.g., "Expense Tracker 2026")
  let searchResponse = await drive.files.list({
    q: `name='${yearlyName}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  let files = searchResponse.data.files;
  if (files && files.length > 0 && files[0].id) {
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
    return files[0].id;
  }

  // Create new spreadsheet only if neither exists
  const createResponse = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: yearlyName,
      },
      sheets: [
        {
          properties: {
            title: EXPENSES_SHEET,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
        {
          properties: {
            title: CATEGORIES_SHEET,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
        {
          properties: {
            title: SETTINGS_SHEET,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
        {
          properties: {
            title: PENDING_TRANSACTIONS_SHEET,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    },
  });

  const spreadsheetId = createResponse.data.spreadsheetId!;

  // Add headers to Expenses sheet
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${EXPENSES_SHEET}!A1:G1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [['id', 'amount', 'date', 'category', 'description', 'createdAt', 'updatedAt']],
    },
  });

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

  // Add headers and defaults to Settings sheet
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
        ['rules', '[]'], // Empty rules array
      ],
    },
  });

  // Add headers to PendingTransactions sheet
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${PENDING_TRANSACTIONS_SHEET}!A1:G1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [['id', 'date', 'description', 'amount', 'category', 'status', 'matchedRuleId', 'createdAt']],
    },
  });

  return spreadsheetId;
}


async function getOrCreateSpreadsheetForExpense(
  accessToken: string,
  expense: Expense
): Promise<string> {
  const year = new Date(expense.date).getFullYear();
  return getOrCreateSpreadsheet(accessToken, year);
}

// Expense Operations


export async function getExpenses(
  accessToken: string,
  spreadsheetId: string
): Promise<Expense[]> {
  const sheets = createSheetsClient(accessToken);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${EXPENSES_SHEET}!A2:G`,
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
}


export async function getExpense(
  accessToken: string,
  spreadsheetId: string,
  expenseId: string
): Promise<Expense | null> {
  const sheets = createSheetsClient(accessToken);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${EXPENSES_SHEET}!A2:G`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    return null;
  }

  const row = rows.find((r) => r[0] === expenseId);
  if (!row) {
    return null;
  }

  return {
    id: row[0] || '',
    amount: parseFloat(row[1]) || 0,
    date: row[2] || '',
    category: row[3] || '',
    description: row[4] || '',
    createdAt: row[5] || '',
    updatedAt: row[6] || '',
  };
}

export async function addExpense(
  accessToken: string,
  expense: Expense
): Promise<void> {
  const spreadsheetId = await getOrCreateSpreadsheetForExpense(accessToken, expense);
  const sheets = createSheetsClient(accessToken);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${EXPENSES_SHEET}!A2:G`,
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
  const spreadsheetId = await getOrCreateSpreadsheetForExpense(accessToken, expense);
  const sheets = createSheetsClient(accessToken);

  // First, find the row with the expense ID
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${EXPENSES_SHEET}!A:A`,
  });

  const rows = response.data.values;
  if (!rows) return;

  const rowIndex = rows.findIndex((row) => row[0] === expense.id);
  if (rowIndex === -1) return;

  // Row index is 0-based, but sheet rows are 1-based (and row 1 is header)
  const sheetRow = rowIndex + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${EXPENSES_SHEET}!A${sheetRow}:G${sheetRow}`,
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
  expenseId: string
): Promise<void> {
  const sheets = createSheetsClient(accessToken);

  // Get sheet ID for Expenses sheet
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
  });

  const expensesSheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === EXPENSES_SHEET
  );
  if (!expensesSheet?.properties?.sheetId) return;

  // Find the row with the expense ID
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${EXPENSES_SHEET}!A:A`,
  });

  const rows = response.data.values;
  if (!rows) return;

  const rowIndex = rows.findIndex((row) => row[0] === expenseId);
  if (rowIndex === -1) return;

  // Delete the row
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: expensesSheet.properties.sheetId,
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

// Category Operations

export async function getCategories(
  accessToken: string,
  spreadsheetId: string
): Promise<Category[]> {
  const sheets = createSheetsClient(accessToken);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${CATEGORIES_SHEET}!A2:D`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    return DEFAULT_CATEGORIES;
  }

  return rows.map((row) => ({
    id: row[0] || '',
    name: row[1] || '',
    color: row[2] || '#D4D4D4',
    icon: row[3] || undefined,
  }));
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
}

export async function updateCategory(
  accessToken: string,
  spreadsheetId: string,
  category: Category
): Promise<void> {
  const sheets = createSheetsClient(accessToken);

  // Find the row with the category ID
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
}

export async function deleteCategory(
  accessToken: string,
  spreadsheetId: string,
  categoryId: string
): Promise<void> {
  const sheets = createSheetsClient(accessToken);

  // Get sheet ID for Categories sheet
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
  });

  const categoriesSheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === CATEGORIES_SHEET
  );
  if (!categoriesSheet?.properties?.sheetId) return;

  // Find the row with the category ID
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${CATEGORIES_SHEET}!A:A`,
  });

  const rows = response.data.values;
  if (!rows) return;

  const rowIndex = rows.findIndex((row) => row[0] === categoryId);
  if (rowIndex === -1) return;

  // Delete the row
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
}

// Batch operations for OCR import
export async function addExpensesBatch(
  accessToken: string,
  expenses: Expense[]
): Promise<void> {
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

  for (const year in expensesByYear) {
    const spreadsheetId = await getOrCreateSpreadsheet(accessToken, parseInt(year));
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
      range: `${EXPENSES_SHEET}!A2:G`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values,
      },
    });
  }
}

// Settings Operations

export async function getSettings(
  accessToken: string,
  spreadsheetId: string
): Promise<UserSettings> {
  const sheets = createSheetsClient(accessToken);

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SETTINGS_SHEET}!A2:B`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
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

    return settings;
  } catch (error) {
    // Settings sheet might not exist in older spreadsheets
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
    // Check if Settings sheet exists
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const settingsSheetExists = spreadsheet.data.sheets?.some(
      (s) => s.properties?.title === SETTINGS_SHEET
    );

    if (!settingsSheetExists) {
      // Create Settings sheet if it doesn't exist
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: SETTINGS_SHEET,
                  gridProperties: {
                    frozenRowCount: 1,
                  },
                },
              },
            },
          ],
        },
      });

      // Add headers
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SETTINGS_SHEET}!A1:B1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['key', 'value']],
        },
      });
    }

    // Clear existing settings (except header) and write new ones
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
}

// ============================================
// Pending Transactions Operations
// ============================================

async function ensurePendingTransactionsSheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<void> {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetExists = spreadsheet.data.sheets?.some(
    (s) => s.properties?.title === PENDING_TRANSACTIONS_SHEET
  );

  if (!sheetExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: PENDING_TRANSACTIONS_SHEET,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          },
        ],
      },
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${PENDING_TRANSACTIONS_SHEET}!A1:H1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['id', 'date', 'description', 'amount', 'category', 'status', 'matchedRuleId', 'createdAt']],
      },
    });
  }
}

export async function getPendingTransactions(
  accessToken: string,
  spreadsheetId: string
): Promise<PendingTransaction[]> {
  const sheets = createSheetsClient(accessToken);
  await ensurePendingTransactionsSheet(sheets, spreadsheetId);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${PENDING_TRANSACTIONS_SHEET}!A2:H`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    return [];
  }

  return rows.map((row) => ({
    id: row[0] || '',
    date: row[1] || '',
    description: row[2] || '',
    amount: parseFloat(row[3]) || 0,
    category: row[4] || undefined,
    status: (row[5] as PendingTransaction['status']) || 'uncategorized',
    matchedRuleId: row[6] || undefined,
    createdAt: row[7] || '',
  }));
}

export async function addPendingTransactions(
  accessToken: string,
  spreadsheetId: string,
  transactions: PendingTransaction[]
): Promise<void> {
  const sheets = createSheetsClient(accessToken);
  await ensurePendingTransactionsSheet(sheets, spreadsheetId);

  const values = transactions.map((t) => [
    t.id,
    t.date,
    t.description,
    t.amount,
    t.category || '',
    t.status,
    t.matchedRuleId || '',
    t.createdAt,
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${PENDING_TRANSACTIONS_SHEET}!A2:H`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
}

export async function updatePendingTransaction(
  accessToken: string,
  spreadsheetId: string,
  transaction: PendingTransaction
): Promise<void> {
  const sheets = createSheetsClient(accessToken);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${PENDING_TRANSACTIONS_SHEET}!A:A`,
  });

  const rows = response.data.values;
  if (!rows) return;

  const rowIndex = rows.findIndex((row) => row[0] === transaction.id);
  if (rowIndex === -1) return;

  const sheetRow = rowIndex + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${PENDING_TRANSACTIONS_SHEET}!A${sheetRow}:H${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        transaction.id,
        transaction.date,
        transaction.description,
        transaction.amount,
        transaction.category || '',
        transaction.status,
        transaction.matchedRuleId || '',
        transaction.createdAt,
      ]],
    },
  });
}

export async function deletePendingTransaction(
  accessToken: string,
  spreadsheetId: string,
  transactionId: string
): Promise<void> {
  const sheets = createSheetsClient(accessToken);

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const pendingSheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === PENDING_TRANSACTIONS_SHEET
  );
  if (!pendingSheet?.properties?.sheetId) return;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${PENDING_TRANSACTIONS_SHEET}!A:A`,
  });

  const rows = response.data.values;
  if (!rows) return;

  const rowIndex = rows.findIndex((row) => row[0] === transactionId);
  if (rowIndex === -1) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: pendingSheet.properties.sheetId,
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

export async function updateAllPendingTransactions(
  accessToken: string,
  spreadsheetId: string,
  transactions: PendingTransaction[]
): Promise<void> {
  const sheets = createSheetsClient(accessToken);
  await ensurePendingTransactionsSheet(sheets, spreadsheetId);

  // Clear existing data (keep header)
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const pendingSheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === PENDING_TRANSACTIONS_SHEET
  );

  if (pendingSheet?.properties?.sheetId) {
    // Get current row count
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${PENDING_TRANSACTIONS_SHEET}!A:A`,
    });

    const currentRows = response.data.values?.length || 1;

    if (currentRows > 1) {
      // Delete all rows except header
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: pendingSheet.properties.sheetId,
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

  // Add all transactions
  if (transactions.length > 0) {
    const values = transactions.map((t) => [
      t.id,
      t.date,
      t.description,
      t.amount,
      t.category || '',
      t.status,
      t.matchedRuleId || '',
      t.createdAt,
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${PENDING_TRANSACTIONS_SHEET}!A2:H`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });
  }
}

// ============================================
// Rules Operations (stored in Settings sheet)
// ============================================

export async function getRules(
  accessToken: string,
  spreadsheetId: string
): Promise<TransactionRule[]> {
  const sheets = createSheetsClient(accessToken);

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
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
  spreadsheetId: string,
  rules: TransactionRule[]
): Promise<void> {
  const sheets = createSheetsClient(accessToken);

  // Get current settings rows
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SETTINGS_SHEET}!A2:B`,
  });

  const rows = response.data.values || [];
  const rulesRowIndex = rows.findIndex((row) => row[0] === 'rules');

  if (rulesRowIndex !== -1) {
    // Update existing rules row
    const sheetRow = rulesRowIndex + 2; // +2 for header and 0-index
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SETTINGS_SHEET}!A${sheetRow}:B${sheetRow}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['rules', JSON.stringify(rules)]],
      },
    });
  } else {
    // Append new rules row
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SETTINGS_SHEET}!A2:B`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['rules', JSON.stringify(rules)]],
      },
    });
  }
}
