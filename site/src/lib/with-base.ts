export function joinBase(base: string, path: string): string {
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

export function withBase(path: string): string {
  return joinBase(import.meta.env.BASE_URL, path);
}
