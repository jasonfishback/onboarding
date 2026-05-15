/**
 * Fire-and-forget signup tracker that POSTs to kpi.simonexpress.com.
 * Generates a stable session_id stored in localStorage so re-visits and
 * step transitions are linked together as one funnel session.
 *
 * Never blocks the form: errors are swallowed, requests use keepalive so
 * navigations don't kill in-flight pings.
 */

const KPI_URL = process.env.NEXT_PUBLIC_KPI_TRACKER_URL
  || 'https://kpi.simonexpress.com/api/setup/signup';
const STORAGE_KEY = 'simon_setup_session_id';

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      // crypto.randomUUID() ships in all modern browsers
      id = (crypto as Crypto).randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

/** Clear the session id (called after successful submit so next visit is a new session). */
export function clearSession(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

type Payload = Record<string, unknown> & { step: number; completed?: boolean };

export function trackStep(payload: Payload): void {
  if (typeof window === 'undefined') return;
  const session_id = getSessionId();
  if (!session_id) return;

  // UTM params from URL (read once, cached for the session)
  let utm: Record<string, string> = {};
  try {
    const cached = sessionStorage.getItem('simon_setup_utm');
    if (cached) {
      utm = JSON.parse(cached);
    } else {
      const sp = new URLSearchParams(window.location.search);
      for (const k of ['utm_source', 'utm_medium', 'utm_campaign']) {
        const v = sp.get(k); if (v) utm[k] = v;
      }
      sessionStorage.setItem('simon_setup_utm', JSON.stringify(utm));
    }
  } catch {}

  const body = JSON.stringify({ session_id, ...utm, ...payload });

  try {
    // keepalive lets the request survive page unload (helpful for last step)
    fetch(KPI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      mode: 'cors',
    }).catch(() => { /* swallow — never block the form */ });
  } catch { /* ignore */ }
}
