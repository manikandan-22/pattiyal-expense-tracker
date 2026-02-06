import {
  TransactionRule,
  PendingTransaction,
  RuleMatchType,
  AmountMatchType,
  RuleCondition,
  RuleField,
  LegacyTransactionRule,
} from '@/types';

/**
 * Check if a description matches a text condition
 */
function matchTextCondition(description: string, matchType: RuleMatchType, pattern: string): boolean {
  const desc = description.toLowerCase();
  const pat = pattern.toLowerCase();

  switch (matchType) {
    case 'contains':
      return desc.includes(pat);
    case 'startsWith':
      return desc.startsWith(pat);
    case 'endsWith':
      return desc.endsWith(pat);
    case 'equals':
      return desc === pat;
    default:
      return false;
  }
}

/**
 * Check if an amount matches an amount condition
 */
function matchAmountCondition(
  amount: number,
  matchType: AmountMatchType,
  value: string,
  value2?: string
): boolean {
  const targetValue = parseFloat(value);
  if (isNaN(targetValue)) return false;

  switch (matchType) {
    case 'equals':
      return Math.abs(amount - targetValue) < 0.01; // Float comparison tolerance
    case 'greaterThan':
      return amount > targetValue;
    case 'lessThan':
      return amount < targetValue;
    case 'between':
      const targetValue2 = value2 ? parseFloat(value2) : NaN;
      if (isNaN(targetValue2)) return false;
      const min = Math.min(targetValue, targetValue2);
      const max = Math.max(targetValue, targetValue2);
      return amount >= min && amount <= max;
    default:
      return false;
  }
}

/**
 * Check if a single condition matches a transaction
 */
function matchCondition(
  transaction: PendingTransaction,
  condition: RuleCondition
): boolean {
  if (condition.field === 'description') {
    return matchTextCondition(
      transaction.description,
      condition.matchType as RuleMatchType,
      condition.value
    );
  } else if (condition.field === 'amount') {
    return matchAmountCondition(
      transaction.amount,
      condition.matchType as AmountMatchType,
      condition.value,
      condition.value2
    );
  }
  return false;
}

/**
 * Check if a transaction matches a rule (with multiple conditions)
 */
export function matchRule(transaction: PendingTransaction, rule: TransactionRule): boolean {
  if (!rule.enabled || rule.conditions.length === 0) return false;

  if (rule.logicMode === 'all') {
    // AND logic: all conditions must match
    return rule.conditions.every(condition => matchCondition(transaction, condition));
  } else {
    // OR logic: at least one condition must match
    return rule.conditions.some(condition => matchCondition(transaction, condition));
  }
}

/**
 * Find the first matching rule for a transaction
 */
export function findMatchingRule(
  transaction: PendingTransaction,
  rules: TransactionRule[]
): TransactionRule | undefined {
  return rules.find(rule => matchRule(transaction, rule));
}

/**
 * Apply rules to a list of transactions
 * Returns transactions with updated status and category based on rule matches
 */
export function applyRulesToTransactions(
  transactions: PendingTransaction[],
  rules: TransactionRule[]
): PendingTransaction[] {
  const enabledRules = rules.filter(r => r.enabled);

  return transactions.map(transaction => {
    // Skip already ignored transactions
    if (transaction.status === 'ignored') {
      return transaction;
    }

    const matchedRule = findMatchingRule(transaction, enabledRules);

    if (matchedRule) {
      return {
        ...transaction,
        status: 'auto-mapped' as const,
        category: matchedRule.categoryId,
        matchedRuleId: matchedRule.id,
        categorySource: 'rule' as const,
      };
    }

    // Keep manually set categories but don't change status to auto-mapped
    // Only clear category if it was set by a rule that no longer matches
    if (transaction.matchedRuleId && !transaction.category) {
      return {
        ...transaction,
        status: 'uncategorized' as const,
        category: undefined,
        matchedRuleId: undefined,
        categorySource: undefined,
      };
    }

    // For transactions without a matched rule, preserve manual category selection
    return {
      ...transaction,
      status: transaction.matchedRuleId ? 'uncategorized' : transaction.status,
      matchedRuleId: undefined,
      categorySource: transaction.matchedRuleId ? undefined : transaction.categorySource,
    };
  });
}

/**
 * Apply a single new rule to uncategorized transactions
 * Used when user creates a new rule to immediately categorize matching transactions
 */
export function applyNewRuleToTransactions(
  transactions: PendingTransaction[],
  newRule: TransactionRule
): PendingTransaction[] {
  if (!newRule.enabled) return transactions;

  return transactions.map(transaction => {
    // Only process uncategorized transactions
    if (transaction.status !== 'uncategorized') {
      return transaction;
    }

    if (matchRule(transaction, newRule)) {
      return {
        ...transaction,
        status: 'auto-mapped' as const,
        category: newRule.categoryId,
        matchedRuleId: newRule.id,
        categorySource: 'rule' as const,
      };
    }

    return transaction;
  });
}

/**
 * All available text match types for UI selection
 */
export const TEXT_MATCH_TYPES: { value: RuleMatchType; label: string }[] = [
  { value: 'contains', label: 'Contains' },
  { value: 'startsWith', label: 'Starts with' },
  { value: 'endsWith', label: 'Ends with' },
  { value: 'equals', label: 'Equals exactly' },
];

/**
 * All available amount match types for UI selection
 */
export const AMOUNT_MATCH_TYPES: { value: AmountMatchType; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'greaterThan', label: 'Greater than' },
  { value: 'lessThan', label: 'Less than' },
  { value: 'between', label: 'Between' },
];

/**
 * All available fields for conditions
 */
export const RULE_FIELDS: { value: RuleField; label: string }[] = [
  { value: 'description', label: 'Description' },
  { value: 'amount', label: 'Amount' },
];

/**
 * Logic mode options
 */
export const LOGIC_MODES: { value: 'all' | 'any'; label: string; description: string }[] = [
  { value: 'all', label: 'All conditions', description: 'Transaction must match all conditions' },
  { value: 'any', label: 'Any condition', description: 'Transaction must match at least one condition' },
];

/**
 * Legacy match types (for backwards compatibility)
 */
export const MATCH_TYPES = TEXT_MATCH_TYPES;

/**
 * Get match type display label
 */
export function getMatchTypeLabel(matchType: RuleMatchType | AmountMatchType): string {
  const textMatch = TEXT_MATCH_TYPES.find(m => m.value === matchType);
  if (textMatch) return textMatch.label;

  const amountMatch = AMOUNT_MATCH_TYPES.find(m => m.value === matchType);
  if (amountMatch) return amountMatch.label;

  return matchType;
}

/**
 * Migrate legacy rule format to new format
 */
export function migrateLegacyRule(legacy: LegacyTransactionRule): TransactionRule {
  return {
    id: legacy.id,
    name: `Rule: ${legacy.pattern}`,
    conditions: [
      {
        id: `${legacy.id}-cond-1`,
        field: 'description',
        matchType: legacy.matchType,
        value: legacy.pattern,
      },
    ],
    logicMode: 'all',
    categoryId: legacy.categoryId,
    enabled: legacy.enabled,
    createdAt: legacy.createdAt,
  };
}

/**
 * Check if a rule is in legacy format and migrate if needed
 */
export function ensureModernRuleFormat(rule: TransactionRule | LegacyTransactionRule): TransactionRule {
  // Check if it's a legacy rule (has 'pattern' field instead of 'conditions')
  if ('pattern' in rule && !('conditions' in rule)) {
    return migrateLegacyRule(rule as LegacyTransactionRule);
  }
  return rule as TransactionRule;
}
