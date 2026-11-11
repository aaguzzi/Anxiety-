import Anthropic from '@anthropic-ai/sdk';
import { Meditation, MeditationSegment } from '../types';

const MODEL = 'claude-opus-5-5';
const WORDS_PER_SECOND = 2;
const DEFAULT_GAP = 1.5;

const SYSTEM = `You write guided meditation scripts for an anxiety self-help app. A text-to-speech voice reads your script aloud to one person, who is listening with their eyes closed.

Approach: mindfulness and acceptance. Help the listener notice what is here, make room for difficult feelings rather than fight them, step back from thoughts, return to the present, and reconnect with what matters to them. Speak warmly and plainly, in the second person. Don't promise that anxiety will go away; the aim is a different relationship with it. Use what the listener told you about their situation so it feels written for them.

Your output is parsed by code, so follow this format exactly:
- Line 1 is "TITLE: " followed by a short title (six words at most).
- After that, each line is one spoken sentence or short phrase, 25 words at most.
- Silence goes on its own line as [pause N], where N is a whole number of seconds from 2 to 30. Put a pause after most lines, with longer ones where the listener is asked to breathe, notice, or stay with something.
- Plain spoken words only: no headings, markdown, emojis, stage directions or parentheses. Write numbers as words and avoid abbreviations, because the voice reads every character literally. Use commas and full stops to shape the pacing.

Timing: the voice speaks about ${WORDS_PER_SECOND} words per second. Spoken time plus pauses should add up to the requested length, with roughly half of it silence. End by gently bringing the listener back to the room.`;

export class ScriptError extends Error {}

export function parseScript(raw: string): { title: string; segments: MeditationSegment[] } {
  let title = 'Custom meditation';
  const segments: MeditationSegment[] = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const titleMatch = trimmed.match(/^TITLE:\s*(.+)$/i);
    if (titleMatch && segments.length === 0) {
      title = titleMatch[1].trim();
      continue;
    }
    // Pauses normally sit on their own line, but tolerate them inline too.
    for (const part of trimmed.split(/(\[pause\s+\d+(?:\.\d+)?\s*\])/i)) {
      const pause = part.match(/^\[pause\s+(\d+(?:\.\d+)?)\s*\]$/i);
      if (pause) {
        const seconds = Math.min(60, Number(pause[1]));
        if (segments.length > 0) {
          const last = segments[segments.length - 1];
          last.pause = last.pause === DEFAULT_GAP ? seconds : last.pause + seconds;
        }
      } else {
        const text = part.replace(/[*_#`]/g, '').trim();
        if (text) segments.push({ text, pause: DEFAULT_GAP });
      }
    }
  }
  return { title, segments };
}

export function estimateSeconds(segments: MeditationSegment[]): number {
  return Math.round(
    segments.reduce((sum, s) => sum + s.text.split(/\s+/).length / WORDS_PER_SECOND + s.pause, 0),
  );
}

export async function generateMeditation(apiKey: string, prompt: string, minutes: number): Promise<Meditation> {
  // The key is the user's own, entered in Settings and kept on this device, so calling from the app is intended.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 120_000 });

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `Length: ${minutes} minutes.\nWhat I'd like this meditation to help with: ${prompt.trim()}`,
      }],
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
    if (error instanceof Anthropic.APIError) {
      throw new ScriptError(`The service returned an error (${error.status ?? 'unknown'}). Try again.`);
    }
    throw error;
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
    minutes,
    createdAt: new Date().toISOString(),
    segments,
  };
}
