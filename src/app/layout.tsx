import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SessionProvider } from '@/components/SessionProvider';
import { DataProvider } from '@/context/ExpenseContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { PendingTransactionsProvider } from '@/context/TransactionsContext';
import { Toaster } from '@/components/ui/toaster';
import { BottomNav } from '@/components/BottomNav';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Pattiyal',
  description: 'Track your personal expenses with ease',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} min-h-screen bg-background font-sans antialiased`}>
        <SessionProvider>
          <SettingsProvider>
            <DataProvider>
              <PendingTransactionsProvider>
                <main className="min-h-screen pb-20">
                  {children}
                </main>
                <BottomNav />
                <Toaster />
              </PendingTransactionsProvider>
            </DataProvider>
          </SettingsProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
