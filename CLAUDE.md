# Expense Tracker (Pattiyal)

## Overview
A personal expense tracking app built with Next.js 14, using Google Sheets as the backend storage. Features CSV import, voice input, AI chat copilot, transaction rules engine, and multi-year expense management.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **UI Components**: Radix UI primitives, Framer Motion animations, Lucide icons
- **Auth**: NextAuth.js with Google OAuth (JWT strategy)
- **Backend Storage**: Google Sheets API (yearly spreadsheets)
- **AI**: Ollama (primary) with Gemini fallback for chat copilot and tool calling
- **PDF OCR**: PaddleOCR on Modal.com (currently disabled)

## Project Structure
```
src/
├── app/                          # Next.js App Router pages
│   ├── api/
│   │   ├── auth/[...nextauth]/  # NextAuth OAuth endpoints
│   │   ├── chat/                # AI chat endpoint with tool calling
│   │   ├── drive/               # Google Sheets CRUD operations
│   │   ├── pdf/                 # PDF extraction proxy (disabled)
│   │   └── settings/            # User settings management
│   ├── page.tsx                 # Home - AI chat copilot
│   ├── add/                     # Add expense page
│   ├── expenses/                # Expense list with filters
│   ├── import/                  # CSV import wizard
│   ├── categories/              # Category management
│   ├── monthly/                 # Monthly reports
│   │   └── [month]/             # Specific month details
│   ├── onboarding/              # First-time currency selection
│   ├── settings/                # App settings
│   │   └── rules/               # Transaction categorization rules
│   └── auth/signin/             # Google OAuth sign-in
├── components/
│   ├── ui/                      # Radix UI primitives (Button, Input, Dialog, etc.)
│   ├── BottomNav.tsx            # Mobile navigation
│   ├── CategoryManager.tsx      # Category CRUD interface
│   ├── CategoryPills.tsx        # Category filter chips
│   ├── CategorySummary.tsx      # Category breakdown display
│   ├── CsvImport.tsx            # 3-step import wizard
│   ├── ExpenseAddDialog.tsx     # Add expense modal
│   ├── ExpenseCard.tsx          # Individual expense card with swipe
│   ├── ExpenseEditDialog.tsx    # Edit expense modal
│   ├── ExpenseList.tsx          # Grouped expense display
│   ├── FloatingAddButton.tsx    # Floating action button
│   ├── Header.tsx               # Top nav with search
│   ├── ImportWizard.tsx         # Advanced import wizard
│   ├── InlineEdit.tsx           # Inline editing component
│   ├── MonthlyCard.tsx          # Monthly summary card
│   ├── SearchCommand.tsx        # Cmd+K search palette
│   ├── SessionProvider.tsx      # NextAuth session wrapper
│   ├── SkeletonList.tsx         # Loading skeleton
│   ├── TransactionsPage.tsx     # Pending transactions management
│   └── VoiceInput.tsx           # Speech-to-text entry
├── context/
│   ├── ExpenseContext.tsx       # Expenses + Categories state (useReducer)
│   ├── SettingsContext.tsx      # Currency, onboarding state
│   └── TransactionsContext.tsx  # Pending transactions + rules state
├── hooks/
│   ├── useDebounce.ts           # Debounce utility
│   ├── useSwipe.ts              # Touch swipe detection
│   ├── useToast.ts              # Toast notification hook
│   └── useVoice.ts              # Web Speech API wrapper
├── lib/
│   ├── ai-client.ts             # LLM client (Ollama primary, Gemini fallback)
│   ├── ai-tools.ts              # Tool definitions for AI copilot
│   ├── animations.ts            # Framer Motion presets
│   ├── auth.ts                  # NextAuth config
│   ├── csvParser.ts             # CSV parsing + auto-detection
│   ├── google-sheets.ts         # Google Sheets API wrapper
│   ├── id-utils.ts              # Year extraction from prefixed IDs
│   ├── ruleEngine.ts            # Rule matching for auto-categorization
│   ├── utils.ts                 # Currency, date, grouping helpers
│   └── voice-parser.ts          # Voice-to-expense parsing
└── types/
    └── index.ts                 # All TypeScript definitions

modal/
└── pdf_extract.py               # Modal.com serverless OCR (disabled)
```

