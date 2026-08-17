import type { Alignment } from './characters';

export type ByAlignment<T> = Record<Alignment, T>;

/** Convenience for content that doesn't differ by alignment yet. */
export function same<T>(value: T): ByAlignment<T> {
  return { hero: value, villain: value };
}
