// Use only in the disposable preview build command, never in production builds.
if(process.env.VERCEL_ENV!=='preview'){
 console.error('PCDNADES_PREVIEW_ONLY: refusing build outside the Preview environment.');
 process.exit(42);
}
console.log('PCDNADES_PREVIEW_ONLY: Preview environment confirmed.');
