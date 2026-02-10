'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { Expense } from '@/types';
import { useSettings } from '@/context/SettingsContext';
import { formatCurrency, getMonthKey, getCurrentMonthKey } from '@/lib/utils';
import { format, subMonths, isSameMonth, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isAfter, isBefore } from 'date-fns';

interface SpendingTrendChartProps {
  expenses: Expense[];
  className?: string;
}

export function SpendingTrendChart({ expenses, className }: SpendingTrendChartProps) {
  const { settings } = useSettings();
  const currentMonthKey = getCurrentMonthKey();
  
  // Calculate previous month key
  const prevMonthDate = subMonths(new Date(), 1);
  const prevMonthKey = getMonthKey(prevMonthDate.toISOString());

  const data = useMemo(() => {
    const today = new Date();
    const currentMonthStart = startOfMonth(today);
    const daysInMonth = eachDayOfInterval({
      start: currentMonthStart,
      end: endOfMonth(today),
    });

    // Filter expenses for current and previous month
    const currentMonthExpenses = expenses.filter(
      (e) => getMonthKey(e.date) === currentMonthKey
    );
    const prevMonthExpenses = expenses.filter(
      (e) => getMonthKey(e.date) === prevMonthKey
    );

    let currentCumulative = 0;
    let prevCumulative = 0;

    return daysInMonth.map((day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayOfMonth = day.getDate();
      
      // Add expenses for this day
      const todayExpenses = currentMonthExpenses.filter((e) => e.date.startsWith(dayStr));
      const todayTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
      
      // Add expenses for same day last month
      // Note: This is an approximation (comparing 1st to 1st, etc.)
      const prevMonthDayExpenses = prevMonthExpenses.filter((e) => {
        const d = parseISO(e.date);
        return d.getDate() === dayOfMonth;
      });
      const prevDayTotal = prevMonthDayExpenses.reduce((sum, e) => sum + e.amount, 0);

      // Update cumulatives
      // Only update current month cumulative if the day has passed or is today
      const isFuture = isAfter(day, today);
      
      if (!isFuture) {
        currentCumulative += todayTotal;
      }
      
      prevCumulative += prevDayTotal;

      return {
        day: dayOfMonth,
        current: isFuture ? null : currentCumulative,
        previous: prevCumulative,
        fullDate: format(day, 'MMM d'),
      };
    });
  }, [expenses, currentMonthKey, prevMonthKey]);

  // Calculate totals for summary
  const currentTotal = data[data.length - 1]?.current || 0; // This might be null if end of month is future
  // Find last non-null current value
  const actualCurrentTotal = [...data].reverse().find(d => d.current !== null)?.current || 0;
  
  // Find previous total at the same day of month as today
  const todayDayOfMonth = new Date().getDate();
  const prevTotalAtSameTime = data.find(d => d.day === todayDayOfMonth)?.previous || 0;
  
  const difference = actualCurrentTotal - prevTotalAtSameTime;
  const isSpendingMore = difference > 0;

  return (
    <div className={`p-5 glass-card ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Spending Trend</h3>
          <p className="text-sm text-text-muted">vs. Last Month</p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-medium ${isSpendingMore ? 'text-red-500' : 'text-green-500'}`}>
            {isSpendingMore ? '+' : ''}{formatCurrency(difference, settings.currency)}
          </p>
          <p className="text-xs text-text-muted">
            {isSpendingMore ? 'more' : 'less'} than last month
          </p>
        </div>
      </div>

      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis 
              dataKey="day" 
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: '#64748b' }}
              interval={4}
            />
            <YAxis 
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(value) => `${value / 1000}k`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="glass-card p-3 !bg-white/90 dark:!bg-black/90 text-xs border border-white/20 shadow-xl backdrop-blur-md">
                      <p className="font-semibold mb-2 text-text-primary">Day {label}</p>
                      {payload.map((entry: any) => (
                        <div key={entry.name} className="flex items-center gap-2 mb-1 last:mb-0">
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-text-muted capitalize">
                            {entry.name === 'current' ? 'This Month' : 'Last Month'}:
                          </span>
                          <span className="font-mono font-medium text-text-primary">
                            {formatCurrency(entry.value, settings.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="current"
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCurrent)"
              name="current"
              animationDuration={1500}
            />
            <Line
              type="monotone"
              dataKey="previous"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              name="previous"
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
