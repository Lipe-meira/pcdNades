/** Bounds SDK Storage calls that do not expose an abortSignal fluent method. */
export const serviceFetch:typeof fetch=(input,init)=>fetch(input,{...init,signal:AbortSignal.any([...(init?.signal?[init.signal]:[]),AbortSignal.timeout(10000)])});
