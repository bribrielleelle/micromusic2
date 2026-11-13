export interface ColorToken {
  name: string;
  token: string;
  hex: string;
  role: string;
}

export const COLOR_TOKENS: ColorToken[] = [
  {
    name: 'Warm Parchment',
    token: '--sona-canvas',
    hex: '#F7F3EC',
    role: '60% Dominant neutral background canvas',
  },
  {
    name: 'Cream Sleeve',
    token: '--sona-surface',
    hex: '#FCF9F4',
    role: 'Primary elevated card & floating player surface',
  },
  {
    name: 'Linen Fold',
    token: '--sona-surface-alt',
    hex: '#EFE9DE',
    role: '30% Structural sidebar, footer, & hover surface',
  },
  {
    name: 'Aged Paper Rule',
    token: '--sona-border',
    hex: '#DDD5C7',
    role: 'Hairline 1px borders and pane dividers',
  },
  {
    name: 'Espresso Ink',
    token: '--sona-ink',
    hex: '#1F1B18',
    role: 'Primary headings and high-contrast body text',
  },
  {
    name: 'Warm Umber',
    token: '--sona-muted',
    hex: '#5C534A',
    role: 'Metadata, curator handles, and secondary labels',
  },
  {
    name: 'Terracotta Label',
    token: '--sona-accent',
    hex: '#B84A2E',
    role: '10% Primary CTA, active nav marker, and playback progress',
  },
  {
    name: 'Turntable Brass',
    token: '--sona-brass',
    hex: '#C68B3C',
    role: 'Secondary warm highlight for crate accents',
  },
];

export interface BreakpointSpec {
  tier: string;
  range: string;
  sidebar: string;
  centerFeed: string;
  heroVinyl: string;
  footerPlayer: string;
}

export const BREAKPOINT_SPECS: BreakpointSpec[] = [
  {
    tier: 'Desktop Baseline',
    range: '>= 1280px (1440px target)',
    sidebar: 'Fixed 260px left rail with full Crates list and Fandom search',
    centerFeed: 'Fluid center column with Now Playing card, Up Next row, and 2-column masonry feed',
    heroVinyl: 'Fixed 320px right pane with full decorative turntable & tonearm',
    footerPlayer: 'Full global bar with master volume + visible 200x200px dimmed provider embed slot',
  },
  {
    tier: 'Compact Desktop / Landscape Tablet',
    range: '1024px – 1279px (lg)',
    sidebar: 'Fixed 240px left rail',
    centerFeed: 'Fluid center column with 2-column masonry feed',
    heroVinyl: 'Compact 272px right pane with scaled decorative vinyl',
    footerPlayer: 'Full global bar with collapsible/docked 200x200px provider embed container',
  },
  {
    tier: 'Mobile & Portrait Tablet',
    range: '< 1024px (below lg)',
    sidebar: 'Collapses to slide-over hamburger drawer triggered from top bar',
    centerFeed: 'Single-column full-width feed with compact Now Playing card',
    heroVinyl: 'Hidden on narrow screens (optional mini disc inside Now Playing card)',
    footerPlayer: 'Condensed mobile mini-player bar (height <= 15% viewport)',
  },
];

export interface PrototypeTrack {
  id: string;
  title: string;
  artist: string;
  curator: string;
  provider: 'SoundCloud' | 'YouTube';
  duration: string;
  tags: string[];
  crateName: string;
  coverTone: string;
  coverAccent: string;
}

export const PROTOTYPE_TRACKS: PrototypeTrack[] = [
  {
    id: 'trk-1',
    title: 'Velvet Static (Late Night Tape)',
    artist: 'Mireille & The Tape Quartet',
    curator: '@analog_maya',
    provider: 'SoundCloud',
    duration: '04:18',
    tags: ['shoegaze', 'tape-loop', '1994'],
    crateName: 'Midnight Pressing',
    coverTone: '#2E2622',
    coverAccent: '#B84A2E',
  },
  {
    id: 'trk-2',
    title: 'Harbor Fog at 3AM (Live Session)',
    artist: 'Kaito Takahashi',
    curator: '@crate_julian',
    provider: 'YouTube',
    duration: '05:42',
    tags: ['ambient-jazz', 'rhodes', 'tokyo'],
    crateName: 'Rainy Sunday Crates',
    coverTone: '#394037',
    coverAccent: '#C68B3C',
  },
  {
    id: 'trk-3',
    title: 'Amber Reel No. 7',
    artist: 'Solene Vasseur',
    curator: '@velvet_nora',
    provider: 'SoundCloud',
    duration: '03:29',
    tags: ['french-pop', 'dub', 'analog'],
    crateName: 'B-Side Gems',
    coverTone: '#523B2B',
    coverAccent: '#D99B52',
  },
  {
    id: 'trk-4',
    title: 'Basement Oscillator Dub',
    artist: 'Devon Park',
    curator: '@sub_archive',
    provider: 'YouTube',
    duration: '06:11',
    tags: ['uk-garage', 'vinyl-rip', 'deep'],
    crateName: 'Midnight Pressing',
    coverTone: '#23282D',
    coverAccent: '#B84A2E',
  },
];

export const PROTOTYPE_CRATES = [
  { id: 'crt-1', name: 'Midnight Pressing', count: 18 },
  { id: 'crt-2', name: 'Rainy Sunday Crates', count: 12 },
  { id: 'crt-3', name: 'B-Side Gems', count: 24 },
  { id: 'crt-4', name: 'Tokyo Cassette 89', count: 9 },
];
