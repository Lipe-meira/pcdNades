function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

const path = new URL('../functions/preview-sweep/index.ts', import.meta.url);
const original = await Deno.readTextFile(path);
const moduleText = original.replace('Deno.serve(async (request) => {', 'export default async function(request) {').replace(/\}\);\s*$/, '}');
const { default: handler } = await import(`data:application/typescript,${encodeURIComponent(moduleText)}`);

// Each request below is synthetic. No database, storage or monitoring service is contacted.
for (const fault of ['storage', 'database', 'concurrency']) {
  Deno.test({
    name: `preview sweep fails closed on ${fault}`,
    sanitizeOps: false,
    sanitizeResources: false,
    async fn() {
      Deno.env.set('SUPABASE_URL', 'https://fixture.example');
      Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'fixture-key');
      Deno.env.set('PREVIEW_SWEEP_TOKEN', 'fixture-token');
      Deno.env.set('PREVIEW_HEALTHCHECK_URL', 'https://hc-ping.com/fixture');
      const originalFetch = globalThis.fetch;
      let locked = false, heartbeat = 0, pings = 0;
      let resume!: () => void, started!: () => void;
      const gate = new Promise<void>(resolve => { resume = resolve; });
      const waiting = new Promise<void>(resolve => { started = resolve; });
      globalThis.fetch = async (input) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        if (url.hostname === 'hc-ping.com') { pings++; return new Response('ok'); }
        if (url.pathname.endsWith('/claim_preview_sweep')) {
          if (locked) return Response.json(false);
          locked = true;
          return Response.json(true);
        }
        if (url.pathname.endsWith('/claim_source_preview_cleanup')) return Response.json(null);
        if (url.pathname.endsWith('/object/list/import-previews')) {
          if (fault === 'storage') return new Response(null, { status: 503 });
          if (fault === 'concurrency') { started(); await gate; }
          return Response.json([]);
        }
        if (url.pathname.endsWith('/import_preview_jobs')) {
          if (fault === 'database') return new Response(null, { status: 503 });
          return Response.json([]);
        }
        if (url.pathname.endsWith('/finish_preview_sweep')) { heartbeat++; return Response.json(true); }
        throw new Error('Unexpected fixture request');
      };
      try {
        const request = () => new Request('https://local.test', { method: 'POST', headers: { 'x-preview-sweep-token': 'fixture-token' } });
        if (fault === 'concurrency') {
          const first = handler(request());
          await waiting;
          assertEquals((await handler(request())).status, 409);
          assertEquals(heartbeat, 0);
          assertEquals(pings, 0);
          resume();
          assertEquals((await first).status, 204);
          assertEquals(heartbeat, 1);
          assertEquals(pings, 1);
        } else {
          assertEquals((await handler(request())).status, 503);
          assertEquals(heartbeat, 0);
          assertEquals(pings, 0);
        }
      } finally { globalThis.fetch = originalFetch; }
    },
  });
}
