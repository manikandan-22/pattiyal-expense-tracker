# Expense Tracker (Pattiyal)

Personal expense tracker — Next.js 14 App Router, Google Sheets backend, AI chat copilot.

## Tech Stack
- Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- Radix UI primitives, Framer Motion, Lucide icons, Recharts
- NextAuth.js (Google OAuth, JWT strategy)
- Google Sheets API (yearly spreadsheets: "Expense Tracker 2024", etc.)
- AI: Ollama (primary) + Gemini fallback (`gemini-2.0-flash` default)

## Commands
```bash
npm run dev       # Dev server
npm run build     # Production build
npm run lint      # ESLint
vercel deploy     # Deploy
```

## Project Structure
```
src/app/
  page.tsx                    # Expenses list (root route)
  dashboard/                  # Home dashboard with trends + recent transactions
  chat/                       # AI chat copilot
  add/                        # Add expense
  import/                     # CSV import wizard
  categories/                 # Category management
  monthly/[month]/            # Monthly reports
  onboarding/                 # First-time currency setup
  settings/                   # Settings hub
    currency/                 # Currency picker sub-page
    rules/                    # Transaction categorization rules
  auth/signin/                # Google OAuth sign-in
  api/
    auth/[...nextauth]/       # NextAuth endpoints
    chat/                     # AI chat with tool calling
    drive/                    # Google Sheets CRUD (main data API)
    pdf/                      # PDF extraction (disabled)
    settings/                 # User preferences

src/components/
  ui/                         # Radix primitives: button, input, dialog, select,
                              #   popover, toast, toaster, card, calendar,
                              #   date-picker, dropdown-menu
  BottomNav.tsx               # 5-tab nav: Home, Expenses, Chat, Reports, Settings
  ExpenseCard.tsx             # Expense card with swipe-to-delete
  ExpenseList.tsx             # Day-grouped expense display
  ExpenseForm.tsx             # Standalone add/edit form
  ExpenseAddDialog.tsx        # Add expense modal
  ExpenseEditDialog.tsx       # Edit expense modal
  CategoryManager.tsx         # Category CRUD
  CategoryPills.tsx           # Category filter chips
  CategorySummary.tsx         # Category breakdown
  ImportWizard.tsx            # CSV import wizard
  TransactionsPage.tsx        # Pending transactions management
  RecentTransactions.tsx      # Recent N expenses (dashboard)
  SpendingTrendChart.tsx      # Current vs previous month chart (recharts)
  MonthlyCard.tsx             # Monthly summary card
  FloatingAddButton.tsx       # FAB
  Header.tsx                  # Top nav with search
  SearchCommand.tsx           # Cmd+K search (cmdk)
  VoiceInput.tsx              # Speech-to-text

src/context/
  ExpenseContext.tsx           # Expenses + Categories state (useReducer)
  SettingsContext.tsx          # Currency, onboarding state
  TransactionsContext.tsx      # Pending transactions + rules state

src/lib/
  google-sheets.ts            # Sheets API wrapper
  ai-client.ts                # LLM client (Ollama/Gemini fallback)
  ai-tools.ts                 # Tool definitions for chat copilot
  ruleEngine.ts               # Transaction rule matching
  csvParser.ts                # CSV parsing + column auto-detection
  voice-parser.ts             # Voice-to-expense parsing
  animations.ts               # Framer Motion presets (smoothSpring, pageVariants)
  auth.ts                     # NextAuth config
  utils.ts                    # Currency, date, grouping helpers
  id-utils.ts                 # Year extraction from prefixed IDs

src/types/index.ts            # All TypeScript types + constants
src/types/speech-recognition.d.ts  # Web Speech API declarations
```

## API: `/api/drive`

All data operations go through this single route with `type` param.

**GET**: `expenses` (+ `year`), `categories`, `pending`, `rules`, `search` (+ `q`)
**POST**: `expense`, `expenses-batch`, `category`, `pending`, `pending-batch`, `pending-update-all`, `rule`, `rules-save`, `ai-categorize`, `move-to-expenses`
**PUT**: `expense`, `category`, `pending`, `rule`
**DELETE**: `expense` (+ `id`, `year`), `category` (+ `id`), `pending` (+ `id`), `rule` (+ `id`)

Other routes: `POST /api/chat` (AI with tool calling), `GET|PUT /api/settings`

## Key Types
```typescript
Expense { id, amount, date, category, description, createdAt, updatedAt }
Category { id, name, color (hex), icon (emoji) }
TransactionRule { id, name, conditions: RuleCondition[], logicMode: 'all'|'any', categoryId, enabled, createdAt }
RuleCondition { field: 'description'|'amount', matchType, value }
PendingTransaction { id, date, description, amount, status, category?, matchedRuleId?, source?, categorySource?: 'rule'|'ai'|'manual', createdAt? }
PendingTransactionStatus = 'auto-mapped' | 'uncategorized' | 'ignored'  // hyphens, not underscores
ChatMessage { role, content, attachments?, toolResults?, model?, isError? }
ChatAttachment { type: 'pdf'|'image', name, base64 }
CurrencyCode = 'INR'|'USD'|'EUR'|'GBP'|'JPY'|'CAD'|'AUD'|'CHF'|'CNY'|'SGD'
```

