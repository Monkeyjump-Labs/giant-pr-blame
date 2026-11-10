// A fake fetch: routes are "METHOD path-regex" -> handler(url, init) returning a JSON body,
// or a { status, body } object. Every call is recorded.
export function fakeFetch(routes) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const { pathname, search } = new URL(url);
    const target = pathname + search;
    calls.push({ method, target, body: init.body ? JSON.parse(init.body) : undefined });
    for (const [key, handler] of Object.entries(routes)) {
      const [m, re] = key.split(' ');
      if (m === method && new RegExp(re).test(target)) {
        const out = await handler(url, init);
        const { status = 200, body = out } = out?.status ? out : {};
        return new Response(status === 204 ? null : JSON.stringify(body), { status });
      }
    }
    return new Response(`no route for ${method} ${target}`, { status: 404 });
  };
  return { fetch, calls };
}

export const silentLog = () => {
  const lines = [];
  const rec = (level) => (m) => lines.push(`${level}: ${m}`);
  return {
    lines,
    info: rec('info'),
    notice: rec('notice'),
    warning: rec('warning'),
    error: rec('error'),
  };
};

export const inputs = (values) => (name) => values[name] ?? '';
