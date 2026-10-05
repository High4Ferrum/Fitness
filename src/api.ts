import type { Data } from './types';
export async function api<T = any>(path: string, method='GET', body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {method, credentials:'same-origin', headers:body ? {'Content-Type':'application/json'} : {}, body:body ? JSON.stringify(body) : undefined});
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Something went wrong. Please try again.');
  return json;
}
export const loadData = () => api<Data>('/bootstrap');
