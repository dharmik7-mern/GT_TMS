import { addDays, format, nextDay, getDay, parse, isValid, setHours, setMinutes } from 'date-fns';

export interface ParsedTask {
  title: string;
  dueDate?: string;
  dueTime?: string;
  priority?: 'low' | 'medium' | 'high';
  labels?: string[];
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6
};

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

export const parseSmartInput = (input: string): ParsedTask => {
  let text = input.trim();
  const result: ParsedTask = { title: '' };
  const today = new Date();

  // 1. Hashtag (Labels) detection
  const tagMatches = text.match(/#(\w+)/g);
  if (tagMatches) {
    result.labels = tagMatches.map(m => m.slice(1).toLowerCase());
    tagMatches.forEach(m => {
      text = text.replace(m, '').trim();
    });
  }

  // 2. Priority detection
  const pMatch = text.match(/\b(high|urgent|medium|low|normal)\b/i);
  if (pMatch) {
    const p = pMatch[1].toLowerCase();
    result.priority = (p === 'urgent' || p === 'high') ? 'high' : (p === 'low' ? 'low' : 'medium');
    text = text.replace(new RegExp(`\\b${pMatch[1]}\\b`, 'i'), '').trim();
  }

  // 2. Complex Date Detection
  let foundDate: Date | null = null;

  // Patterns for date
  const patterns = [
    // Today/Tomorrow/Next week
    { re: /\b(today)\b/i, fn: () => today },
    { re: /\b(tomorrow)\b/i, fn: () => addDays(today, 1) },
    { re: /\bnext week\b/i, fn: () => addDays(today, 7) },
    
    // In X days
    { re: /\bin (\d+) days?\b/i, fn: (m: string[]) => addDays(today, parseInt(m[1])) },

    // Next [Weekday]
    { re: /\bnext (monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i, 
      fn: (m: string[]) => {
        const targetDay = WEEKDAYS[m[1].toLowerCase()];
        const currentDay = getDay(today);
        let diff = targetDay - currentDay;
        if (diff <= 0) diff += 7;
        return addDays(today, diff);
      }
    },
    
    // [Weekday] (implied next)
    { re: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i,
      fn: (m: string[]) => {
        const targetDay = WEEKDAYS[m[1].toLowerCase()];
        const currentDay = getDay(today);
        let diff = targetDay - currentDay;
        if (diff <= 0) diff += 7;
        return addDays(today, diff);
      }
    },

    // 2nd April / April 2nd / 2 April / Apr 2
    { re: /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i,
      fn: (m: string[]) => {
        const d = parseInt(m[1]);
        const month = MONTHS[m[2].toLowerCase()];
        const year = today.getFullYear();
        const date = new Date(year, month, d);
        // If the date has already passed this year, assume next year
        return date < today ? new Date(year + 1, month, d) : date;
      }
    },
    { re: /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i,
      fn: (m: string[]) => {
        const d = parseInt(m[2]);
        const month = MONTHS[m[1].toLowerCase()];
        const year = today.getFullYear();
        const date = new Date(year, month, d);
        return date < today ? new Date(year + 1, month, d) : date;
      }
    },
    // Numeric Date: 02-04 or 02/04 (DD-MM)
    { re: /\b(\d{1,2})[-/](\d{1,2})\b/i,
      fn: (m: string[]) => {
        const d = parseInt(m[1]);
        const month = parseInt(m[2]) - 1; 
        const year = today.getFullYear();
        if (month >= 0 && month < 12 && d > 0 && d <= 31) {
           const date = new Date(year, month, d);
           return date < today ? new Date(year + 1, month, d) : date;
        }
        return null;
      }
    }
  ];

  for (const p of patterns) {
    const match = text.match(p.re);
    if (match) {
      foundDate = p.fn(match as any);
      text = text.replace(match[0], '').trim();
      break; 
    }
  }

  if (foundDate) {
    result.dueDate = format(foundDate, 'yyyy-MM-dd');
  }

  // 3. Time detection (5pm, 10:30am, 15:00)
  const timeMatch = text.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i);
  if (timeMatch) {
    let rawTime = timeMatch[1].toLowerCase().replace(/\s/g, '');
    let hour = 0;
    let min = 0;

    if (rawTime.includes('pm')) {
      const parts = rawTime.replace('pm', '').split(':');
      hour = parseInt(parts[0]);
      hour = hour === 12 ? 12 : hour + 12;
      min = parts[1] ? parseInt(parts[1]) : 0;
    } else if (rawTime.includes('am')) {
       const parts = rawTime.replace('am', '').split(':');
       hour = parseInt(parts[0]) === 12 ? 0 : parseInt(parts[0]);
       min = parts[1] ? parseInt(parts[1]) : 0;
    } else if (rawTime.includes(':')) {
       const parts = rawTime.split(':');
       hour = parseInt(parts[0]);
       min = parseInt(parts[1]);
    } else {
       hour = parseInt(rawTime);
    }
    
    if (!isNaN(hour) && hour < 24) {
       result.dueTime = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
       text = text.replace(timeMatch[0], '').trim();
    }
  }

  // Cleaning up keywords like "by", "at", "on" if they are at the end
  text = text.replace(/\b(by|at|on|for)$/i, '').trim();
  result.title = text.replace(/\s+/g, ' ');
  
  return result;
};
