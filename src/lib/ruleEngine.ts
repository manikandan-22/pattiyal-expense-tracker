import { TransactionRule, PendingTransaction, RuleMatchType } from '@/types';

/**
 * Check if a description matches a rule pattern
 */
export function matchRule(description: string, rule: TransactionRule): boolean {
  if (!rule.enabled) return false;

  const desc = description.toLowerCase();
  const pattern = rule.pattern.toLowerCase();

  switch (rule.matchType) {
    case 'contains':
      return desc.includes(pattern);
    case 'startsWith':
      return desc.startsWith(pattern);
    case 'endsWith':
      return desc.endsWith(pattern);
    case 'equals':
      return desc === pattern;
    default:
      return false;
  }
}

/**
 * Find the first matching rule for a description
 */
export function findMatchingRule(
  description: string,
  rules: TransactionRule[]
): TransactionRule | undefined {
  return rules.find(rule => matchRule(description, rule));
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

    const matchedRule = findMatchingRule(transaction.description, enabledRules);

    if (matchedRule) {
      return {
        ...transaction,
        status: 'auto-mapped' as const,
        category: matchedRule.categoryId,
        matchedRuleId: matchedRule.id,
      };
    }

    return {
      ...transaction,
      status: 'uncategorized' as const,
      category: undefined,
      matchedRuleId: undefined,
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

    if (matchRule(transaction.description, newRule)) {
      return {
        ...transaction,
        status: 'auto-mapped' as const,
        category: newRule.categoryId,
        matchedRuleId: newRule.id,
      };
    }

    return transaction;
  });
}

/**
 * All available match types for UI selection
 */
export const MATCH_TYPES: { value: RuleMatchType; label: string }[] = [
  { value: 'contains', label: 'Contains' },
  { value: 'startsWith', label: 'Starts with' },
  { value: 'endsWith', label: 'Ends with' },
  { value: 'equals', label: 'Equals exactly' },
];

/**
 * Get match type display label
 */
export function getMatchTypeLabel(matchType: RuleMatchType): string {
  return MATCH_TYPES.find(m => m.value === matchType)?.label || matchType;
}
