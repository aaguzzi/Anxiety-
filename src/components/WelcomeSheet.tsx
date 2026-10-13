interface Props {
  onAccept: () => void;
}

export default function WelcomeSheet({ onAccept }: Props) {
  return (
    <div className="exercise-overlay welcome-overlay">
      <div className="exercise-scroll welcome-scroll">
        <span className="welcome-icon">🌿</span>
        <div className="exercise-title">Welcome</div>
        <p className="welcome-text">
          Anxiety Companion offers short self-help practices drawn from mindfulness and acceptance-based approaches.
        </p>
        <p className="welcome-text">
          It is <strong>not</strong> a substitute for professional care, diagnosis or treatment.
        </p>
        <p className="welcome-text">Everything you enter stays on this device.</p>

        <button className="btn btn-primary w-full mt-4" onClick={onAccept}>Get started</button>
      </div>
    </div>
  );
}
