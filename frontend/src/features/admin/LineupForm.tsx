import { useRef, useState } from 'react'
import type { GameMap, GrenadeType, Lineup, LineupDraft, Side } from '../../domain/types'
import { typeLabels } from '../../domain/types'
import { validateDraft } from '../../domain/validation'
import type { LineupService } from '../../services/lineupService'
import { Dialog } from '../../components/Dialog'
import { Radar } from '../../components/Radar'
import { MediaInput } from './MediaInput'

export function LineupForm({ maps, existing, service, onClose, onSaved }: { maps: GameMap[]; existing?: Lineup; service: LineupService; onClose: () => void; onSaved: (item: Lineup) => void }) {
  const [draft, setDraft] = useState<LineupDraft>(() => existing ? { title: existing.title, mapId: existing.mapId, type: existing.type, side: existing.side, instructions: existing.instructions, target: existing.target, media: { kind: 'keep' } } : { title: '', mapId: maps[0].id, type: 'smoke', side: 'T', instructions: '', target: null, media: { kind: 'file', file: null } })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<string>()
  const [fileReady, setFileReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const submitLock = useRef(false)
  const errorRef = useRef<HTMLDivElement>(null)
  const map = maps.find(item => item.id === draft.mapId) ?? maps[0]
  function update<K extends keyof LineupDraft>(key: K, value: LineupDraft[K]) { setDraft(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: '' })) }
  function showErrors(next: Record<string, string>) { setErrors(next); requestAnimationFrame(() => errorRef.current?.focus()) }
  return <Dialog title={existing ? 'Editar granada' : 'Nova granada'} description="Cadastro temporário para testar a interface. Nada será enviado ao servidor." onClose={onClose} busy={busy} wide>
    <form noValidate onSubmit={async event => {
      event.preventDefault()
      if (submitLock.current) return
      const nextErrors = validateDraft(draft, maps.map(item => item.id), !!existing)
      if (draft.media.kind === 'file' && draft.media.file && !fileReady) nextErrors.media = 'Aguarde a prévia carregar e escolha um MP4 reproduzível.'
      if (Object.keys(nextErrors).length) { showErrors(nextErrors); return }
      submitLock.current = true; setBusy(true); setFailure(undefined)
      try { const item = existing ? await service.updateLineup(existing.id, draft) : await service.createLineup(draft); onSaved(item) }
      catch (error) { setFailure(error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente.'); requestAnimationFrame(() => errorRef.current?.focus()) }
      finally { submitLock.current = false; setBusy(false) }
    }}>
      {(Object.values(errors).some(Boolean) || failure) && <div className="error-summary" role="alert" tabIndex={-1} ref={errorRef}><strong>{failure ?? 'Revise os campos antes de salvar.'}</strong>{!failure && <ul>{Object.entries(errors).filter(([, message]) => message).map(([key, message]) => <li key={key}>{message}</li>)}</ul>}</div>}
      <fieldset disabled={busy} className="form-grid">
        <div className="form-fields">
          <label>Título<input value={draft.title} onChange={event => update('title', event.target.value)} maxLength={120} aria-invalid={!!errors.title} autoComplete="off" placeholder="Ex.: nome da granada e destino" /></label>
          <div className="field-row"><label>Mapa<select value={draft.mapId} onChange={event => { setDraft(current => ({ ...current, mapId: event.target.value, target: null })); setErrors(current => ({ ...current, target: '' })) }}>{maps.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Tipo<select value={draft.type} onChange={event => update('type', event.target.value as GrenadeType)}>{Object.entries(typeLabels).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label><label>Lado<select value={draft.side} onChange={event => update('side', event.target.value as Side)}><option>T</option><option>CT</option></select></label></div>
          <label>Instruções<textarea rows={5} value={draft.instructions} onChange={event => update('instructions', event.target.value)} maxLength={6000} aria-invalid={!!errors.instructions} placeholder="Descreva posicionamento, mira e execução." /></label>
          <div><h3 className="field-title">Vídeo</h3><MediaInput value={draft.media} existing={existing?.video} onChange={media => update('media', media)} onFileReady={setFileReady} error={errors.media} /></div>
        </div>
        <div className="form-radar"><h3 className="field-title">Destino no radar</h3><p className="field-hint">Clique ou toque na imagem para marcar onde a granada cai. Ao trocar o mapa, marque novamente.</p><Radar map={map} target={draft.target} onTargetChange={target => update('target', target)} />
          <div className="field-row coordinates"><label>Coordenada X (%)<input type="number" min="0" max="100" step="0.1" value={draft.target && Number.isFinite(draft.target.x) ? Number((draft.target.x * 100).toFixed(2)) : ''} aria-invalid={!!errors.target} onChange={event => update('target', { x: event.target.value === '' ? NaN : Number(event.target.value) / 100, y: draft.target?.y ?? 0.5 })} /></label><label>Coordenada Y (%)<input type="number" min="0" max="100" step="0.1" value={draft.target && Number.isFinite(draft.target.y) ? Number((draft.target.y * 100).toFixed(2)) : ''} aria-invalid={!!errors.target} onChange={event => update('target', { x: draft.target?.x ?? 0.5, y: event.target.value === '' ? NaN : Number(event.target.value) / 100 })} /></label></div>
          <p className="field-hint">Você também pode preencher as coordenadas pelo teclado. Origem no canto superior esquerdo.</p>{errors.target && <p className="field-error">{errors.target}</p>}
        </div>
      </fieldset>
      <div className="form-actions"><span>Somente nesta sessão do navegador</span><button type="button" className="button secondary" onClick={onClose} disabled={busy}>Cancelar</button><button type="submit" className="button primary" disabled={busy}>{busy ? 'Salvando…' : draft.media.kind === 'link' ? 'Verificar importação' : 'Salvar demonstração'}</button></div>
    </form>
  </Dialog>
}
