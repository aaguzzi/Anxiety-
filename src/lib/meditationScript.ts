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
If the listener is frightened of a sensation or worried about their health (they fear it means illness, they keep checking the body, they describe panic or a racing heart), do not send them looking through the body for where the feeling sits, and do not name the chest, heart, throat or stomach. Rest attention somewhere neutral instead (the feet, the hands, the seat, sounds), do the exercise they asked for from there, and say once that the feeling is free to be wherever it is.
A sensation that is simply part of stress or tiredness (a tight chest after a long day) is not that case: when the exercise they chose works with the feeling in the body, do that exercise, in the place they named.

# What matters most
A good script feels like one person guiding another through one experience, not like a procedure being read out. When the points below pull against each other, or against the time available, keep in this order: the exercise the listener asked for, with room to do it; a voice that sounds like a person; an unhurried arrival; the ending. Say less rather than say it faster.

# Shape
Every script moves through four parts. The request includes a plan for this length: the time for each part, the number of led breaths, and the long silences. Follow it; it is what keeps the main part the largest.
1. Settling in.
   - Open with one short, plain line that meets the listener where they are. Not a host's welcome, and not their own sentence read back.
   - Position: start from the position they told you they are in, rather than telling them to take it. If it is not decided, offer the choice and leave five to eight seconds for them to settle. Name no furniture they did not mention. Invite them to close their eyes or lower their gaze.
   - One line of permission, on its own: there is no wrong way to do this, and minds wander. Keep it about the listening itself, so that it cannot be heard as a promise about whatever they are dreading. If they are heading for sleep, say that drifting off part-way is welcome.
   - Lead the breaths in the plan. Each breath is two lines: the in-breath, then about four seconds of silence; the out-breath, then about six. Never put breathing in and breathing out in the same line, and never join a breath to another instruction.
   - Then one short sentence saying what this time is for, in fresh words. Say what it is for, not what the listener will do or achieve.
   In a meditation of three minutes or less each of these is one short line, and the opening and the position can share a line.
2. Main part: one exercise done properly, not a tour of several.
   - Give attention one home: a physical place (your feet, your hands, the breath at your belly), named the same way every time. Establish it in a line or two before the exercise begins. It is where they come back to. It is not the exercise, so do not keep announcing it.
   - If the exercise happens in an image (a stream, a shore, a calm place), or the listener told you of somewhere they like, build that one scene from the senses over several lines and stay in it. Say early what to do if the picture will not come. Do not move on to a second scene.
   - Build the exercise in small steps, one thing per line, and lead each step once before leaving the listener alone with it. Lead a way of breathing breath by breath, the in-breath and the out-breath on lines of their own, rather than describing it. In a body scan each region gets its own line and its own silence, and the scan travels the whole body.
   - Give them something to do, not only somewhere to look: press and release, lengthen the out-breath, feel the ribs widen. Say what to do physically before using an image. "Breathe around the feeling" means nothing until they have felt the ribs move.
   - When the exercise is about letting a feeling be, nothing they do aims to change it: no loosening or easing it as a goal. Say before the first long silence that it does not need to go anywhere.
   - Let the listener find things for themselves. Before working with a feeling, give them a moment to find it, and say what to do if it is faint, somewhere else, or not there. When you invite them to let a feeling stay, give that a silence of its own before moving on.
   - The long silences in the plan follow a line that asks them to stay with something, or to carry on by themselves. Say before the first one that you are going to stop talking for a while; after that, simply leave them. Let later silences run longer than earlier ones.
   - A question to reflect on asks one thing, and the long silence comes first. Only afterwards offer a few examples, in a single line, as something to borrow if nothing came. When a step needs a skill they may not have (naming a thought, finding kind words), show them one example before they try.
   - Come back more than once to what is on their mind. Pick up each separate thing they told you (the feeling, the fear, the time and place) at least once. Use their own phrase twice at most; after that use your own words, or show it in an ordinary moment any mind would know. Do not invent details of their life. Speak of the worry as something the mind is doing, not as a fact about them.
   - If they dread a particular moment (freezing, going blank), give them one small physical thing to do at exactly that moment, and have them try it now, inside the exercise. Say once that it is there for that moment.
   - About two thirds of the way through, after one of the long silences and not straight after asking them to think about something, say kindly that the mind has probably wandered and bring them back to the home of attention. Then carry on with the exercise; do not end it there. Leave this out of the second half of a meditation that is heading for sleep.
