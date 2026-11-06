$ErrorActionPreference = 'Stop'
$name = 'pcdnades-revision-test-' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
$migration = Join-Path $PSScriptRoot '../../migrations/20261105170000_grenade_revision.sql'
try {
  docker run -d --name $name --network none --tmpfs /var/lib/postgresql/data:rw,size=256m -e POSTGRES_PASSWORD=isolated-test postgres:17-alpine | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Não foi possível criar o PostgreSQL descartável.' }
  $ready = $false
  for ($i = 0; $i -lt 30; $i++) { docker exec $name pg_isready -U postgres *> $null; if ($LASTEXITCODE -eq 0) { $ready = $true; break }; Start-Sleep -Milliseconds 500 }
  if (!$ready) { throw 'PostgreSQL descartável não iniciou.' }
  $setup = @"
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA private;
CREATE TABLE public.media_assets (id uuid primary key, status text not null);
CREATE TABLE public.grenades (id uuid primary key, title text not null, video_id uuid not null references public.media_assets(id), destinations jsonb, origin_x float8, origin_y float8);
GRANT UPDATE ON public.grenades TO authenticated;
INSERT INTO public.media_assets VALUES ('00000000-0000-4000-8000-000000000001','ready');
INSERT INTO public.grenades VALUES ('00000000-0000-4000-8000-000000000002','Original','00000000-0000-4000-8000-000000000001', '[{"x":0.3,"y":0.5,"type":"smoke"}]',0.1,0.2);
"@
  $setup | docker exec -i $name psql -U postgres -d postgres -v ON_ERROR_STOP=1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar fixture.' }
  Get-Content -Raw -LiteralPath $migration | docker exec -i $name psql -U postgres -d postgres -v ON_ERROR_STOP=1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao aplicar migration no laboratório.' }
  $privileges = docker exec $name psql -U postgres -d postgres -Atc "SELECT has_table_privilege('authenticated','public.grenades','UPDATE'), has_table_privilege('service_role','public.grenades','UPDATE');"
  if ($privileges -ne 'f|t') { throw 'Privilégios de UPDATE incorretos.' }
  $first = Start-Job -ArgumentList $name { param($n) docker exec $n psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc "BEGIN; UPDATE public.grenades SET title='Primeira' WHERE revision=1 RETURNING revision; SELECT pg_sleep(2); COMMIT;" }
  Start-Sleep -Milliseconds 400
  $second = Start-Job -ArgumentList $name { param($n) docker exec $n psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc "UPDATE public.grenades SET title='Segunda' WHERE revision=1 RETURNING revision;" }
  Wait-Job $first,$second | Out-Null
  $a = (Receive-Job $first) -join "`n"; $b = (Receive-Job $second) -join "`n"
  if ($a -notmatch 'UPDATE 1' -or $b -notmatch 'UPDATE 0') { throw 'A disputa não produziu uma única atualização.' }
  $actual = docker exec $name psql -U postgres -d postgres -Atc "SELECT title,revision,video_id,origin_x,origin_y,jsonb_array_length(destinations) FROM public.grenades;"
  if ($actual -ne 'Primeira|2|00000000-0000-4000-8000-000000000001|0.1|0.2|1') { throw 'Dados da fixture não foram preservados.' }
  $same = docker exec $name psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc "BEGIN; UPDATE public.grenades SET title='Terceira' WHERE revision=2 RETURNING revision; UPDATE public.grenades SET title='Quarta' WHERE revision=3 RETURNING revision; ROLLBACK; SELECT revision FROM public.grenades;"
  if (($same -join "`n") -notmatch '(?s)3.*UPDATE 1.*4.*UPDATE 1.*ROLLBACK.*2') { throw 'Revisões na mesma transação ou rollback falharam.' }
  $service = docker exec $name psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc "BEGIN; SET ROLE service_role; UPDATE public.grenades SET title='Serviço' WHERE revision=2 RETURNING revision; RESET ROLE; ROLLBACK;"
  if (($service -join "`n") -notmatch '(?s)3.*UPDATE 1.*ROLLBACK') { throw 'A escrita pelo service_role falhou.' }
  Write-Output 'PASS: uma atualização concorrente, uma recusa, dados preservados e revisão monotônica na mesma transação.'
} finally {
  # O nome é gerado nesta execução; não atua sobre recursos preexistentes.
  if (docker inspect $name 2>$null) { docker rm -f $name | Out-Null }
}
