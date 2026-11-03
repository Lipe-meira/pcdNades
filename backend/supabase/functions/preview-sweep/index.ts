const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error('CONFIGURATION_MISSING');
  return value;
};
const digest = (value: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
async function authorized(actual: string, expected: string) {
  const a = new Uint8Array(await digest(actual));
  const b = new Uint8Array(await digest(expected));
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  let secret: string;
  try { secret = env('PREVIEW_SWEEP_TOKEN'); } catch { return new Response(null, { status: 503 }); }
  if (!await authorized(request.headers.get('x-preview-sweep-token') ?? '', secret)) return new Response(null, { status: 401 });
  const holder = crypto.randomUUID();
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]);
  let claimed = false;
  try {
    const base = new URL(env('SUPABASE_URL'));
    if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error('INVALID_ORIGIN');
    const key = env('SUPABASE_SERVICE_ROLE_KEY');
    const call = async (path: string, init: RequestInit = {}) => {
      const response = await fetch(new URL(path, base), {
        ...init,
        headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', ...init.headers },
        signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
        redirect: 'error',
      });
      if (!response.ok) throw new Error('DEPENDENCY_FAILED');
      if (response.status === 204) return null;
      return await response.json();
    };
    const rpc = (name: string, args: object) => call(`/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(args) });
    if (!await rpc('claim_preview_sweep', { p_holder: holder })) return new Response(null, { status: 409 });
    claimed = true;
    const remove = (name: string) => call('/storage/v1/object/import-previews', { method: 'DELETE', body: JSON.stringify({ prefixes: [name] }) });
    let removed = 0;
    for (; removed < 50; removed++) {
      const job = await rpc('claim_source_preview_cleanup', { p_holder: crypto.randomUUID() });
      if (!job?.source_id) break;
      const expires = Date.parse(job.expires_at), lockedUntil = Date.parse(job.locked_until);
      if (!uuid.test(job.source_id) || job.object_key !== `${job.source_id}.mp4` || !uuid.test(job.holder) || !Number.isFinite(expires) || !Number.isFinite(lockedUntil) || expires + 120_000 > Date.now() || lockedUntil <= Date.now()) throw new Error('INVALID_JOB');
      await remove(job.object_key);
      if (!await rpc('finish_source_preview_cleanup', { p_source: job.source_id, p_holder: job.holder })) throw new Error('CLAIM_LOST');
    }
    if (removed === 50) throw new Error('PARTIAL_SWEEP');
    let offset = 0, complete = false;
    for (let page = 0; page < 10; page++) {
      const items = await call('/storage/v1/object/list/import-previews', { method: 'POST', body: JSON.stringify({ prefix: '', offset, limit: 100, sortBy: { column: 'name', order: 'asc' } }) });
      if (!Array.isArray(items)) throw new Error('INVALID_LIST');
      let deleted = 0;
      for (const item of items) {
        const name = item.name;
        if (typeof name !== 'string' || !name.endsWith('.mp4')) continue;
        const id = name.slice(0, -4), created = Date.parse(item.created_at);
        if (!uuid.test(id) || !Number.isFinite(created) || created > Date.now() - 1_800_000) continue;
        const rows = await call(`/rest/v1/import_preview_jobs?select=source_id&source_id=eq.${id}&limit=1`);
        if (!Array.isArray(rows)) throw new Error('INVALID_LOOKUP');
        if (rows.length) continue;
        await remove(name); deleted++;
      }
      if (items.length < 100) { complete = true; break; }
      offset += items.length - deleted;
    }
    if (!complete) throw new Error('PARTIAL_SWEEP');
    const cutoff = encodeURIComponent(new Date(Date.now() - 120_000).toISOString());
    const backlog = await call(`/rest/v1/import_preview_jobs?select=source_id&expires_at=lte.${cutoff}&limit=1`);
    if (!Array.isArray(backlog) || backlog.length) throw new Error('BACKLOG');
    signal.throwIfAborted();
    if (!await rpc('finish_preview_sweep', { p_holder: holder })) throw new Error('LEASE_LOST');
    claimed = false;
    const ping = new URL(env('PREVIEW_HEALTHCHECK_URL'));
    if (ping.protocol !== 'https:' || ping.hostname !== 'hc-ping.com' || ping.username || ping.password || ping.search || ping.hash) throw new Error('INVALID_MONITOR');
    const result = await fetch(ping, { signal: AbortSignal.timeout(5000), redirect: 'error' });
    if (!result.ok) throw new Error('MONITOR_FAILED');
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 503 });
  } finally {
    // Failed invocations retain the short lease until expiry. This avoids racing late requests.
    void claimed;
  }
});
