import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const truncateString = (str: string, maxLength: number): string => {
  return str.length > maxLength ? `${str.slice(0, maxLength)}...` : str;
};

export const formatDateShort = (date: string, locale: string = 'en'): string =>
  new Date(date).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

export const formatDateMedium = (date: string, locale: string = 'en'): string =>
  new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    dateStyle: 'medium',
  }).format(new Date(date));

export const formatDateLong = (dateString: string, locale: string = 'en'): string => {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return new Date(dateString).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', options);
};
