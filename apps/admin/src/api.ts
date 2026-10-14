let csrf = '';
export const csrfToken = () => csrf;
export async function api<T = unknown>(
  path: string,
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST',
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    headers: {
      ...(body !== undefined
        ? { 'Content-Type': 'application/json', 'X-Gallery-CSRF': csrf }
        : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error ?? '请求失败');
  return result;
}
export async function initSession() {
  csrf = (await api<{ csrf: string }>('session')).csrf;
}