Default categories: Groceries, Transport, Dining, Utilities, Entertainment, Shopping, Health, Other (defined in `DEFAULT_CATEGORIES` with emoji icons and `CATEGORY_COLORS`).

## Google Sheets Structure
Yearly spreadsheets ("Expense Tracker YYYY") with sheets: Expenses, Categories, Settings, Pending Transactions, Rules.

## Environment Variables
```
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
NEXTAUTH_SECRET, NEXTAUTH_URL
OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_API_KEY
GEMINI_API_KEY, GEMINI_MODEL
MODAL_ENDPOINT_URL  # optional, PDF OCR (disabled)
```

---

## Design System — iOS 26 Liquid Glass

**All screens must follow this glass design language. Do not deviate.**

### Fonts
- **Body**: Inter (`next/font/google`, var `--font-inter`, Tailwind `font-sans`)
- **Numbers**: system monospace (`font-mono`) — always apply to monetary amounts and numeric displays

### Page Layout (every page)
```tsx
<div className="min-h-screen ios26-bg">
  <header className="sticky top-0 z-30 glass-heavy">
    <div className="max-w-app mx-auto px-5 md:px-8 py-4">{/* Title */}</div>
  </header>
  <motion.div variants={pageVariants} initial="initial" animate="animate"
    className="max-w-app mx-auto px-4 md:px-6 py-6">{/* Content */}</motion.div>
</div>
```

Sub-page headers: back button with `ArrowLeft`, `text-text-secondary`, `hover:bg-surface-hover`.

### Glass CSS Classes (`globals.css`)
| Class | Purpose |
|-------|---------|
| `ios26-bg` | Page background — teal/navy mesh gradients |
| `glass` | Standard translucent material |
| `glass-heavy` | Sticky headers — blur(40px) saturate(180%) |
| `glass-card` | Content cards — translucent bg + blur(24px), 16px radius |
| `glass-pill` | Active tab/chip — lighter glass fill + shadow |
| `glass-tab-bar` | Tab group container — 14px radius |
| `glass-btn` | Button glass — blur(12px) + border |
| `glass-separator` | Divider — `var(--glass-separator)` |
| `glass-dialog-overlay` | Dialog overlay animation |
| `glass-dialog-content` | Dialog content animation |
| `glass-dropdown` | Dropdown menu animation |

### Rules
- Cards: always `glass-card`, never opaque `bg-surface`/`bg-background`
- Grouped lists: `glass-card divide-y divide-[var(--glass-separator)]`
- Tabs: `glass-tab-bar flex gap-1 p-1.5`, active = `glass-pill rounded-xl`
- Dialogs/Selects: styled globally in `ui/dialog.tsx` and `ui/select.tsx` — do not override

### Color Tokens
| Token | Light | Dark |
|-------|-------|------|
| `--background` | #F2F2F7 | #162032 |
| `--surface` | #FFFFFF | #1e2d42 |
| `--text-primary` | #000000 | #FFFFFF |
| `--text-secondary` | rgba(60,60,67,0.6) | rgba(235,235,245,0.6) |
| `--text-muted` | rgba(60,60,67,0.36) | rgba(235,235,245,0.3) |
| `--accent` | #007AFF | #007AFF |
| `--glass-bg` | rgba(255,255,255,0.55) | rgba(255,255,255,0.06) |
| `--glass-bg-heavy` | rgba(255,255,255,0.78) | rgba(20,35,60,0.70) |
| `--glass-card-bg` | rgba(255,255,255,0.92) | rgba(30,45,66,0.2) |

Additional Tailwind tokens: `ios-*` colors, `cat-*` category colors, `surface-hover`, `success`, `warning`, `error`. Shadows: `soft`, `medium`, `elevated`, `glass`, `glass-pill`.

---

## Agent Rules

### Data
- Never call Google Sheets directly — use `/api/drive` routes
- Three context providers in layout: `DataProvider`, `SettingsProvider`, `PendingTransactionsProvider`
- Contexts cache to sessionStorage; call `refresh()` after mutations
- Dates: ISO `YYYY-MM-DD`, IDs: UUID v4 (server-generated)

### UI
- Use existing Radix primitives from `src/components/ui/`
- Animations: import from `lib/animations.ts`
- Icons: `lucide-react`
- Follow glass design system — no opaque backgrounds on pages or cards
- Use `skeleton` CSS class for loading states

### New Pages
- App Router `page.tsx` convention
- Providers already in layout — no wrapping needed
- Add to `BottomNav.tsx` if primary navigation
- Must use `ios26-bg` + `glass-heavy` header + `max-w-app` layout

### Testing
- Check mobile view (bottom nav, touch targets)
- Verify sessionStorage invalidation after CRUD
- Test empty states

### Common Issues
- Blank page: `pkill -f "next dev"; rm -rf .next; npm run dev`
- Hydration errors: guard browser-only APIs (Speech, localStorage) with `useEffect`
- Sheets auth: verify OAuth scopes include `spreadsheets` and `drive.file`