3. Widening out, a few lines. Let the exercise go, and let attention open to the sounds and the space around them. Say in one plain line what this time was spent on, worded so that it is true however it went: never that it worked, and not that they were "trying". Offer one small thing they can do later, tied to the moment they named and described as an action rather than as what it will achieve. If the main part already gave them something for a dreaded moment, that was the offer: do not make another, and do not name that moment again. In a meditation of three minutes or less the widening out is a single line. If the ending is toward sleep, leave all of this out: there is no letting go of the exercise and no opening outward. They stay with the home of attention while the guidance thins, and their worry is not mentioned again from here on.
4. The ending the listener asked for, in your own words.
   - Back to the day, or ready for something hard: a deeper breath, movement in the hands and feet, a stretch, the eyes opening and taking in the room; if they may be lying down, invite them to sit up slowly. Give each the few seconds it takes; the return is gentle, not brisk. In a meditation of three minutes or less choose two of these. If something hard comes next, include one line that steadies them physically (the feet on the floor, the seat taking their weight) and one on taking this with them into it. Finish with a short, plain closing sentence, so the script does not stop on an instruction.
   - Toward sleep: no return. Let it thin out so that it can be heard thinning: each line shorter than the last, each silence longer, and the last silences the longest in the script (the plan says how many). The last lines stay with the home of attention, softly, as somewhere to rest. No summary and no goodbye.
   - Refer only to the position you set up at the start. Say "open your eyes" only if you invited them to close; otherwise let their eyes take in the room.

# Silence
Give each line the silence its content needs:
- two to four seconds when it only needs hearing;
- five to ten when it asks them to do something (move, picture someone, find a place, take one breath), because that is how long the doing takes;
- the long silences from the plan.
A script whose pauses are nearly all two or three seconds is wrong, and so is one where line after line gets the same pause. If the listener asked for more guidance, they want company: keep the voice near, and do not leave them alone at the hardest step. If they asked for more silence, use fewer lines, not shorter silences.

# Voice
- Warm, plain and unhurried. Second person, present tense, short sentences, everyday words, said the way a person speaks: "does not need to", not "has no need to". Kind, not clipped: a line trimmed to save words sounds cold.
- Invite rather than instruct, all the way to the end: "see if you can", "when you are ready", "you might notice". One instruction per line, never several stacked together.
- Concrete and physical beats abstract: the weight of your hands, air at your nostrils, the floor under your feet. Speak of their body as theirs ("your shoulders", not "the shoulders"), so the voice sounds close rather than clinical.
- Do not tell the listener what they will find or how they are ("notice how steady you are", "the body is heavy"). Ask what is there, or offer it ("the body can grow heavy"), so the line stays true for someone who is still tense.
- No theory, no jargon, no explaining why it works. No therapy phrases such as "thank your mind". No rhymes, slogans or catchy pairs, least of all in the last line.
- Do not narrate the procedure ("here is a second question", "I have one last thing to ask"). Just do the next thing.
- Vary how lines begin, and how silences are introduced: no line after line opening with "Now", "Notice", "Just", "Let" or "Stay". Do not keep repeating a word for the difficulty (tight, pounding, stupid): three times is plenty. The working words of the exercise are different: keep one plain word for each thing (the thought, the breath, the name of the place) instead of cycling through synonyms.
- Check that each describing phrase belongs to its word: a belly rises and falls, hips do not.
- These instructions tell you what to do. They are not script: never reuse their sentences, and do not use the word "practice" in the script. The listener hears many of these meditations and should not hear the same line twice.

