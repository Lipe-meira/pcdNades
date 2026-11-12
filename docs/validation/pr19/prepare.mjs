// Host-side setup. Never reads host environment credentials, linked projects or backups.
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {randomBytes,createHmac} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const suffix=process.argv[2]??'';if(!/^(?:-r[0-9]+)?$/.test(suffix))throw Error('Invalid lab suffix');
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../..'),runtime=resolve(here,'runtime'+suffix);
mkdirSync(runtime,{recursive:true});
const project='pcdn-pr19-352c-20261112'+suffix;
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',maxBuffer:8e6});
const baseline=JSON.parse(docker('ps','-aq')?JSON.stringify(docker('ps','-aq').trim().split(/\s+/)): '[]');
if(existsSync(resolve(runtime,'compose.json')))throw Error('Runtime exists: inspect it; never overwrite an existing lab.');
if(docker('volume','ls','-q').trim().split(/\s+/).some(v=>v===project+'-db'||v===project+'-objects')||docker('network','ls','--format','{{.Name}}').trim().split(/\s+/).includes(project+'-internal')||docker('ps','-aq','--filter',`label=com.docker.compose.project=${project}`).trim())throw Error('Project resources already exist; choose a new suffix.');
writeFileSync(resolve(runtime,'baseline.json'),JSON.stringify({containers:baseline,volumes:docker('volume','ls','-q').trim().split(/\s+/),networks:docker('network','ls','-q').trim().split(/\s+/)},null,2));
const password=randomBytes(24).toString('hex'),secret=randomBytes(48).toString('hex');
const jwt=role=>{const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),p=Buffer.from(JSON.stringify({role,iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+86400})).toString('base64url');return `${h}.${p}.${createHmac('sha256',secret).update(`${h}.${p}`).digest('base64url')}`;};
const anon=jwt('anon'),service=jwt('service_role');
writeFileSync(resolve(runtime,'init.sql'),`
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD '${password}';
GRANT anon,authenticated,service_role TO authenticator;
CREATE ROLE supabase_auth_admin LOGIN CREATEROLE PASSWORD '${password}';
CREATE ROLE supabase_storage_admin LOGIN CREATEROLE BYPASSRLS PASSWORD '${password}';
GRANT anon,authenticated,service_role TO supabase_storage_admin;
CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin; CREATE SCHEMA storage AUTHORIZATION supabase_storage_admin;
ALTER ROLE supabase_auth_admin SET search_path TO auth;
GRANT ALL ON SCHEMA public TO postgres,service_role,supabase_storage_admin;
GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''), (nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'sub'))::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''), (nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'role')) $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claims',true),'')::jsonb $$;
ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin; ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin; ALTER FUNCTION auth.jwt() OWNER TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_storage_admin IN SCHEMA storage GRANT ALL ON TABLES TO anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_storage_admin IN SCHEMA storage GRANT ALL ON SEQUENCES TO anon,authenticated,service_role;
`);
const dburl=user=>`postgres://${user}:${password}@db:5432/postgres`;
const baseEnv={FRONTEND_URL:'http://gateway:8000',SUPABASE_URL:'http://gateway:8000',SUPABASE_PUBLISHABLE_KEY:anon,SUPABASE_SERVICE_ROLE_KEY:service,DATABASE_URL:dburl('postgres'),MEDIA_UPLOAD_ENABLED:'true',MEDIA_TRIMMING_ENABLED:'true',MEDIA_MAX_DURATION_SECONDS:'20',FFPROBE_PATH:'/usr/bin/ffprobe',FFMPEG_PATH:'/usr/bin/ffmpeg',HOST:'0.0.0.0',PORT:'3001',CONTRIBUTORS_ENABLED:'true',CONTRIBUTOR_UPLOADS_ENABLED:'true',CONTRIBUTOR_IMPORTS_ENABLED:'true'};
const common={networks:['isolated'],restart:'no',labels:{'pcdnades.validation':project}};
const app={...common,image:`${project}-app`,build:{context:root,dockerfile:'docs/validation/pr19/Dockerfile'},environment:baseEnv,volumes:[`${runtime.replaceAll('\\','/') }:/results`]};
const compose={name:project,services:{
 db:{...common,image:'postgres:17',environment:{POSTGRES_PASSWORD:password},volumes:['dbdata:/var/lib/postgresql/data',`${runtime.replaceAll('\\','/')}/init.sql:/docker-entrypoint-initdb.d/00-lab.sql:ro`],healthcheck:{test:['CMD','pg_isready','-U','postgres'],interval:'2s',timeout:'2s',retries:30}},
 auth:{...common,image:'public.ecr.aws/supabase/gotrue:v2.197.0',environment:{GOTRUE_API_HOST:'0.0.0.0',GOTRUE_API_PORT:'9999',API_EXTERNAL_URL:'http://gateway:8000/auth/v1',GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:dburl('supabase_auth_admin'),GOTRUE_SITE_URL:'http://gateway:8000',GOTRUE_JWT_SECRET:secret,GOTRUE_JWT_EXP:'120',GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_JWT_ADMIN_ROLES:'service_role',GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED:'true',GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_MAILER_AUTOCONFIRM:'true',GOTRUE_RATE_LIMIT_ANONYMOUS_USERS:'1000'},depends_on:{db:{condition:'service_healthy'}}},
 rest:{...common,image:'public.ecr.aws/supabase/postgrest:v14.12',environment:{PGRST_DB_URI:dburl('authenticator'),PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret},depends_on:{db:{condition:'service_healthy'}}},
 storage:{...common,image:'public.ecr.aws/supabase/storage-api:v1.84.19',environment:{ANON_KEY:anon,SERVICE_KEY:service,POSTGREST_URL:'http://rest:3000',AUTH_JWT_SECRET:secret,DATABASE_URL:dburl('supabase_storage_admin'),FILE_SIZE_LIMIT:'50000000',STORAGE_BACKEND:'file',FILE_STORAGE_BACKEND_PATH:'/var/lib/storage',TENANT_ID:project,REGION:'local',GLOBAL_S3_BUCKET:'local',ENABLE_IMAGE_TRANSFORMATION:'false'},volumes:['objects:/var/lib/storage'],depends_on:{db:{condition:'service_healthy'}}},
 gateway:{...app,command:['node','/lab/gateway.mjs']},
 runner:{...app,command:['sleep','infinity']}
 },networks:{isolated:{internal:true,name:`${project}-internal`}},volumes:{dbdata:{name:`${project}-db`},objects:{name:`${project}-objects`}}};
writeFileSync(resolve(runtime,'compose.json'),JSON.stringify(compose,null,2));
mkdirSync(resolve(runtime,'old'),{recursive:true});
execFileSync('git',['archive','--format=tar','--output='+resolve(runtime,'legacy.tar'),'8776ddf4d3658b1d5ecf8d91a5e13760047d8f50','backend/src'],{cwd:root});
execFileSync('tar',['-xf',resolve(runtime,'legacy.tar'),'-C',resolve(runtime,'old')]);
console.log('Prepared unique lab; synthetic credentials remain in ignored runtime only.');
