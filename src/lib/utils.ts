import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Simple function to merge Tailwind CSS classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
