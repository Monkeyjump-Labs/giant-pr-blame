// Minimal GitHub and Slack API clients. No dependencies: Node's fetch only. `fetch` is
// injectable so the tests can run without a network.

export function createGitHub({
  token,
  apiUrl = 'https://api.github.com',
  fetch = globalThis.fetch,
}) {
  async function request(path, init = {}) {
    const res = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    if (!res.ok) {
      throw new Error(`GitHub ${init.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`);
    }
    return res.status === 204 ? null : res.json();
  }
  return { request };
}

// Slack reports errors in the body ({ ok: false, error }) with a 200, so callers check `ok`.
export function createSlack({ token, apiUrl = 'https://slack.com/api', fetch = globalThis.fetch }) {
  async function get(method, params = {}) {
    const res = await fetch(`${apiUrl}/${method}?${new URLSearchParams(params)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  }
  async function post(method, body) {
    const res = await fetch(`${apiUrl}/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(body),
    });
    return res.json();
  }
  return { get, post };
}
