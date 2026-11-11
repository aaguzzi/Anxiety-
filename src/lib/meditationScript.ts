import Anthropic from '@anthropic-ai/sdk';
import { Meditation, MeditationSegment, MeditationSetup } from '../types';

const MODEL = 'claude-opus-5-5';
const WORDS_PER_SECOND = 2;
const DEFAULT_GAP = 1.5;

/** The practices a custom meditation can be built around. */
export const PRACTICES = [
  { id: 'auto', label: 'Choose for me', brief: 'Choose the one practice that best fits what I described.' },
  { id: 'breath', label: 'Breathing', brief: 'Slow, steady breathing with a longer out-breath, used as an anchor to keep returning to.' },
  { id: 'body', label: 'Body scan', brief: 'A slow body scan: moving attention through the body and softening around tension without forcing it.' },
  { id: 'thoughts', label: 'Stepping back from thoughts', brief: 'Noticing thoughts as thoughts, naming them and letting them pass (for example as leaves on a stream), without arguing with them.' },
  { id: 'feelings', label: 'Making room for feelings', brief: 'Finding where the feeling sits in the body, breathing around it, and letting it be there without fighting it.' },
  { id: 'kindness', label: 'Self-kindness', brief: 'Speaking to myself the way I would to a friend who is struggling.' },
  { id: 'values', label: 'What matters to me', brief: 'Reconnecting with what I care about in this situation, the kind of person I want to be in it, and one small step toward that.' },
  { id: 'senses', label: 'Grounding in the senses', brief: 'Coming back to the present through sounds, touch, and the contact of my body with what is under it.' },
  { id: 'place', label: 'A calm place', brief: 'Gentle imagery of a calm, safe place, built up from the senses, as somewhere to rest attention.' },
] as const;

export const LENGTHS = [3, 5, 10, 15, 20];

export const BALANCES = [
  { id: 'guided', label: 'More guidance', spoken: 0.62, brief: 'More guidance than silence: keep me company, with shorter pauses.' },
  { id: 'balanced', label: 'Balanced', spoken: 0.5, brief: 'About half speech and half silence.' },
  { id: 'quiet', label: 'More silence', spoken: 0.36, brief: 'Fewer words and long silences: say what is needed, then leave me room.' },
] as const;

export const POSITIONS = [
  { id: 'any', label: 'Any', brief: 'Not decided: offer sitting or lying down, whichever is comfortable.' },
  { id: 'sitting', label: 'Sitting', brief: 'Sitting upright in a chair.' },
  { id: 'lying', label: 'Lying down', brief: 'Lying down.' },
] as const;

export const ENDINGS = [
  { id: 'day', label: 'Back to my day', brief: 'Bring me gently back to the room, alert and ready to carry on with the day.' },
  { id: 'sleep', label: 'Toward sleep', brief: 'Do not bring me back. Let the guidance thin out and trail off so I can drift toward sleep, with no instruction to open my eyes or move.' },
  { id: 'action', label: 'Ready for something hard', brief: 'Bring me back steady and ready to face something difficult right afterwards.' },
] as const;

export const DEFAULT_SETUP: MeditationSetup = {
  minutes: 5,
  practice: 'auto',
  balance: 'balanced',
  position: 'any',
  ending: 'day',
  notes: '',
};

