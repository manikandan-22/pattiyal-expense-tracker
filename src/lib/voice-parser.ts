import { ParsedVoiceExpense, Category } from '@/types';
import { getToday } from './utils';

// Number words mapping
const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1000,
};

// Date patterns
const DATE_PATTERNS: Record<string, (now: Date) => Date> = {
  today: (now) => now,
  yesterday: (now) => {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d;
  },
  'last week': (now) => {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  },
};

// Category keyword mappings
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  groceries: ['grocery', 'groceries', 'supermarket', 'food shopping', 'produce', 'vegetables', 'fruits'],
  transport: ['transport', 'uber', 'lyft', 'taxi', 'cab', 'gas', 'fuel', 'parking', 'bus', 'train', 'metro', 'subway'],
  dining: ['dining', 'restaurant', 'lunch', 'dinner', 'breakfast', 'coffee', 'cafe', 'food', 'eat', 'eating'],
  utilities: ['utilities', 'electric', 'electricity', 'water', 'gas bill', 'internet', 'phone', 'mobile'],
  entertainment: ['entertainment', 'movie', 'movies', 'netflix', 'spotify', 'concert', 'game', 'gaming'],
  shopping: ['shopping', 'clothes', 'clothing', 'amazon', 'online', 'store'],
  health: ['health', 'doctor', 'medicine', 'pharmacy', 'hospital', 'medical', 'gym', 'fitness'],
  other: ['other', 'misc', 'miscellaneous'],
};

export function parseVoiceInput(
  transcript: string,
  categories: Category[]
): ParsedVoiceExpense {
  const lowerTranscript = transcript.toLowerCase().trim();
  let confidence = 0;

  // Parse amount
  const amount = parseAmount(lowerTranscript);
  if (amount !== null) confidence += 0.4;

  // Parse category
  const category = parseCategory(lowerTranscript, categories);
  if (category) confidence += 0.3;

  // Parse date
  const date = parseDate(lowerTranscript);
  if (date !== getToday()) confidence += 0.1;

  // Extract description
  const description = extractDescription(lowerTranscript, amount, category);
  if (description) confidence += 0.2;

  return {
    amount,
    category,
    description,
    date,
    confidence: Math.min(confidence, 1),
  };
}

function parseAmount(transcript: string): number | null {
  // Try to find dollar amounts like "$50", "50 dollars", "fifty dollars"

  // Pattern: $X or X dollars
  const dollarPattern = /\$\s*(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:dollars?|bucks?)/i;
  const dollarMatch = transcript.match(dollarPattern);
  if (dollarMatch) {
    const value = dollarMatch[1] || dollarMatch[2];
    return parseFloat(value);
  }

  // Pattern: number words like "fifty dollars"
  const words = transcript.split(/\s+/);
  let amount = 0;
  let foundNumber = false;

  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^a-z]/g, '');

    if (NUMBER_WORDS[word] !== undefined) {
      foundNumber = true;
      const value = NUMBER_WORDS[word];

      if (value === 100 || value === 1000) {
        amount = (amount || 1) * value;
      } else if (value >= 20 && value < 100) {
        // Handle compound numbers like "twenty five"
        const nextWord = words[i + 1]?.replace(/[^a-z]/g, '');
        if (nextWord && NUMBER_WORDS[nextWord] !== undefined && NUMBER_WORDS[nextWord] < 10) {
          amount += value + NUMBER_WORDS[nextWord];
          i++;
        } else {
          amount += value;
        }
      } else {
        amount += value;
      }
    }
  }

  if (foundNumber && amount > 0) {
    return amount;
  }

  // Try plain number patterns
  const plainNumber = transcript.match(/(\d+(?:\.\d{1,2})?)/);
  if (plainNumber) {
    return parseFloat(plainNumber[1]);
  }

  return null;
}

function parseCategory(transcript: string, categories: Category[]): string | null {
  // First try exact category name matches
  for (const category of categories) {
    if (transcript.includes(category.name.toLowerCase())) {
      return category.id;
    }
  }

  // Then try keyword matches
  for (const [categoryId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (transcript.includes(keyword)) {
        // Verify this category exists
        const exists = categories.some((c) => c.id === categoryId);
        if (exists) {
          return categoryId;
        }
      }
    }
  }

  return null;
}

function parseDate(transcript: string): string {
  const now = new Date();

  // Check for date patterns
  for (const [pattern, getDate] of Object.entries(DATE_PATTERNS)) {
    if (transcript.includes(pattern)) {
      const date = getDate(now);
      return date.toISOString().split('T')[0];
    }
  }

  // Check for day names
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < days.length; i++) {
    if (transcript.includes(days[i])) {
      const currentDay = now.getDay();
      let daysAgo = currentDay - i;
      if (daysAgo <= 0) daysAgo += 7;

      // Check for "last" modifier
      if (transcript.includes('last') && daysAgo < 7) {
        daysAgo += 7;
      }

      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      return date.toISOString().split('T')[0];
    }
  }

  // Default to today
  return getToday();
}

function extractDescription(
  transcript: string,
  amount: number | null,
  categoryId: string | null
): string {
  let description = transcript;

  // Remove common filler phrases
  const fillers = [
    'i spent',
    'spent',
    'paid',
    'bought',
    'for',
    'on',
    'at',
    'dollars',
    'dollar',
    'bucks',
    'today',
    'yesterday',
  ];

  for (const filler of fillers) {
    description = description.replace(new RegExp(`\\b${filler}\\b`, 'gi'), ' ');
  }

  // Remove the amount
  if (amount !== null) {
    description = description.replace(new RegExp(`\\$?${amount}`, 'g'), ' ');
  }

  // Remove category keywords
  if (categoryId) {
    const keywords = CATEGORY_KEYWORDS[categoryId] || [];
    for (const keyword of keywords) {
      description = description.replace(new RegExp(`\\b${keyword}\\b`, 'gi'), ' ');
    }
  }

  // Clean up
  description = description
    .replace(/\s+/g, ' ')
    .trim();

  // Capitalize first letter
  if (description) {
    description = description.charAt(0).toUpperCase() + description.slice(1);
  }

  return description;
}
