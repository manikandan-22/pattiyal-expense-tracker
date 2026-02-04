# Expense Tracker (Pattiyal)

## Overview
A personal expense tracking app built with Next.js 14, using Google Sheets as the backend storage. Features CSV import, voice input, and multi-year expense management.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **UI Components**: Radix UI primitives, Framer Motion animations, Lucide icons
- **Auth**: NextAuth.js with Google OAuth (JWT strategy)
- **Backend Storage**: Google Sheets API (yearly spreadsheets)
- **PDF OCR**: PaddleOCR on Modal.com (currently disabled)

## Project Structure
```
src/
├── app/                          # Next.js App Router pages
│   ├── api/
│   │   ├── auth/[...nextauth]/  # NextAuth OAuth endpoints
│   │   ├── drive/               # Google Sheets CRUD operations
│   │   ├── pdf/                 # PDF extraction proxy (disabled)
│   │   └── settings/            # User settings management
│   ├── page.tsx                 # Home - expense list with filters
│   ├── add/                     # Add expense page
│   ├── import/                  # CSV import wizard
│   ├── categories/              # Category management
│   ├── monthly/                 # Monthly reports
│   │   └── [month]/             # Specific month details
│   ├── onboarding/              # First-time currency selection
│   ├── settings/                # App settings
│   └── auth/signin/             # Google OAuth sign-in
├── components/
│   ├── ui/                      # Radix UI primitives (Button, Input, Dialog, etc.)
│   ├── CsvImport.tsx            # 3-step import wizard
│   ├── ExpenseList.tsx          # Grouped expense display
│   ├── ExpenseAddDialog.tsx     # Add expense modal
│   ├── ExpenseEditDialog.tsx    # Edit expense modal
│   ├── VoiceInput.tsx           # Speech-to-text entry
│   ├── SearchCommand.tsx        # Cmd+K search palette
│   ├── CategoryManager.tsx      # Category CRUD interface
│   ├── CategoryPills.tsx        # Category filter chips
│   ├── Header.tsx               # Top nav with search
│   └── BottomNav.tsx            # Mobile navigation
├── context/
│   ├── ExpenseContext.tsx       # Expenses + Categories state (useReducer)
│   └── SettingsContext.tsx      # Currency, onboarding state
├── hooks/
│   ├── useVoice.ts              # Web Speech API wrapper
│   ├── useDebounce.ts           # Debounce utility
│   └── useSwipe.ts              # Touch swipe detection
├── lib/
│   ├── auth.ts                  # NextAuth config
│   ├── google-sheets.ts         # Google Sheets API wrapper (625 lines)
│   ├── csvParser.ts             # CSV parsing + auto-detection
│   ├── voice-parser.ts          # Voice-to-expense parsing
│   ├── animations.ts            # Framer Motion presets
│   └── utils.ts                 # Currency, date, grouping helpers
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
| POST | `type=expense` + body | Add single expense |
| POST | `type=expenses-batch` + body | Batch import expenses |
| POST | `type=category` + body | Add category |
| PUT | `type=expense` + body | Update expense |
| PUT | `type=category` + body | Update category |
| DELETE | `type=expense&id=xxx&year=2024` | Delete expense |
| DELETE | `type=category&id=xxx` | Delete category |

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
```

## Google Sheets Structure
- **Naming**: "Expense Tracker 2024", "Expense Tracker 2025" (yearly)
- **Sheets per spreadsheet**: Expenses, Categories, Settings
- **Expenses columns**: id | amount | date | category | description | createdAt | updatedAt
- **Categories columns**: id | name | color | icon
- **Settings columns**: key | value (currency, onboardingCompleted)

## Default Categories
Groceries, Transport, Dining, Utilities, Entertainment, Shopping, Health, Other

## Key Workflows

### CSV Import (CsvImport.tsx)
1. Upload CSV file
2. Auto-detect columns (date, description, amount) or manual mapping
3. Review transactions in tabs: Categorized | Needs Review | Manual
4. Auto-category suggestion from keywords
5. Batch import via `/api/drive?type=expenses-batch`

### Voice Input (VoiceInput.tsx + voice-parser.ts)
- Example: "spent fifty dollars on groceries yesterday"
- Parses: amount, category, date, description with confidence score

### Expense Management
- Home page: grouped by day, category filters, search (Cmd+K)
- Edit/delete via dialogs
- Multi-year support (automatic spreadsheet per year)

## Environment Variables
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
MODAL_ENDPOINT_URL=... (optional, for PDF)
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
- Contexts auto-cache to sessionStorage; call `refresh()` after mutations
- Expense dates: ISO format (YYYY-MM-DD)
- IDs: UUID v4 (generated server-side)

### For New Pages
- Use App Router conventions (`page.tsx`)
- Wrap with `ExpenseProvider` and `SettingsProvider` (already in layout)
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
