import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import React from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Highlights matching keywords in text using whole-word matching
 * Returns JSX elements with highlighted keywords
 */
export function highlightKeywords(text: string, keywords: string[]): React.ReactNode {
  if (!text || keywords.length === 0) {
    return text;
  }

  // Sort keywords by length (longest first) to avoid partial replacements
  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);

  // Create regex pattern for whole-word matching
  // Includes plurals and singulars
  const patterns = sortedKeywords.flatMap(kw => {
    const kwLower = kw.toLowerCase();
    const singular = kwLower.replace(/s$/, '');
    const plural = kwLower + 's';
    
    // Create word boundaries - match as whole words only
    return [
      new RegExp(`\\b${escapeRegex(kwLower)}\\b`, 'gi'),
      ...(singular !== kwLower ? [new RegExp(`\\b${escapeRegex(singular)}\\b`, 'gi')] : []),
      ...(plural !== kwLower ? [new RegExp(`\\b${escapeRegex(plural)}\\b`, 'gi')] : [])
    ];
  });

  let lastIndex = 0;
  const parts: React.ReactNode[] = [];

  // Find all matches
  const matches: Array<{ start: number; end: number; keyword: string }> = [];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Check if this position overlaps with existing matches
      const isOverlap = matches.some(m => 
        (match.index >= m.start && match.index < m.end) ||
        (match.index + match[0].length > m.start && match.index + match[0].length <= m.end)
      );
      
      if (!isOverlap) {
        matches.push({ start: match.index, end: match.index + match[0].length, keyword: match[0] });
      }
    }
  }

  // Sort matches by position
  matches.sort((a, b) => a.start - b.start);

  // Build the result
  let key = 0;
  for (const match of matches) {
    // Add text before match
    if (lastIndex < match.start) {
      parts.push(text.substring(lastIndex, match.start));
    }
    
    // Add highlighted match
    parts.push(
      React.createElement('span', {
        key: `highlight-${key++}`,
        className: 'bg-yellow-200 font-semibold text-gray-900 px-0.5 rounded'
      }, text.substring(match.start, match.end))
    );
    
    lastIndex = match.end;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
