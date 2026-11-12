const LINES = [
  { href: 'tel:988', title: 'Call 988', detail: 'Suicide Crisis Helpline · Canada & US · 24/7' },
  { href: 'sms:988', title: 'Text 988', detail: 'If talking feels like too much' },
  { href: 'tel:18006686868', title: 'Kids Help Phone', detail: '1-800-668-6868 · or text CONNECT to 686868 · young people in Canada' },
  { href: 'tel:18552423310', title: 'Hope for Wellness', detail: '1-855-242-3310 · Indigenous peoples in Canada · 24/7' },
];

export default function CrisisLines() {
  return (
    <div className="support-list">
      {LINES.map(l => (
        <a key={l.href} className="support-btn" href={l.href}>
          <span className="support-title">{l.title}</span>
          <span className="support-detail">{l.detail}</span>
        </a>
      ))}
      <a className="support-btn support-urgent" href="tel:911">
        <span className="support-title">Call 911</span>
        <span className="support-detail">If you are in immediate danger</span>
      </a>
    </div>
  );
}
