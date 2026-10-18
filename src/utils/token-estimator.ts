/**
 * Zero-dependency synchronous token estimator tuned for code, identifiers, and punctuation.
 * Heuristic: ~3.6 chars/token base + 0.15 per punctuation mark for code.
 * Falls back to 4 chars/token for uniform continuous strings.
 */
export function estimateCodeTokens(text: string): number {
  if (!text || text.length === 0) return 0;
  const charCount = text.length;
  const punctuationMatches = text.match(/[{}()[\]<>:;,.\-+=!&|~`'"$*%/\\?]/g);
  const punctuationCount = punctuationMatches ? punctuationMatches.length : 0;
  return Math.ceil(charCount / 3.6 + 0.15 * punctuationCount);
}

export function estimateTokens(text: string): number {
  if (!text || text.length === 0) return 0;

  // If plain continuous alphanumeric token without punctuation or whitespace
  if (/^[a-zA-Z0-9]+$/.test(text)) {
    return Math.ceil(text.length / 4);
  }

  return estimateCodeTokens(text);
}
