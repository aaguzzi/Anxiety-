import { createContext, ReactNode, useContext, useId, useLayoutEffect, useRef } from 'react';

/**
 * Reaching the end of an exercise counts it as practised, whatever the person taps next ('Finish',
 * the round button at the top, or the phone's back gesture). ExerciseModal provides this; it counts
 * once per opening.
 */
export const ReachedEndContext = createContext<() => void>(() => {});
export const useReachedEnd = () => useContext(ReachedEndContext);

// The exercise's scroll area, and how far the element's top is below the top of its visible part.
function offsetInScroll(el: HTMLElement | null) {
  const sc = el?.closest<HTMLElement>('.exercise-scroll');
  if (!el || !sc) return null;
  return { sc, below: el.getBoundingClientRect().top - sc.getBoundingClientRect().top };
}

/**
 * An exercise's closing screen. It opens at its own top (the icon and the heading first), not
 * wherever the exercise above it had been scrolled to, and it counts the practice.
 */
export default function CompletionScreen({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reachedEnd = useReachedEnd();
  useLayoutEffect(() => {
    const o = offsetInScroll(ref.current);
    if (o) o.sc.scrollTop += o.below;
    reachedEnd();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="completion-screen" ref={ref}>{children}</div>;
}

/**
 * For the element that starts a step of an exercise: when the step changes, and the step's start
 * is above the visible part of the screen (the button that led here was further down), it is
 * scrolled back into view. A step that already starts on screen is left where it is.
 */
export function useStepStart<T extends HTMLElement>(step: unknown) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const o = offsetInScroll(ref.current);
    if (o && o.below < 0) o.sc.scrollTop += o.below;
  }, [step]);
  return ref;
}

/** Stepping back within an exercise: a quiet text button under the step's main button. */
export function StepBack({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="btn btn-ghost step-back" onClick={onClick}>
      <span aria-hidden="true">←</span> Back
    </button>
  );
}

/**
 * A main button that waits for something to be written or chosen, with what it needs said right
 * under it while it waits.
 */
export function WaitingButton({ ready, need, className = '', onClick, children }: {
  ready: boolean;
  need: string;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <>
      <button
        className={`btn btn-primary w-full ${className}`.trim()}
        disabled={!ready}
        aria-describedby={ready ? undefined : id}
        onClick={onClick}
      >
        {children}
      </button>
      {!ready && <p id={id} className="btn-need">{need}</p>}
    </>
  );
}
