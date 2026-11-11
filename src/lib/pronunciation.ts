// The on-device voices read each word one way regardless of meaning, so words like "close"
// (shut / near) come out wrong. Before text is spoken, the wrongly-read sense is respelled with a
// spelling the voices pronounce correctly. Captions keep the original text.

/** Bump when rules change so previously generated speech is regenerated. */
export const PRONUNCIATION_VERSION = 2;

// "close" is the adjective (near) in these contexts; everywhere else in a meditation it is the verb.
const CLOSE_ADJ_BEFORE = /\b(so|very|too|quite|really|as|how|this|that|a|stay|stays|staying|come|comes|keep|keeps|kept|hold|holds|held|feel|feels|draw|draws|up|remain|remains)\s+$/i;
const CLOSE_ADJ_AFTER = /^\s+(to|by|enough|together|at\s+hand|friends?|attention|range|contact)\b/i;

// "lives" is the noun (our lives) after these words; otherwise the verb (it lives here).
const LIVES_NOUN_BEFORE = /\b(our|your|their|my|his|her|of|the|daily|whole|own|everyday|inner|busy)\s+$/i;

function matchCase(original: string, replacement: string): string {
  return original[0] === original[0].toUpperCase()
    ? replacement[0].toUpperCase() + replacement.slice(1)
    : replacement;
}

export function spokenText(text: string): string {
  return text
    .replace(/\bclose\b/gi, (word, offset: number) => {
      const adjective = CLOSE_ADJ_BEFORE.test(text.slice(0, offset)) || CLOSE_ADJ_AFTER.test(text.slice(offset + word.length));
      return adjective ? word : matchCase(word, 'cloze');
    })
    .replace(/\blives\b/gi, (word, offset: number) =>
      LIVES_NOUN_BEFORE.test(text.slice(0, offset)) ? word : matchCase(word, 'livs'))
    .replace(/\blive\b/gi, word => matchCase(word, 'liv'))
    .replace(/\bwind(?=\s+(down|up)\b)/gi, word => matchCase(word, 'wined'));
}
