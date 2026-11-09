import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge conditional class names and resolve conflicting Tailwind utilities.
 *
 * @param {...any} inputs Class values accepted by clsx (strings, arrays, objects, ...)
 * @returns {string} The merged class name string.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
