// The on-device voices read each word one way regardless of meaning, so words like "close"
// (shut / near) come out wrong. Before text is spoken, the wrongly-read sense is respelled with a
// spelling the voices pronounce correctly. Captions keep the original text.

// Generated speech is cached under a fingerprint of the respelled text (see voice.ts), so a change
// to these rules is picked up by itself: lines it affects are generated again.

// "close" is the adjective (near) in these contexts; everywhere else in a meditation it is the verb.
const CLOSE_ADJ_BEFORE = /\b(so|very|too|quite|really|as|how|this|that|a|stay|stays|staying|come|comes|keep|keeps|kept|hold|holds|held|feel|feels|draw|draws|up|remain|remains)\s+$/i;
// "Bring it close.", "Hold them close", "You are close.": near, when one of these comes earlier in the clause.
const CLOSE_ADJ_CLAUSE = /\b(bring|brings|hold|holds|keep|keeps|pull|draw|stay|come|is|are|be|was|feels?|you're|it's)\b[^.,;:!?]{0,30}$/i;
const CLOSE_ADJ_AFTER = /^\s+(to|by|enough|together|at\s+hand|friends?|attention|range|contact)\b/i;

// "lives" is the noun (our lives) after these words; otherwise the verb (it lives here).
const LIVES_NOUN_BEFORE = /\b(our|your|their|my|his|her|of|the|daily|whole|own|everyday|inner|busy)\s+$/i;

function matchCase(original: string, replacement: string): string {
  return original[0] === original[0].toUpperCase()
    ? replacement[0].toUpperCase() + replacement.slice(1)
    : replacement;
}

/**
 * @param respellLive The dictionary-based voices read "live" and "lives" as in "live music"; the
 *   studio voices work from spelling and sound worse with the respelling, so they skip it.
 */
export function spokenText(text: string, respellLive = true): string {
  const fixed = text
    .replace(/\bclose\b/gi, (word, offset: number) => {
      const before = text.slice(0, offset);
      const after = text.slice(offset + word.length);
      const adjective = CLOSE_ADJ_BEFORE.test(before) || CLOSE_ADJ_AFTER.test(after)
        || (/^\s*([.,;:!?]|$)/.test(after) && CLOSE_ADJ_CLAUSE.test(before));
      return adjective ? word : matchCase(word, 'cloze');
    })
    .replace(/\bwind(?=\s+(down|up)\b)/gi, word => matchCase(word, 'wined'));
  if (!respellLive) return fixed;
  return fixed
    .replace(/\blives\b/gi, (word, offset: number, whole: string) =>
      LIVES_NOUN_BEFORE.test(whole.slice(0, offset)) ? word : matchCase(word, 'livs'))
    .replace(/\blive\b/gi, word => matchCase(word, 'liv'));
}
