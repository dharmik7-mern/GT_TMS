function scrub(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(scrub);

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    // block MongoDB operator injection + dotted path injection
    if (k.startsWith('$') || k.includes('.')) continue;
    out[k] = scrub(v);
  }
  return out;
}

export function sanitizeMongoBodyParams(req, _res, next) {
  // #region agent log
  fetch('http://127.0.0.1:7356/ingest/f2bbb2a3-c016-48c5-8c3f-7d86788fca17',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1d61fd'},body:JSON.stringify({sessionId:'1d61fd',runId:'pre-fix',hypothesisId:'H5',location:'server/src/middleware/sanitize.middleware.js:18',message:'sanitize_middleware_ran',data:{hasQuerySetter:!!Object.getOwnPropertyDescriptor(Object.getPrototypeOf(req),'query')?.set,method:req.method,path:req.originalUrl},timestamp:Date.now()})}).catch(()=>{});
  // #endregion agent log

  req.body = scrub(req.body);
  req.params = scrub(req.params);
  // Important: do NOT reassign req.query in Express 5 (read-only)
  next();
}

