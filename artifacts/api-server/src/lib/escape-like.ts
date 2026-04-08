export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export function likeContains(value: string): string {
  return `%${escapeLike(value)}%`;
}