const SYSTEM = `You write guided meditation scripts for an anxiety self-help app. A text-to-speech voice reads your script aloud to one person, who is listening with their eyes closed, often while anxious or tired.

# Approach
Mindfulness and acceptance. Help the listener notice what is here, make room for difficult feelings rather than fight them, step back from thoughts, return to the present, and reconnect with what matters to them. Don't promise that anxiety will go away; the aim is a different relationship with it. Never tell the listener that their worries are untrue or that everything will be fine.

# Shape
Every script moves through four parts. Give each one real time, and do not hurry into the main practice.
1. Settling in, about a fifth of the length (at least a full minute when the meditation is five minutes or longer). Greet the listener in one short line. Help them into their position and let them feel held by what is under them. Tell them there is no way to do this wrong: the mind will wander, and coming back is the practice. Lead two or three slow breaths, with silence after each. Then say in one sentence what this time is for, in their own terms.
2. Main practice, about three fifths. One practice done properly, not a tour of several. Build it in small steps, each followed by enough silence to actually do it. Return more than once to what the listener said is on their mind, in their words, and show how the practice meets it. When the mind is likely to have wandered, say so kindly and bring them back.
3. Widening out, about a tenth. Let the practice go. Say in plain words what they just did, and offer one small thing to carry with them.
4. The ending the listener asked for.
For meditations of three minutes or less, keep this order but settle in with two or three lines.

# Voice
- Warm, plain and unhurried. Second person, present tense, short sentences, everyday words.
- Invite rather than instruct: "see if you can", "when you are ready", "you might notice".
- Concrete and physical beats abstract: the weight of the hands, air at the nostrils, the chair holding the back.
- No theory, no jargon, no explaining why it works.
- Vary how lines begin. Do not open line after line with "Now", "Notice" or "Just".
- Use what the listener told you so it feels written for them, without repeating their words back mechanically.

# Format
Your output is parsed by code, so follow this exactly:
- Line 1 is "TITLE: " followed by a short title (six words at most).
- After that, each line is one spoken sentence or short phrase, 25 words at most. Write full sentences: fragments of one or two words ("Your knees.") are spoken unclearly.
- Silence goes on its own line as [pause N], where N is a whole number of seconds from 2 to 30. Put a pause after most lines, with longer ones where the listener is asked to breathe, notice, or stay with something.
- Plain spoken words only: no headings, markdown, emojis, stage directions or parentheses. Write numbers as words and avoid abbreviations, because the voice reads every character literally. Use commas and full stops to shape the pacing.
- The voice cannot tell apart words that are spelled the same but pronounced differently by meaning. "Close your eyes" is fine, but avoid "close" meaning near (say "near"), and avoid: lead, read in the past tense, tear, bow, wound, minute meaning tiny, present as a verb, and live or lives in any sense (say sits, stays or is instead).

# Timing
The request gives a budget of spoken words and of silence. Keep to both: they are what make the meditation the length that was asked for. Count the pauses as you go.`;

export class ScriptError extends Error {}

const PAUSE = /[[(]\s*pause[:\s]*(\d+(?:\.\d+)?)?\s*(?:s|secs?|seconds?)?\.?\s*[\])]/i;
const MAX_PAUSE = 60;