## API Routes

### `/api/drive` - Main data operations
| Method | Params | Description |
|--------|--------|-------------|
| GET | `type=expenses&year=2024` | Fetch expenses for year |
| GET | `type=categories` | Fetch all categories |
| GET | `type=pending` | Fetch pending transactions |
| GET | `type=rules` | Fetch transaction rules |
| GET | `type=search&q=...` | Search expenses across years |
| POST | `type=expense` + body | Add single expense |
| POST | `type=expenses-batch` + body | Batch import expenses |
| POST | `type=category` + body | Add category |
| POST | `type=pending` + body | Add pending transactions |
| POST | `type=rule` + body | Add categorization rule |
| PUT | `type=expense` + body | Update expense |
| PUT | `type=category` + body | Update category |
| PUT | `type=pending` + body | Update pending transaction |
| PUT | `type=rule` + body | Update rule |
| DELETE | `type=expense&id=xxx&year=2024` | Delete expense |
| DELETE | `type=category&id=xxx` | Delete category |
| DELETE | `type=pending&id=xxx` | Delete pending transaction |
| DELETE | `type=rule&id=xxx` | Delete rule |

### `/api/chat` - AI chat copilot
| Method | Description |
|--------|-------------|
| POST | Send message with optional PDF/image attachments; supports tool calling |

### `/api/settings` - User preferences
| Method | Description |
|--------|-------------|
| GET | Get currency and onboarding status |
| PUT | Update settings |

## Key Types
```typescript
Expense { id, amount, date, category, description, createdAt, updatedAt }
Category { id, name, color (hex), icon (emoji, optional) }
CsvTransaction { id, date, description, amount, selected, category? }
UserSettings { currency: CurrencyCode, onboardingCompleted: boolean }
CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD' | 'CHF' | 'CNY' | 'SGD'

// Transaction Rules
TransactionRule { id, conditions: RuleCondition[], logicMode: 'all'|'any', categoryId, categoryName }
RuleCondition { field: 'description'|'amount', matchType, value }
LegacyTransactionRule { id, pattern, field, matchType, categoryId, categoryName }

// Pending Transactions
PendingTransaction { id, date, description, amount, status, category?, rule? }
PendingTransactionStatus = 'auto_mapped' | 'uncategorized' | 'ignored' | 'confirmed'

// AI Chat
ChatMessage { role, content, attachments?, toolResults? }
ChatAttachment { type: 'pdf'|'image', name, data }
```

## Google Sheets Structure
- **Naming**: "Expense Tracker 2024", "Expense Tracker 2025" (yearly)
- **Sheets per spreadsheet**: Expenses, Categories, Settings, Pending Transactions, Rules
- **Expenses columns**: id | amount | date | category | description | createdAt | updatedAt
- **Categories columns**: id | name | color | icon
- **Settings columns**: key | value (currency, onboardingCompleted)
- **Pending Transactions columns**: id | date | description | amount | status | category | rule
- **Rules columns**: id | conditions | logicMode | categoryId | categoryName

## Default Categories
Groceries, Transport, Dining, Utilities, Entertainment, Shopping, Health, Other

## Key Workflows

### AI Chat Copilot (page.tsx + ai-client.ts + ai-tools.ts)
- Natural language queries about expenses ("How much did I spend on dining this month?")
- Tool-calling: the AI can search expenses, add expenses, list categories
- Supports PDF and image attachments
- Chat history persisted in localStorage
- Uses Ollama as primary LLM, falls back to Gemini

### CSV Import (CsvImport.tsx + TransactionsPage.tsx)
1. Upload CSV file
2. Auto-detect columns (date, description, amount) or manual mapping
3. Apply transaction rules for auto-categorization
4. Review in tabs: Auto-mapped | Uncategorized | Ignored
5. Bulk confirm or manually categorize
6. Batch import via `/api/drive?type=expenses-batch`

