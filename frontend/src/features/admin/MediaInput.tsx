import { useEffect, useRef, useState } from 'react'
import type { MediaDraft, Video } from '../../domain/types'
import { DEMO_MAX_SECONDS, validateMp4 } from '../../domain/validation'
import { Icon } from '../../components/Icon'
import { VideoPlayer } from '../library/VideoPlayer'

export function MediaInput({ value, existing, onChange, onFileReady, error }: { value: MediaDraft; existing?: Video; onChange: (value: MediaDraft) => void; onFileReady: (ready: boolean) => void; error?: string }) {
  const [fileError, setFileError] = useState<string>()
  const [preview, setPreview] = useState<string>()
  const [checking, setChecking] = useState(false)
  const sequence = useRef(0)
  const file = value.kind === 'file' ? value.file : null
  useEffect(() => {
    if (!file) { setPreview(undefined); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  useEffect(() => () => { sequence.current++ }, [])
  function changeMode(next: MediaDraft) { sequence.current++; setFileError(undefined); setChecking(false); onFileReady(false); onChange(next) }
  return <div className="media-input">
    <div role="group" aria-label="Origem do vídeo" className="media-tabs">
      {existing && <button type="button" className={`filter ${value.kind === 'keep' ? 'active' : ''}`} aria-pressed={value.kind === 'keep'} onClick={() => changeMode({ kind: 'keep' })}>Manter vídeo</button>}
      <button type="button" className={`filter ${value.kind === 'file' ? 'active' : ''}`} aria-pressed={value.kind === 'file'} onClick={() => changeMode({ kind: 'file', file: null })}><Icon name="upload" size={16} />Enviar MP4</button>
      <button type="button" className={`filter ${value.kind === 'link' ? 'active' : ''}`} aria-pressed={value.kind === 'link'} onClick={() => changeMode({ kind: 'link', sourceUrl: '' })}><Icon name="link" size={16} />Importar por link</button>
    </div>
    {value.kind === 'keep' && existing && <><VideoPlayer video={existing} /><p className="field-hint">O vídeo atual será mantido. Arquivos locais só existem nesta sessão.</p></>}
    {value.kind === 'file' && <>
      <label className="file-drop">Arquivo MP4<input type="file" accept="video/mp4,.mp4" aria-describedby="file-hint media-error" onChange={async event => {
        const nextFile = event.currentTarget.files?.[0] ?? null
        const current = ++sequence.current
        setFileError(undefined); onFileReady(false); onChange({ kind: 'file', file: null })
        if (!nextFile) return
        setChecking(true)
        try {
          const message = await validateMp4(nextFile)
          if (current !== sequence.current) return
          if (message) setFileError(message)
          else onChange({ kind: 'file', file: nextFile })
        } catch { if (current === sequence.current) setFileError('Não foi possível ler o arquivo. Selecione-o novamente.') }
        finally { if (current === sequence.current) setChecking(false) }
      }} /></label>
      <p className="field-hint" id="file-hint">Até 50 MB e 180 segundos nesta demonstração. O arquivo será aberto localmente; nenhum upload ou armazenamento no servidor é feito.</p>
      {checking && <p role="status" className="field-hint">Verificando arquivo…</p>}
      {preview && <><video className="media-preview" src={preview} controls playsInline preload="metadata" aria-label="Prévia do MP4 selecionado" onLoadedMetadata={event => { const duration = event.currentTarget.duration; const valid = Number.isFinite(duration) && duration > 0 && duration <= DEMO_MAX_SECONDS; setFileError(valid ? undefined : 'Escolha um vídeo com duração de até 180 segundos.'); onFileReady(valid) }} onError={() => { setFileError('Este navegador não conseguiu reproduzir o arquivo. Use MP4 com codecs compatíveis, como H.264/AAC.'); onFileReady(false) }} /><p className="field-hint">Prévia local · confirme o vídeo antes de salvar.</p></>}
    </>}
    {value.kind === 'link' && <><label>Link do YouTube Shorts ou TikTok<input type="url" value={value.sourceUrl} onChange={event => onChange({ kind: 'link', sourceUrl: event.target.value })} placeholder="https://www.youtube.com/shorts/…" aria-describedby="link-hint media-error" /></label><p className="inline-notice" id="link-hint">Importação indisponível nesta prévia. O link não será baixado e a granada não será publicada. Para testar a reprodução agora, escolha Enviar MP4.</p></>}
    {(fileError || error) && <p id="media-error" className="field-error" role="alert">{fileError || error}</p>}
  </div>
}