export function parseScript(raw: string): { title: string; segments: MeditationSegment[] } {
  let title = 'Custom meditation';
  const segments: MeditationSegment[] = [];

  for (const line of raw.split('\n')) {
    // Models sometimes decorate lines with markdown despite instructions; the voice would read it aloud.
    const trimmed = line.replace(/[*_#`>]/g, '').trim();
    if (!trimmed) continue;
    const titleMatch = trimmed.match(/^TITLE:\s*(.+)$/i);
    if (titleMatch && segments.length <= 2) {
      // Anything before the title is preamble ("Here is your script:"), not part of the meditation.
      title = titleMatch[1].trim().slice(0, 60);
      segments.length = 0;
      continue;
    }
    for (const part of trimmed.split(new RegExp(`(${PAUSE.source})`, 'i'))) {
      if (part === undefined) continue;
      const pause = part.match(new RegExp(`^${PAUSE.source}$`, 'i'));
      if (pause) {
        const seconds = Number(pause[1] ?? 4);
        if (segments.length > 0) {
          const last = segments[segments.length - 1];
          last.pause = Math.min(MAX_PAUSE, last.pause === DEFAULT_GAP ? seconds : last.pause + seconds);
        }
        continue;
      }
      // Drop any other stage direction in brackets, and lines with nothing to say (e.g. "---").
      const text = part.replace(/\[[^\]]*\]/g, '').trim();
      if (/\p{L}/u.test(text)) segments.push({ text, pause: DEFAULT_GAP });
    }
  }
  return { title, segments };
}

const SENTENCE_GAP = 0.7;

/**
 * One spoken unit per sentence. The voices garble the join when a line holds a very short sentence
 * followed by another ("Welcome. Find a comfortable position…"), so each sentence is spoken alone.
 */
export function splitSentences(segments: MeditationSegment[]): MeditationSegment[] {
  return segments.flatMap(segment => {
    const parts = segment.text
      .split(/(?<!\b(?:Dr|Mr|Ms|Mrs|St|etc|e\.g|i\.e|vs)\.)(?<=[.!?…])\s+(?=["'“]?[A-Z])/)
      .map(p => p.trim())
      .filter(Boolean);
    return parts.map((text, i) => ({ text, pause: i === parts.length - 1 ? segment.pause : SENTENCE_GAP }));
  });
}

const MIN_VOICE_SPEED = 0.75;

/**
 * Rough playing time at the user's settings. The natural voices don't speak slower than
 * MIN_VOICE_SPEED; below that they lengthen the silences instead, and this mirrors that.
 */
export function estimateSeconds(segments: MeditationSegment[], speed = 0.85, pauseScale = 1): number {
  const spoken = Math.max(speed, MIN_VOICE_SPEED);
  const wordsPerSecond = WORDS_PER_SECOND * (spoken / 0.85);
  const silence = pauseScale * (spoken / speed);
  return Math.round(
    segments.reduce((sum, s) => sum + s.text.split(/\s+/).length / wordsPerSecond + s.pause * silence, 0),
  );
}

function find<T extends { id: string }>(options: readonly T[], id: string): T {
  return options.find(o => o.id === id) ?? options[0];
}

/** The request for one meditation, spelled out so nothing is left to guesswork. */
export function buildRequest(prompt: string, setup: MeditationSetup): string {
  const balance = find(BALANCES, setup.balance);
  const seconds = setup.minutes * 60;
  const words = Math.round((seconds * balance.spoken * WORDS_PER_SECOND) / 10) * 10;
  const silence = Math.round((seconds * (1 - balance.spoken)) / 5) * 5;
  const lines = [
    `Length: ${setup.minutes} minutes. Budget: about ${words} spoken words, and pauses adding up to about ${silence} seconds.`,
    `What I'd like this meditation to help with: ${prompt.trim()}`,
    `Practice: ${find(PRACTICES, setup.practice).brief}`,
    `Guidance and silence: ${balance.brief}`,
    `My position: ${find(POSITIONS, setup.position).brief}`,
    `Ending: ${find(ENDINGS, setup.ending).brief}`,
  ];
  if (setup.notes.trim()) lines.push(`Also: ${setup.notes.trim()}`);
  return lines.join('\n');
}

export async function generateMeditation(apiKey: string, prompt: string, setup: MeditationSetup): Promise<Meditation> {
  // The key is the user's own, entered in Settings and kept on this device, so calling from the app is intended.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 180_000 });

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: buildRequest(prompt, setup) }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      throw new ScriptError('Your API key was not accepted. Check it in Settings.');
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new ScriptError('The service is busy or your account is out of credit. Try again in a minute.');
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new ScriptError("Couldn't reach the service. Check your internet connection and try again.");
    }
    if (error instanceof Anthropic.BadRequestError) {
      throw new ScriptError('The service rejected the request. Check that your API account is active and has credit, then try again.');
    }
    if (error instanceof Anthropic.APIError) {
      throw new ScriptError(`The service returned an error (${error.status ?? 'unknown'}). Try again.`);
    }
    throw error;
  }

  if (response.stop_reason === 'max_tokens') {
    throw new ScriptError('The meditation came back incomplete. Try again, or choose a shorter length.');
  }
  if (response.stop_reason === 'refusal') {
    throw new ScriptError("A meditation couldn't be written for that request. Try describing it differently.");
  }

  const raw = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n');
  const { title, segments } = parseScript(raw);
  if (segments.length < 3) {
    throw new ScriptError('The meditation came back empty. Try again.');
  }

  return {
    id: String(Date.now()),
    title,
    prompt: prompt.trim(),
    minutes: setup.minutes,
    createdAt: new Date().toISOString(),
    segments,
  };
}