### Transaction Rules (ruleEngine.ts + settings/rules)
- Multi-condition rules with AND/OR logic
- Match on description (contains, starts with, regex) or amount (equals, greater than, etc.)
- Auto-applied during CSV import to categorize transactions
- Managed via Settings > Categorization Rules

### Voice Input (VoiceInput.tsx + voice-parser.ts)
- Example: "spent fifty dollars on groceries yesterday"
- Parses: amount, category, date, description with confidence score

### Expense Management
- Expenses page: grouped by day, category filters, search (Cmd+K)
- Edit/delete via dialogs, swipe-to-delete on cards
- Multi-year support (automatic spreadsheet per year)

## Environment Variables
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
MODAL_ENDPOINT_URL=...          # Optional, for PDF OCR
OCR_SPACE_API_KEY=...           # Optional, for PDF OCR
OLLAMA_BASE_URL=...             # Primary LLM endpoint
OLLAMA_MODEL=...                # Ollama model name
OLLAMA_API_KEY=...              # Ollama API key
GEMINI_API_KEY=...              # Fallback LLM
GEMINI_MODEL=...                # Gemini model name
```

## Common Issues

### Blank page / unstyled nav
```bash
pkill -f "next dev"; rm -rf .next; npm run dev
```

### Hydration errors
Check for browser-only APIs (Speech, localStorage) - use useEffect guards

### Google Sheets auth errors
Verify OAuth scopes include `spreadsheets` and `drive.file`

## Commands
```bash
npm run dev          # Local development
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint check
vercel deploy        # Deploy to Vercel
```

---

## Agent Instructions

### For UI Components
- All UI primitives in `src/components/ui/` (Radix-based)
- Use existing Button, Input, Dialog, Select, Card, Toast components
- Animations: import from `lib/animations.ts` (smoothSpring, pageVariants)
- Icons: Lucide React (`lucide-react`)

### For Data Operations
- Never call Google Sheets directly - use `/api/drive` routes
- Three context providers in layout: `DataProvider`, `SettingsProvider`, `PendingTransactionsProvider`
- Contexts auto-cache to sessionStorage; call `refresh()` after mutations
- Expense dates: ISO format (YYYY-MM-DD)
- IDs: UUID v4 (generated server-side)

### For AI Features
- LLM client in `lib/ai-client.ts` - handles Ollama/Gemini with automatic fallback
- Tool definitions in `lib/ai-tools.ts` - add new tools here for chat capabilities
- Chat API route streams responses via `/api/chat`

### For Transaction Rules
- Rule engine in `lib/ruleEngine.ts` - matching logic
- Rules support legacy (single pattern) and new (multi-condition) formats
- Rules context in `TransactionsContext.tsx`

### For New Pages
- Use App Router conventions (`page.tsx`)
- All three providers already in layout (no wrapping needed)
- Add route to `BottomNav.tsx` if primary navigation

### For Testing Changes
- Check mobile view (bottom nav, touch targets)
- Verify sessionStorage cache invalidation after CRUD
- Test with empty states (no expenses, no categories)

### Code Style
- TypeScript strict mode
- Tailwind for all styling
- Framer Motion for animations
- Radix UI for accessible primitives
- Error handling: toast notifications via `useToast()`

### File Locations Quick Reference
| Need to... | Look in... |
|------------|------------|
| Add API endpoint | `src/app/api/` |
| Modify expense logic | `src/lib/google-sheets.ts` |
| Update types | `src/types/index.ts` |
| Change animations | `src/lib/animations.ts` |
| Add UI component | `src/components/ui/` |
| Modify state | `src/context/` |
| Parse CSV/voice | `src/lib/csvParser.ts`, `src/lib/voice-parser.ts` |
| Add AI tools | `src/lib/ai-tools.ts` |
| Modify rule engine | `src/lib/ruleEngine.ts` |
| Manage pending transactions | `src/context/TransactionsContext.tsx` |