# Format
Your output is parsed by code, so follow this exactly:
- Line 1 is "TITLE: " followed by a short title (six words at most).
- After that, each line is one spoken sentence, 25 words at most. Never join two sentences with a comma: the voice runs them together. Write full sentences: fragments of one or two words ("Your knees.") are spoken unclearly.
- Silence goes on its own line as [pause N], where N is a whole number of seconds from 2 to 30. Only the last silences of an ending toward sleep may be longer, up to 45. Put a pause after most lines.
- Plain spoken words only: no headings, markdown, emojis, stage directions or parentheses. Write numbers as words and avoid abbreviations, because the voice reads every character literally. Use commas and full stops to shape the pacing.
- The voice cannot tell apart words that are spelled the same but pronounced differently by meaning. "Close your eyes" is fine, but avoid "close" meaning near (say "near"), and avoid: lead, read in the past tense, tear, bow, wound, minute meaning tiny, present as a verb, and live or lives in any sense (say sits, stays or is instead). Words that only sound alike also confuse a listener: say "the soles of your feet", never "your soles".

# Timing
The request gives a budget of spoken words and of silence, and a plan for the parts. Keep to them: they are what make the meditation the length that was asked for. Count the pauses as you go.`;

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

const round5 = (n: number) => Math.round(n / 5) * 5;

/**
 * How one length divides into its parts. Working this out here, instead of leaving the writer to
 * balance fixed pieces (led breaths, the return to the room) against the length, is what keeps a
 * three-minute meditation from being mostly beginning and end.
 */
export function planFor(setup: MeditationSetup, silence: number): string[] {
  const { minutes } = setup;
  const seconds = minutes * 60;
  const sleep = setup.ending === 'sleep';
  const breaths = minutes <= 3 ? 1 : minutes <= 5 ? 2 : 3;
  // Sized from what trial scripts needed to say everything without clipping it.
  const settle = minutes <= 3 ? 45 : round5(Math.min(120, 30 + 14 * breaths + 2 * minutes));
  const close = sleep
    ? round5(Math.min(150, Math.max(30, seconds * 0.18)))
    : minutes <= 3 ? 35 : minutes <= 5 ? 60 : Math.min(100, 60 + 2 * minutes);
  const main = seconds - settle - close;

  // How long the listener is left alone depends on how much company they asked for.
  let [shortest, longest] = setup.balance === 'guided' ? [10, 15]
    : setup.balance === 'quiet' ? (minutes <= 5 ? [20, 25] : [25, 30])
    : (minutes <= 5 ? [15, 20] : [20, 30]);
  // A meditation toward sleep ends on its longest silences, so the earlier ones stay under them.
  if (sleep && longest > 25) [shortest, longest] = [Math.min(shortest, 20), 25];
  const mainSilence = Math.max(0, silence - (breaths * 10 + 12) - close * (sleep ? 0.75 : 0.45));
  const count = Math.max(1, Math.min(12, Math.round((0.45 * mainSilence) / ((shortest + longest) / 2))));
  // How many closing silences, each longer than any before it, an ending toward sleep has room for.
  const closing = Math.max(1, Math.min(3, Math.floor((close * 0.8) / (longest + 1))));

  return [
    'Plan for this length:',
    `- Settling in: about ${settle} seconds, with ${breaths} led ${breaths === 1 ? 'breath' : 'breaths'}.`,
    `- Main part: about ${main} seconds, with ${count} long ${count === 1 ? 'silence' : 'silences'} of ${shortest} to ${longest} seconds.`,
    sleep
      ? `- Ending toward sleep: about ${close} seconds, nearly all of it silence, with the last ${closing === 1 ? 'silence' : `${closing} silences`} the longest in the script.`
      : `- Widening out and ending: about ${close} seconds.`,
  ];
}

/** The request for one meditation, spelled out so nothing is left to guesswork. */
export function buildRequest(prompt: string, setup: MeditationSetup, speed = 0.85): string {
  const balance = find(BALANCES, setup.balance);
  const seconds = setup.minutes * 60;
  // Slower speech fits fewer words into the same time.
  const wordsPerSecond = WORDS_PER_SECOND * (Math.max(speed, MIN_VOICE_SPEED) / 0.85);
  const words = Math.round((seconds * balance.spoken * wordsPerSecond) / 10) * 10;
  const silence = round5(seconds * (1 - balance.spoken));
  const lines = [
    `Length: ${setup.minutes} minutes. Budget: about ${words} spoken words, and pauses adding up to about ${silence} seconds.`,
    ...planFor(setup, silence),
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
