import { Component, ReactNode } from 'react';

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="completion-screen" style={{ minHeight: '100%' }}>
        <span className="completion-icon">🌿</span>
        <div className="completion-title">Something went wrong</div>
        <div className="completion-msg">Your saved check-ins are safe. Reload to continue.</div>
        <button className="btn btn-primary mt-4" onClick={() => window.location.reload()}>Reload</button>
        <a className="sos-footer-link" href="tel:988">Need to talk to someone now? Call or text 988</a>
      </div>
    );
  }
}
