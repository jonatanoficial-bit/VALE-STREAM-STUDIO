import type { ReactElement } from 'react'

const paths = {
  home: 'M3 10 12 3l9 7M5 9v11h5v-6h4v6h5V9',
  production: 'M3 5h18v12H3zM8 21h8m-4-4v4M10 9l5 2-5 3z',
  documents: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7m-7 4h7',
  destinations: 'M5 16a7 7 0 0 1 14 0M2 12a11 11 0 0 1 20 0M9 19l3-3 3 3-3 3z',
  settings: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1zM15 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0',
  help: 'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  meeting: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M17 4a4 4 0 0 1 0 8m1 3a4 4 0 0 1 4 4v2',
  record: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  screen: 'M3 4h18v13H3zM8 21h8m-4-4v4',
} as const

export function Icon({ name, size = 20 }: { name: keyof typeof paths; size?: number }): ReactElement {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
