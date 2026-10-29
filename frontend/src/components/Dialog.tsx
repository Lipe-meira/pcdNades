import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'

export function Dialog({ title, description, children, onClose, busy = false, wide = false }: { title: string; description: string; children: ReactNode; onClose: () => void; busy?: boolean; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    const dialog = ref.current!
    const before = document.activeElement as HTMLElement | null
    const originalOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => { dialog.close(); document.body.style.overflow = originalOverflow; if (before?.isConnected) before.focus() }
  }, [])
  return <dialog ref={ref} className={`dialog ${wide ? 'dialog-wide' : ''}`} aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="dialog-header"><div><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Fechar janela"><Icon name="close" /></button></div>{children}
  </dialog>
}
