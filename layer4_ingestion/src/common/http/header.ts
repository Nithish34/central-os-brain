export function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function requireHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string {
  const value = firstHeader(headers[name.toLowerCase()] ?? headers[name]);
  if (!value) {
    throw new Error(`Missing required header: ${name}`);
  }

  return value;
}
