export interface ThemeConfig {
  bg: string;
  text: string;
  border: string;
  borderStrong: string;
  ring: string;
  accent: string;
  accentBg: string;
  label: string;
  cover: string;
  spine: string;
  coverHoverBtn: string;
  pageBorder: string;
  emoji: string;
}

export const journalThemes: Record<string, ThemeConfig> = {
  ocean: { 
    bg: 'bg-sky-800', 
    text: 'text-sky-950', 
    border: 'border-sky-200', 
    borderStrong: 'border-sky-400',
    ring: 'ring-sky-500', 
    accent: 'text-sky-100',
    accentBg: 'bg-sky-400',
    label: 'Ocean Breeze',
    cover: 'bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-900',
    spine: 'border-indigo-950',
    coverHoverBtn: 'bg-blue-800',
    pageBorder: 'border-sky-100',
    emoji: '🌊'
  },
  forest: { 
    bg: 'bg-teal-800', 
    text: 'text-teal-950', 
    border: 'border-teal-200', 
    borderStrong: 'border-teal-400',
    ring: 'ring-teal-500', 
    accent: 'text-teal-100',
    accentBg: 'bg-teal-400',
    label: 'Forest Canopy',
    cover: 'bg-gradient-to-tr from-emerald-500 via-teal-700 to-green-950',
    spine: 'border-green-950',
    coverHoverBtn: 'bg-emerald-800',
    pageBorder: 'border-teal-100',
    emoji: '🌿'
  },
  sunset: { 
    bg: 'bg-orange-800', 
    text: 'text-orange-950', 
    border: 'border-orange-200', 
    borderStrong: 'border-orange-400',
    ring: 'ring-orange-500', 
    accent: 'text-orange-100',
    accentBg: 'bg-orange-400',
    label: 'Desert Sunset',
    cover: 'bg-gradient-to-tr from-amber-400 via-orange-600 to-rose-900',
    spine: 'border-rose-950',
    coverHoverBtn: 'bg-orange-800',
    pageBorder: 'border-orange-100',
    emoji: '🌅'
  },
  mist: { 
    bg: 'bg-slate-700', 
    text: 'text-slate-900', 
    border: 'border-slate-300', 
    borderStrong: 'border-slate-500',
    ring: 'ring-slate-400', 
    accent: 'text-slate-100',
    accentBg: 'bg-slate-400',
    label: 'Mountain Mist',
    cover: 'bg-gradient-to-tr from-slate-300 via-slate-500 to-slate-800',
    spine: 'border-slate-950',
    coverHoverBtn: 'bg-slate-600',
    pageBorder: 'border-slate-200',
    emoji: '🏔️'
  },
  night: { 
    bg: 'bg-indigo-950', 
    text: 'text-indigo-950', 
    border: 'border-indigo-300', 
    borderStrong: 'border-indigo-500',
    ring: 'ring-indigo-600', 
    accent: 'text-indigo-200',
    accentBg: 'bg-indigo-500',
    label: 'Starry Night',
    cover: 'bg-gradient-to-tr from-indigo-600 via-purple-900 to-neutral-950',
    spine: 'border-neutral-950',
    coverHoverBtn: 'bg-indigo-900',
    pageBorder: 'border-indigo-100',
    emoji: '🌌'
  },
  lavender: {
    bg: 'bg-fuchsia-800',
    text: 'text-fuchsia-950',
    border: 'border-fuchsia-200',
    borderStrong: 'border-fuchsia-400',
    ring: 'ring-fuchsia-500',
    accent: 'text-fuchsia-100',
    accentBg: 'bg-fuchsia-400',
    label: 'Calm Lavender',
    cover: 'bg-gradient-to-tr from-purple-400 via-fuchsia-600 to-indigo-950',
    spine: 'border-purple-950',
    coverHoverBtn: 'bg-purple-800',
    pageBorder: 'border-fuchsia-100',
    emoji: '🪻'
  },
  rose: {
    bg: 'bg-rose-800',
    text: 'text-rose-950',
    border: 'border-rose-200',
    borderStrong: 'border-rose-400',
    ring: 'ring-rose-500',
    accent: 'text-rose-100',
    accentBg: 'bg-rose-400',
    label: 'Soft Rose',
    cover: 'bg-gradient-to-tr from-pink-300 via-rose-500 to-rose-900',
    spine: 'border-rose-950',
    coverHoverBtn: 'bg-rose-800',
    pageBorder: 'border-rose-100',
    emoji: '🌹'
  },
  espresso: {
    bg: 'bg-stone-800',
    text: 'text-stone-950',
    border: 'border-stone-200',
    borderStrong: 'border-stone-400',
    ring: 'ring-stone-500',
    accent: 'text-stone-100',
    accentBg: 'bg-stone-400',
    label: 'Warm Espresso',
    cover: 'bg-gradient-to-tr from-stone-400 via-stone-700 to-stone-950',
    spine: 'border-stone-950',
    coverHoverBtn: 'bg-stone-800',
    pageBorder: 'border-stone-100',
    emoji: '☕'
  }
};

export const journalFonts = [
  { id: 'lora', label: 'Elegant Lora', font: 'font-lora' },
  { id: 'quicksand', label: 'Soft Quicksand', font: 'font-quicksand' },
  { id: 'handwriting', label: 'Handwritten', font: 'font-handwriting' },
  { id: 'mono', label: 'Typewriter', font: 'font-mono' },
  { id: 'serif', label: 'Classic Serif', font: 'font-serif' },
  { id: 'sans', label: 'Modern Sans', font: 'font-sans' },
  { id: 'display', label: 'Playful Display', font: 'font-display' },
];

export const getFontClass = (fontId: string) => {
  const font = journalFonts.find(f => f.id === fontId);
  return font ? font.font : 'font-serif';
};