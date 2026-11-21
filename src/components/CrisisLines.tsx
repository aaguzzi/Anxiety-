// Every way to reach a person looks the same wherever it appears: a phone or a message icon in
// front of what it does ('Call 988', 'Text 988'), so a call action is recognisable at a glance.

export function PhoneIcon() {
  return (
    <svg className="crisis-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.8 19.8 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MessageIcon() {
  return (
    <svg className="crisis-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A full-width card that calls or texts someone. */
export function SupportLink({ href, title, detail, urgent }: { href: string; title: string; detail: string; urgent?: boolean }) {
  return (
    <a className={`support-btn${urgent ? ' support-urgent' : ''}`} href={href}>
      <span className="support-title">{href.startsWith('sms:') ? <MessageIcon /> : <PhoneIcon />}<span>{title}</span></span>
      <span className="support-detail">{detail}</span>
    </a>
  );
}

/** 'Call 988' and 'Text 988' as two buttons, for screens that offer 988 without the full list. */
export function Reach988() {
  return (
    <div className="crisis-actions">
      <a className="btn btn-outline w-full" href="tel:988"><PhoneIcon />Call 988</a>
      <a className="btn btn-outline w-full" href="sms:988"><MessageIcon />Text 988</a>
    </div>
  );
}

const LINES = [
  { href: 'tel:988', title: 'Call 988', detail: 'Suicide Crisis Helpline · Canada & US · 24/7' },
  { href: 'sms:988', title: 'Text 988', detail: 'If talking feels like too much' },
  { href: 'tel:18006686868', title: 'Kids Help Phone', detail: '1-800-668-6868 · or text CONNECT to 686868 · young people in Canada' },
  { href: 'tel:18552423310', title: 'Hope for Wellness', detail: '1-855-242-3310 · Indigenous peoples in Canada · 24/7' },
];

export default function CrisisLines() {
  return (
    <div className="support-list">
      {LINES.map(l => <SupportLink key={l.href} {...l} />)}
      <SupportLink href="tel:911" title="Call 911" detail="If you are in immediate danger" urgent />
    </div>
  );
}
