import type { GrenadeType } from '../domain/types'

export function Icon({ name, size = 20 }: { name: GrenadeType | 'crosshair' | 'arrow' | 'plus' | 'close' | 'video' | 'info' | 'edit' | 'trash' | 'upload' | 'link' | 'check'; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    smoke: <path d="M7 17a4 4 0 0 1-2-7.5A5.5 5.5 0 0 1 15.5 7a5 5 0 0 1 2 9.6L17 19H7z" />,
    flashbang: <path d="m12 2 2 6 5-3-3 5 6 2-6 2 3 5-5-3-2 6-2-6-5 3 3-5-6-2 6-2-3-5 5 3z" />,
    molotov: <path d="M14 3c1 5-5 5-3 9 1-1 3-2 4-4 2 3 4 5 4 8a7 7 0 0 1-14 0c0-3 2-5 4-7-1 4 1 5 1 5 0-5 4-6 4-11Z" />,
    crosshair: <><circle cx="12" cy="12" r="6" /><path d="M12 1v6m0 10v6M1 12h6m10 0h6" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    video: <><rect x="3" y="6" width="12" height="12" rx="2" /><path d="m15 10 6-3v10l-6-3" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.1" /></>,
    edit: <><path d="m14 5 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14z" /></>,
    trash: <><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" /></>,
    upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6" /></>,
    link: <path d="m9 15 6-6M8 16l-2 2a3 3 0 0 1-4-4l5-5a3 3 0 0 1 4 0m2 6a3 3 0 0 0 4 0l5-5a3 3 0 0 0-4-4l-2 2" />,
    check: <path d="m5 12 4 4L19 6" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
