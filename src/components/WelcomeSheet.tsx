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

        <div className="card welcome-crisis">
          <div className="welcome-crisis-title">If you are in crisis</div>
          <a className="support-btn" href="tel:988">
            <span className="support-title">Call or text 988</span>
            <span className="support-detail">Suicide Crisis Helpline · Canada &amp; US · 24/7</span>
          </a>
          <a className="support-btn support-urgent" href="tel:911">
            <span className="support-title">Call 911</span>
            <span className="support-detail">If you are in immediate danger</span>
          </a>
        </div>

        <p className="welcome-text">
          The <span className="welcome-sos">SOS</span> button is on every screen whenever anxiety spikes.
          Everything you enter stays on this device.
        </p>

        <button className="btn btn-primary w-full mt-4" onClick={onAccept}>I understand</button>
      </div>
    </div>
  );
}
