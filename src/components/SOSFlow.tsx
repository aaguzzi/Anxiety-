import { useState } from 'react';
import { PhysiologicalSigh } from './exercises/BreathingExercise';
import { Settings } from '../types';
import CrisisLines from './CrisisLines';

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
  onFinish: () => void;
}

export default function SOSFlow({ settings, onClose, onFinish }: Props) {
  const [step, setStep] = useState<Step>('breathe');
  const [groundIdx, setGroundIdx] = useState(0);
  const hasContact = settings.contactPhone.trim().length > 0;

  function restart() {
    setGroundIdx(0);
    setStep('breathe');
  }

  return (
    <div className="exercise-overlay sos-overlay">
      <div className="exercise-overlay-inner">
        <div className="exercise-top-bar">
          <button className="back-btn" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
          <span className="exercise-cat-label" style={{ color: 'var(--cat-acceptance)' }}>SOS</span>
          <div className="sos-top-actions">
            {(step === 'breathe' || step === 'ground' || step === 'accept') && (
              <button
                className="btn btn-ghost sos-skip"
                onClick={() => setStep(step === 'breathe' ? 'ground' : step === 'ground' ? 'accept' : 'after')}
              >
                Skip
              </button>
            )}
            {step !== 'support' && (
              <button className="btn sos-help-btn" onClick={() => setStep('support')}>Get help</button>
            )}
          </div>
        </div>

        <div className="exercise-scroll">
          {step === 'breathe' && (
            <>
              <div className="sos-heading">This feeling will pass.</div>
              <p className="sos-sub">Breathe with the circle. Two breaths in through your nose, one long breath out.</p>
              <p className="sos-caveat">If you have new chest pain, trouble breathing, or you're not safe where you are, call 911.</p>
              <PhysiologicalSigh onComplete={() => setStep('ground')} autoStart reps={3} />
            </>
          )}

          {step === 'ground' && (
            <div className="sos-center">
              <div className="sos-step-num">{GROUND_PROMPTS[groundIdx].n}</div>
              <div key={groundIdx} className="meditation-text">{GROUND_PROMPTS[groundIdx].text}</div>
              <button
                className="btn btn-primary w-full mt-8"
                style={{ backgroundColor: 'var(--cat-grounding)' }}
                onClick={() => {
                  if (groundIdx < GROUND_PROMPTS.length - 1) setGroundIdx(i => i + 1);
                  else setStep('accept');
                }}
              >
                Next
              </button>
            </div>
          )}

          {step === 'accept' && (
            <div>
              <div className="sos-heading">Make room for it</div>
              <div className="sos-lines">
                {ACCEPT_LINES.map(line => <p key={line} className="sos-line">{line}</p>)}
              </div>
              <button
                className="btn btn-primary w-full mt-6"
                style={{ backgroundColor: 'var(--cat-acceptance)' }}
                onClick={() => setStep('after')}
              >
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
              <button className="btn btn-primary mt-6" onClick={onFinish}>Done</button>
            </div>
          )}

          {step === 'support' && (
            <div>
              <div className="sos-heading">You don't have to do this alone</div>
              <p className="sos-sub">Reaching out is a strong, values-based step.</p>
              <div className="support-list">
                {hasContact && (
                  <a className="support-btn" href={`tel:${settings.contactPhone.replace(/[^\d+]/g, '')}`}>
                    <span className="support-title">Call {settings.contactName.trim() || 'my trusted contact'}</span>
                    <span className="support-detail">{settings.contactPhone}</span>
                  </a>
                )}
              </div>
              <div className="mt-4"><CrisisLines /></div>
              {!hasContact && (
                <p className="caption-text mt-4">Tip: add a trusted contact in Settings so they're one tap away here.</p>
              )}
              <button className="btn btn-secondary w-full mt-6" onClick={restart}>Breathe again</button>
            </div>
          )}

          {step !== 'support' && (
            <a className="btn btn-outline w-full sos-footer-btn" href="tel:988">Talk to someone now · Call 988</a>
          )}
        </div>
      </div>
    </div>
  );
}
