export interface Expense {
  id: string;
  amount: number;
  date: string; // ISO date (YYYY-MM-DD)
  category: string; // Category ID
  description: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface Category {
  id: string;
  name: string;
  color: string; // Hex color for UI
  icon?: string; // Optional emoji
}

export interface MonthlyData {
  month: string; // Format: YYYY-MM
  total: number;
  expenses: Expense[];
  categoryBreakdown: CategoryBreakdown[];
}

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  color: string;
  total: number;
  percentage: number;
  count: number;
}

export interface ParsedVoiceExpense {
  amount: number | null;
  category: string | null;
  description: string;
  date: string; // ISO date
  confidence: number; // 0-1 score
}

export interface CsvTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  selected: boolean; // For batch import selection
  category?: string; // Auto-suggested category
}

// Category mapping rules for auto-categorization
export type RuleMatchType = 'contains' | 'startsWith' | 'endsWith' | 'equals';
export type AmountMatchType = 'equals' | 'greaterThan' | 'lessThan' | 'between';
export type RuleField = 'description' | 'amount';
export type RuleLogicMode = 'all' | 'any'; // all = AND, any = OR

export interface RuleCondition {
  id: string;
  field: RuleField;
  matchType: RuleMatchType | AmountMatchType;
  value: string;        // For description or single amount value
  value2?: string;      // For "between" amount condition
}

export interface TransactionRule {
  id: string;
  name: string;                    // Rule name for easy identification
  conditions: RuleCondition[];     // Multiple conditions
  logicMode: RuleLogicMode;        // 'all' = AND, 'any' = OR
  categoryId: string;
  enabled: boolean;
  createdAt: string;
}

// Legacy rule format for migration (single pattern)
export interface LegacyTransactionRule {
  id: string;
  pattern: string;
  matchType: RuleMatchType;
  categoryId: string;
  enabled: boolean;
  createdAt: string;
}

// Pending transactions (imported but not yet confirmed)
export type PendingTransactionStatus = 'auto-mapped' | 'uncategorized' | 'ignored';

export type CategorySource = 'rule' | 'ai' | 'manual';

export interface PendingTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category?: string;           // Auto-mapped category if rule matched
  status: PendingTransactionStatus;
  matchedRuleId?: string;      // Which rule matched (for auto-mapped)
  source?: string;             // e.g. "December 2026 HDFC Credit Card Statement"
  categorySource?: CategorySource; // How category was determined
  createdAt: string;
}

export interface SheetsConfig {
  spreadsheetId: string;
  expensesSheetName: string;
  categoriesSheetName: string;
}

export type ExpenseAction =
  | { type: 'SET_EXPENSES'; payload: Expense[] }
  | { type: 'ADD_EXPENSE'; payload: Expense }
  | { type: 'UPDATE_EXPENSE'; payload: Expense }
  | { type: 'DELETE_EXPENSE'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

export type CategoryAction =
  | { type: 'SET_CATEGORIES'; payload: Category[] }
  | { type: 'ADD_CATEGORY'; payload: Category }
  | { type: 'UPDATE_CATEGORY'; payload: Category }
  | { type: 'DELETE_CATEGORY'; payload: string };

export interface ExpenseState {
  expenses: Expense[];
  loading: boolean;
  error: string | null;
}

export interface CategoryState {
  categories: Category[];
}

export interface ExpenseContextType {
  state: ExpenseState;
  dispatch: React.Dispatch<ExpenseAction>;
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  refreshExpenses: () => Promise<void>;
}

export interface CategoryContextType {
  categories: Category[];
  addCategory: (category: Omit<Category, 'id'>) => Promise<Category | undefined>;
  updateCategory: (category: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  refreshCategories: () => Promise<void>;
}

// Default categories for first-time setup
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'groceries', name: 'Groceries', color: '#86EFAC', icon: '🛒' },
  { id: 'transport', name: 'Transport', color: '#93C5FD', icon: '🚗' },
  { id: 'dining', name: 'Dining Out', color: '#FED7AA', icon: '🍽️' },
  { id: 'utilities', name: 'Utilities', color: '#C4B5FD', icon: '💡' },
  { id: 'entertainment', name: 'Entertainment', color: '#FBCFE8', icon: '🎬' },
  { id: 'shopping', name: 'Shopping', color: '#FEF08A', icon: '🛍️' },
  { id: 'health', name: 'Health', color: '#99F6E4', icon: '💊' },
  { id: 'other', name: 'Other', color: '#D4D4D4', icon: '📝' },
];

// Category color map for quick lookup
export const CATEGORY_COLORS: Record<string, string> = {
  groceries: '#86EFAC',
  transport: '#93C5FD',
  dining: '#FED7AA',
  utilities: '#C4B5FD',
  entertainment: '#FBCFE8',
  shopping: '#FEF08A',
  health: '#99F6E4',
  other: '#D4D4D4',
};

// User Settings
export interface UserSettings {
  currency: CurrencyCode;
  onboardingCompleted: boolean;
}

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'INR' | 'JPY' | 'CAD' | 'AUD' | 'CHF' | 'CNY' | 'SGD';

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  name: string;
  locale: string;
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', locale: 'de-CH' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG' },
];

export const DEFAULT_SETTINGS: UserSettings = {
  currency: 'USD',
  onboardingCompleted: false,
};

export interface SettingsContextType {
  settings: UserSettings;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  isLoading: boolean;
}

// Pending Transactions Context
export interface PendingTransactionsContextType {
  pendingTransactions: PendingTransaction[];
  rules: TransactionRule[];
  isLoading: boolean;
  addPendingTransactions: (transactions: Omit<PendingTransaction, 'id' | 'createdAt'>[]) => Promise<void>;
  confirmTransaction: (id: string) => Promise<void>;
  confirmAllAutoMapped: () => Promise<void>;
  saveMappedUncategorized: () => Promise<number>;  // Save manually categorized uncategorized transactions
  updateTransactionCategory: (id: string, categoryId: string) => Promise<void>;
  ignoreTransaction: (id: string) => Promise<void>;
  unignoreTransaction: (id: string) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  aiCategorize: (suggestions: { transactionId: string; categoryId: string }[]) => Promise<void>;
  addRule: (rule: Omit<TransactionRule, 'id' | 'createdAt'>) => Promise<TransactionRule | undefined>;
  updateRule: (rule: TransactionRule) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  refreshPendingTransactions: () => Promise<void>;
}

// === AI Chat Types ===

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: ChatAttachment[];
  toolResults?: ToolResultDisplay[];
  model?: string;
  isError?: boolean;
}

export interface ChatAttachment {
  type: 'pdf' | 'image';
  name: string;
  base64: string;
  mimeType: string;
}

export interface ToolResultDisplay {
  tool: string;
  summary: string;
  success: boolean;
}
