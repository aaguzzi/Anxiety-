import { Meditation } from '../types';

type Line = [text: string, pause: number];

function starter(id: string, title: string, prompt: string, minutes: number, lines: Line[]): Meditation {
  return {
    id,
    title,
    prompt,
    minutes,
    createdAt: '2026-01-01T00:00:00.000Z',
    segments: lines.map(([text, pause]) => ({ text, pause })),
  };
}

export const starterMeditations: Meditation[] = [
  starter('starter-arrive', 'Arriving Here', 'A short reset for any time of day', 3, [
    ['Welcome. Wherever you are, let yourself arrive.', 3],
    ['You can close your eyes, or rest them on one spot in front of you.', 4],
    ['Feel the weight of your body, held by whatever is underneath you.', 6],
    ['Take one slow breath in through your nose.', 4],
    ['And let it out gently, a little longer than you took it in.', 6],
    ['Now let your breath find its own pace. You do not need to manage it.', 8],
    ['Notice where you feel the breath most clearly. Your nose, your chest, or your belly.', 10],
    ['Rest your attention there, the way you might rest a hand on a table.', 12],
    ['Your mind will wander. That is what minds do.', 4],
    ['Each time you notice it has wandered, that noticing is the practice.', 5],
    ['Gently come back to the breath.', 15],
    ['If there is tension or worry here, you do not have to push it away.', 5],
    ['See if you can let it sit beside you, like a passenger, while you keep breathing.', 15],
    ['Take one more slow breath in.', 4],
    ['And a long breath out.', 6],
    ['When you are ready, open your eyes, and carry a little of this steadiness with you.', 2],
  ]),

  starter('starter-anxious', 'Making Room for Anxiety', 'For when anxiety is strong', 4, [
    ['Something difficult is here right now. You noticed it, and you came here. That counts.', 4],
    ['Let your feet rest on the floor, and feel the ground holding them.', 6],
    ['Breathe in slowly through your nose.', 4],
    ['And breathe out through your mouth, as if you were slowly fogging a window.', 7],
    ['Once more. In through the nose.', 4],
    ['And slowly out.', 8],
    ['Now, with some curiosity, find where the anxiety lives in your body.', 6],
    ['It might be your chest, your stomach, your throat, or your shoulders.', 8],
    ['Notice its shape. Notice its edges. Is it tight, or heavy, or buzzing?', 10],
    ['You do not need to fix it or make it leave. Just see it clearly.', 8],
    ['As you breathe in, imagine your breath flowing around the feeling, making a little space.', 10],
    ['As you breathe out, soften the muscles around it, just a little.', 10],
    ['Silently say to yourself: this is a feeling. It is uncomfortable. And I can make room for it.', 12],
    ['Your mind may be telling you stories about what could go wrong.', 4],
    ['Thank your mind. It is trying to protect you. You do not have to follow every story.', 10],
    ['Feel your feet on the floor again. Feel the breath moving in and out.', 10],
    ['The feeling may still be here, and so are you. Both can be true.', 8],
    ['Think of one small thing that matters to you today.', 8],
    ['You can take the feeling with you and still move toward it.', 6],
    ['Take a slow breath in, and a long breath out. Open your eyes when you are ready.', 2],
  ]),

  starter('starter-sleep', 'Letting the Day Go', 'Winding down before sleep', 5, [
    ['The day is done. There is nothing more you need to do right now.', 5],
    ['Lie back, or settle into your chair, and let your body be heavy.', 8],
    ['Take a slow breath in.', 4],
    ['And let it fall out of you, like a sigh.', 8],
    ['Bring your attention to your feet. Let them soften and grow warm.', 12],
    ['Let that softness move up through your legs. Your calves. Your knees. Your thighs.', 15],
    ['Let your hips and your lower back sink into the surface beneath you.', 12],
    ['Notice your belly rising and falling. You do not have to breathe in any special way.', 15],
    ['Let your shoulders drop away from your ears.', 10],
    ['Let your arms be heavy. Let your hands open.', 12],
    ['Soften your jaw. Let your teeth part a little.', 10],
    ['Let the small muscles around your eyes relax. Let your forehead smooth out.', 15],
    ['Thoughts about today, or about tomorrow, may drift in.', 5],
    ['Imagine placing each one on a leaf, and letting a slow stream carry it away.', 15],
    ['You do not need to finish any thought tonight. It will keep until morning.', 12],
    ['If worry returns, that is alright. Notice it, and come back to the feeling of your breath.', 20],
    ['With each breath out, let yourself sink a little deeper.', 20],
    ['There is nothing to solve. Nowhere to be. Only this breath, and then the next.', 25],
    ['You can stay here as long as you like. Let sleep come when it comes.', 5],
  ]),
];
