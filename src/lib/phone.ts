// What the trusted-contact field holds is whatever the person typed: '+1 (416) 555-0199 ext. 2041',
// '+44 (0)20 7946 0958', '0412 345 678 (mobile), 02 9876 5432'. Joining every digit of that makes a
// number nobody has, so the first number is taken on its own, and an extension is sent after a
// pause, the way the phone's own dialer writes it (',').

export interface Dial {
  /** Digits to dial, with a leading '+' if the number was written with one. '' if there are none. */
  number: string;
  /** Extension to send once the call connects, or ''. */
  ext: string;
}

const digits = (s: string) => s.replace(/\D/g, '').length;

export function parseDial(raw: string): Dial {
  // '(0)' after an international prefix is the trunk 0, which is left out when the country code is
  // dialled. Only the bracketed form: a plain 0 after +39 (Italy) is part of the number.
  const s = raw.replace(/^(\s*(?:\+|00)\s*\d{1,3})[\s.-]*\(0\)/, '$1 ');
  const start = s.search(/[+\d]/);
  if (start < 0) return { number: '', ext: '' };

  // The number runs through digits and the punctuation people write in numbers. A letter, ',', ';'
  // or '#' ends it; so does '/' once there is a whole number before it ('030/1234567' is one number).
  let number = s[start] === '+' ? '+' : '';
  let i = s[start] === '+' ? start + 1 : start;
  for (; i < s.length; i++) {
    const c = s[i];
    if (c >= '0' && c <= '9') number += c;
    else if (c === '/' && digits(number) >= 7) break;
    else if (!/[\s().\-/]/.test(c)) break;
  }

  // What follows may be an extension: 'ext. 2041', 'x123', 'poste 12', '#2041', or ',2041' / ';2041'
  // (the dialer's own pause and wait). After ',' or ';', seven digits or more are a second number.
  const m = s.slice(i).match(/^\s*(ext\.?|extension|poste|x|#|p\.?|[,;]+)\s*:?\s*(\d[\d\s.-]*\d|\d)?/i);
  let ext = '';
  if (m && m[2]) {
    const d = m[2].replace(/\D/g, '');
    if (!/^[,;]/.test(m[1]) || d.length < 7) ext = d;
  }
  return { number, ext };
}

/** The tel: link that dials the contact, with ',' (a pause) before the extension. */
export function telHref(raw: string): string {
  const { number, ext } = parseDial(raw);
  return `tel:${number}${ext ? ',' + ext : ''}`;
}

/** True when the field holds something that can be dialled. */
export function canDial(raw: string): boolean {
  return digits(parseDial(raw).number) >= 3;
}

/** The number as the person can check it: North American numbers grouped, others as dialled. */
export function showDial(raw: string): string {
  const { number, ext } = parseDial(raw);
  const na = number.match(/^(\+?1)?([2-9]\d\d)([2-9]\d\d)(\d{4})$/);
  const shown = na ? [na[1], na[2], na[3], na[4]].filter(Boolean).join(' ') : number;
  return ext ? `${shown}, then extension ${ext}` : shown;
}
