import { useEffect, useRef, useState } from 'react';
import { PhysiologicalSigh } from './exercises/BreathingExercise';
import { Settings } from '../types';
import CrisisLines, { PhoneIcon, SupportLink } from './CrisisLines';
import { canDial, telHref } from '../lib/phone';

type Step = 'breathe' | 'ground' | 'accept' | 'after' | 'support' | 'calmer';

const GROUND_PROMPTS = [
  { n: 5, text: 'Look around. Silently name 5 things you can see.' },
  { n: 4, text: 'Notice 4 things you can feel — your feet, your clothes, the chair.' },
  { n: 3, text: 'Listen for 3 sounds, near or far.' },
  { n: 2, text: 'Find 2 things you can smell, or recall a smell you like.' },
  { n: 1, text: 'Notice 1 taste in your mouth.' },
];

const ACCEPT_LINES = [
  'Name it gently: "This is a wave of anxiety."',
  'It is uncomfortable, and like every wave before it, it will pass.',
  'You don\'t have to push it away. Let it rise and fall, like a wave.',
  'Feel your feet on the floor. You are still here, and so is the ground.',
];

interface Props {
  settings: Settings;
  onClose: () => void;
  /** The person reached 'You rode the wave': counts as a practice, once per visit. */
  onComplete: () => void;
}

export default function SOSFlow({ settings, onClose, onComplete }: Props) {
  const [step, setStep] = useState<Step>('breathe');
  const [groundIdx, setGroundIdx] = useState(0);
  const hasContact = canDial(settings.contactPhone);
  const counted = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Each step (and each grounding prompt) starts at its top, not where the last one was scrolled to.
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [step, groundIdx]);

  useEffect(() => {
    if (step === 'calmer' && !counted.current) {
      counted.current = true;
      onComplete();
    }
  }, [step, onComplete]);

  function restart() {
    setGroundIdx(0);
    setStep('breathe');
  }

  // Skipping is a step forward, so it sits under the step's own content as a quiet text button,
  // away from 'Get help'.
  const skip = (label: string, to: Step) => (
    <button className="btn btn-ghost w-full sos-skip" onClick={() => setStep(to)}>{label}</button>
  );

  return (
    <div className="exercise-overlay sos-overlay">
      <div className="exercise-overlay-inner">
        <div className="exercise-top-bar">
          <button className="back-btn" onClick={onClose} aria-label="Close SOS">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
          <span className="exercise-cat-label sos-label">SOS</span>
          {step !== 'support' && (
            <button className="btn sos-help-btn" onClick={() => setStep('support')}>Get help</button>
          )}
        </div>

        <div className="exercise-scroll" ref={scrollRef}>
          {step === 'breathe' && (
            <>
              <div className="sos-heading">This feeling will pass.</div>
              {/* The circle comes first, so it is on the first screen even with large text; the 911
                  warning comes straight after what to do, ahead of the longer explanation. */}
              <PhysiologicalSigh onComplete={() => setStep('ground')} autoStart reps={3} />
              <p className="sos-caveat">If you have new chest pain, trouble breathing, or you're not safe where you are, call 911.</p>
              <p className="sos-sub mt-2">Breathe with the circle. Two breaths in through your nose, one long breath out.</p>
              {skip('Skip breathing', 'ground')}
            </>
          )}

          {step === 'ground' && (
            <div className="sos-center">
              <div className="sos-step-num">{GROUND_PROMPTS[groundIdx].n}</div>
              <div key={groundIdx} className="meditation-text">{GROUND_PROMPTS[groundIdx].text}</div>
              <button
                className="btn btn-primary w-full mt-6"
                onClick={() => {
                  if (groundIdx < GROUND_PROMPTS.length - 1) setGroundIdx(i => i + 1);
                  else setStep('accept');
                }}
              >
                Next
              </button>
              {skip('Skip grounding', 'accept')}
            </div>
          )}

          {step === 'accept' && (
            <div>
              <div className="sos-heading">Make room for it</div>
              <div className="sos-lines">
                {ACCEPT_LINES.map(line => <p key={line} className="sos-line">{line}</p>)}
              </div>
              <button className="btn btn-primary w-full mt-6" onClick={() => setStep('after')}>
                Continue
              </button>
            </div>
          )}

          {step === 'after' && (
            <div className="sos-center">
              <div className="sos-heading">How are you now?</div>
              <div className="options-stack w-full mt-6">
                <button className="option-btn" onClick={() => setStep('calmer')}>
                  <span className="option-emoji">🌿</span>
                  <span className="option-text">A little calmer</span>
                </button>
                <button className="option-btn" onClick={restart}>
                  <span className="option-emoji">🔁</span>
                  <span className="option-text">About the same — go again</span>
                </button>
                <button className="option-btn" onClick={() => setStep('support')}>
                  <span className="option-emoji">🤝</span>
                  <span className="option-text">I'm still really struggling</span>
                </button>
              </div>
            </div>
          )}

          {step === 'calmer' && (
            <div className="completion-screen">
              <span className="completion-icon">🌊</span>
              <div className="completion-title">You rode the wave.</div>
              <div className="completion-msg">
                You didn't have to make the anxiety disappear — you made room for it, and it moved. That's a skill, and you just practiced it.
              </div>
              <button className="btn btn-primary mt-6" onClick={onClose}>Done</button>
            </div>
          )}

          {step === 'support' && (
            <div>
              <div className="sos-heading">You don't have to do this alone</div>
              <p className="sos-sub">Reaching out is a strong, values-based step.</p>
              {hasContact && (
                <div className="support-list">
                  <SupportLink
                    href={telHref(settings.contactPhone)}
                    title={`Call ${settings.contactName.trim() || 'my trusted contact'}`}
                    detail={settings.contactPhone}
                  />
                </div>
              )}
              <div className="mt-4"><CrisisLines /></div>
              {!hasContact && (
                <p className="caption-text mt-4">Tip: add a trusted contact in Settings so they're one tap away here.</p>
              )}
              <button className="btn btn-secondary w-full mt-6" onClick={restart}>Breathe again</button>
            </div>
          )}
        </div>

        {/* Outside the scrolling area, so a person can always reach someone in one tap. */}
        {step !== 'support' && (
          <div className="sos-footer">
            <a className="btn btn-outline w-full sos-footer-btn" href="tel:988">
              {/* The icon is part of the line, so with large text the words get the button's whole width;
                  when even that would take three lines, the button just says 'Call 988'. */}
              <span><PhoneIcon />Call 988<span className="sos-footer-more"> · talk to someone now</span></span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
