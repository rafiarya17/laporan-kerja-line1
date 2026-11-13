(function (root) {
  'use strict';
  // Keep cancellation on older tablets without AbortSignal.timeout/any.
  root.andonFetch = async function (url, options, timeoutMs) {
    const controller = new AbortController();
    const upstream = options && options.signal;
    const cancel = function () { controller.abort(); };
    if (upstream) {
      if (upstream.aborted) cancel();
      else upstream.addEventListener('abort', cancel, { once: true });
    }
    const timer = setTimeout(cancel, timeoutMs === undefined ? 80000 : timeoutMs);
    try {
      return await fetch(url, Object.assign({}, options, { signal: controller.signal }));
    } finally {
      clearTimeout(timer);
      if (upstream) upstream.removeEventListener('abort', cancel);
    }
  };
})(window);
