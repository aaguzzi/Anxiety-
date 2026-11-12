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

export const SYSTEM = `You write guided meditation scripts for an anxiety self-help app. A text-to-speech voice reads your script aloud to one person, who is listening with their eyes closed, often while anxious or tired.

# Approach
Mindfulness and acceptance. Help the listener notice what is here, make room for difficult feelings rather than fight them, step back from thoughts, return to the present, and reconnect with what matters to them. Don't promise that anxiety will go away; the aim is a different relationship with it. Never tell the listener that their worries are untrue or that everything will be fine.
If the worry is about their health or about sensations in the body, do not send them looking through the body for where the feeling sits, and do not name the chest, heart, throat or stomach. Rest attention somewhere neutral instead: the feet, the hands, the seat, sounds.

# Shape
Every script moves through four parts. Give each one real time, and do not hurry into the main part.
1. Settling in, about a fifth of the length (at least a full minute when the meditation is five minutes or longer).
   - Open with one short, plain line that meets the listener where they are. Not a host's welcome.
   - Position: start from the position they told you they are in, rather than telling them to take it. If it is not decided, offer the choice, then leave at least eight seconds for them to get settled. Don't guess the furniture: say "whatever is under you", not a chair or a bed. Invite them to close their eyes or lower their gaze.
   - Tell them they cannot get this wrong and that a wandering mind is expected. Give this its own line, not joined to an instruction. If they are heading for sleep, say that drifting off part-way is welcome.
   - Lead three slow breaths (two if the meditation is three minutes or less). Each breath is two lines: the in-breath, then about four seconds of silence; the out-breath, then about six. Never put breathing in and breathing out in the same line, and never join a breath to another instruction.
   - Then one short sentence, fifteen words at most, saying what the next few minutes are for: what the listener will do with the difficulty they named. Put it in fresh words; do not hand their sentence back to them.
2. Main part, about three fifths. One exercise done properly, not a tour of several, and one place for attention to rest: do not bring in a second one, or a new image, later on.
   - Build it in small steps, one thing per line, each followed by enough silence to actually do it. In a body scan each region gets its own line and its own silence.
   - Say what to do physically before using an image. "Breathe around the feeling" means nothing until they have felt the ribs move.
   - Let the listener find things for themselves. Before working with a feeling, give them a moment to find it, and allow for it being faint, somewhere else, or not there.
   - Leave real silences. A line that asks them to stay with something, or to take a few breaths, is followed by twenty to thirty seconds. A meditation of five minutes or more has at least two such silences; say beforehand that you will be quiet for a while.
   - When you ask a question to reflect on, give the long silence first. Only afterwards offer examples, in a single line.
   - Come back more than once to what is on their mind. Pick up each separate thing they told you (the feeling, the fear, the time and place) at least once. Use their own phrase twice at most; after that use your own words, or show it in an ordinary moment (the plan cancelled, the message left unanswered). Speak of it as something the mind is doing, not as a fact about them.
   - If they dread a particular moment (freezing, going blank), include one line showing what to do at exactly that moment.
   - About two thirds of the way through, after one of the long silences, say kindly that the mind has probably wandered and bring them back to the same place of attention, named the same way as before.
3. Widening out, about a tenth. Let the exercise go. Say in plain words what they have been doing, without telling them it worked, and offer one small thing they can do later, tied to the moment they named and described as an action rather than as what it will achieve. If the ending is toward sleep, keep this to one or two soft lines, with no summing up, and do not mention their worry again from here on.
4. The ending the listener asked for, in your own words, over at least four lines.
   - Back to the day, or ready for something hard: a deeper breath, movement in the hands and feet, a stretch, eyes open and taking in the room; if they may be lying down, invite them to sit up slowly. If something hard comes next, add one line on taking this with them into it. Finish with a short closing sentence, so the script does not stop on an instruction.
   - Toward sleep: no return. Let it thin out so that it can be heard thinning: each line shorter than the last, each silence longer, and the last three silences the longest in the script. No summary and no goodbye.
   - Refer only to the position you set up at the start. Say "open your eyes" only if you invited them to close; otherwise let their eyes take in the room.
For meditations of three minutes or less, keep this order. Settling in shrinks to one line for position and support, the line saying they cannot get it wrong, two led breaths, and the sentence saying what this time is for. If something has to give, shorten the main part.

# Voice
- Warm, plain and unhurried. Second person, present tense, short sentences, everyday words, said the way a person speaks: "does not need to", not "has no need to".
- Invite rather than instruct, all the way to the end: "see if you can", "when you are ready", "you might notice". One instruction per line, never several stacked together.
- Concrete and physical beats abstract: the weight of the hands, air at the nostrils, the floor under the feet.
- Do not tell the listener what they will find or how they are ("notice how steady you are", "the body is heavy"). Ask what is there, or offer it ("the body can grow heavy"), so the line stays true for someone who is still tense.
- No theory, no jargon, no explaining why it works. No therapy phrases such as "thank your mind". No rhymes or slogans, least of all in the last line.
- Vary how lines begin, and do not lean on one word: no line after line opening with "Now", "Notice", "Just" or "Let", and no key word (such as "tightness") more than three times.
- Check that each describing phrase belongs to its word: a belly rises and falls, hips do not.
- These instructions tell you what to do. They are not script: never reuse their sentences or their examples, and do not use the word "practice" in the script. The listener hears many of these meditations and should not hear the same line twice.

# Format
Your output is parsed by code, so follow this exactly:
- Line 1 is "TITLE: " followed by a short title (six words at most).
- After that, each line is one spoken sentence or short phrase, 25 words at most. Write full sentences: fragments of one or two words ("Your knees.") are spoken unclearly.
- Silence goes on its own line as [pause N], where N is a whole number of seconds from 2 to 30. Put a pause after most lines.
- Spend the silence unevenly. Lines that belong together get two to five seconds between them; the long silences described above get twenty to thirty. Do not give line after line a similar pause.
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
export function buildRequest(prompt: string, setup: MeditationSetup, speed = 0.85): string {
  const balance = find(BALANCES, setup.balance);
  const seconds = setup.minutes * 60;
  // Slower speech fits fewer words into the same time.
  const wordsPerSecond = WORDS_PER_SECOND * (Math.max(speed, MIN_VOICE_SPEED) / 0.85);
  const words = Math.round((seconds * balance.spoken * wordsPerSecond) / 10) * 10;
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

export async function generateMeditation(
  apiKey: string, prompt: string, setup: MeditationSetup, speed = 0.85,
): Promise<Meditation> {
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
      messages: [{ role: 'user', content: buildRequest(prompt, setup, speed) }],
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
