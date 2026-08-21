import { startOfWeek, endOfWeek, format } from 'date-fns';

export function groupByWeek<T>(
  data: T[],
  dateExtractor: (item: T) => string
): { weekStart: Date; weekEnd: Date; label: string; items: T[] }[] {
  const grouped = new Map<string, T[]>();

  data.forEach((item) => {
    const dateStr = dateExtractor(item);
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return;
    
    
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const key = start.toISOString();
    
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(item);
  });

  const result = Array.from(grouped.entries()).map(([key, items]) => {
    const start = new Date(key);
    const end = endOfWeek(start, { weekStartsOn: 1 });
    return {
      weekStart: start,
      weekEnd: end,
      label: `Week (${format(start, 'MMM dd')} - ${format(end, 'MMM dd')})`,
      items: items.sort((a, b) => new Date(dateExtractor(a)).getTime() - new Date(dateExtractor(b)).getTime()),
    };
  });

  return result.sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
}