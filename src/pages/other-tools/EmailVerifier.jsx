import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  AtSign,
  Check,
  CheckCircle2,
  Clock3,
  Info,
  Loader2,
  ListChecks,
  MailCheck,
  Minus,
  Send,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SEOHead from '../../components/seo/SEOHead';
import BulkEmailVerifier from '../../components/email-verifier/BulkEmailVerifier';
import TurnstileWidget from '../../components/shared/TurnstileWidget';
import { TURNSTILE_SITE_KEY } from '../../config';
import { useToolHistory } from '../../hooks/useToolHistory';
import { apiFetch } from '../../utils/api';
import '../styles/EmailVerifier.css';

const TERMINAL_STATUSES = new Set([
  'confirmed',
  'undeliverable',
  'complaint',
  'unknown',
]);
const MAX_POLL_ATTEMPTS = 40;
const POLL_INTERVAL_MS = 3000;

const EVIDENCE_FIELDS = [
  { key: 'syntax', label: 'Syntax', description: 'Address format' },
  { key: 'domain', label: 'Domain', description: 'Domain availability' },
  { key: 'mx', label: 'MX', description: 'Mail server records' },
  { key: 'disposable', label: 'Disposable', description: 'Temporary provider' },
  { key: 'roleBased', label: 'Role-based', description: 'Shared role address' },
  { key: 'smtp', label: 'SMTP', description: 'Server response' },
  { key: 'catchAll', label: 'Catch-all', description: 'Accepts any mailbox' },
  { key: 'deliveryStatus', label: 'Delivery', description: 'Message delivery' },
  { key: 'engagementStatus', label: 'Engagement', description: 'Estimated interaction' },
  { key: 'confirmationStatus', label: 'Confirmation', description: 'Owner confirmation' },
];

function normalizeStatus(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function isTerminal(result) {
  const status = normalizeStatus(result?.status);
  const deliveryStatus = normalizeStatus(result?.deliveryStatus);
  return TERMINAL_STATUSES.has(status) || deliveryStatus === 'expired';
}

function toneForStatus(value) {
  const status = normalizeStatus(value);
  if (
    [
      'valid', 'confirmed', 'confirmed_active', 'delivered', 'deliverable',
      'likely_deliverable', 'open_detected', 'click_detected', 'pass', 'passed',
      'true', 'yes',
    ].includes(
      status,
    )
  ) {
    return 'success';
  }
  if (
    [
      'invalid', 'undeliverable', 'hard_bounce', 'suppressed', 'complaint',
      'fail', 'failed', 'false', 'rejected', 'error',
    ].includes(
      status,
    )
  ) {
    return 'danger';
  }
  if (
    [
      'pending', 'checking', 'queued', 'sending', 'sent', 'delayed', 'soft_bounce',
      'catch_all', 'risky', 'warning', 'unknown',
    ].includes(
      status,
    )
  ) {
    return 'warning';
  }
  return 'neutral';
}

function displayValue(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (value === null || value === undefined || value === '') return 'Not checked';
  if (typeof value === 'object') {
    return value.label || value.status || value.value || JSON.stringify(value);
  }
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function evidenceTone(key, value) {
  if (value === null || value === undefined || value === '') return 'neutral';
  if (typeof value === 'object') {
    if (typeof value.valid === 'boolean') return value.valid ? 'success' : 'danger';
    if (
      (key === 'disposable' || key === 'roleBased') &&
      typeof value.value === 'boolean'
    ) {
      return value.value ? 'danger' : 'success';
    }
    return toneForStatus(value.status ?? value.value ?? value.label);
  }
  if (typeof value === 'boolean') {
    if (key === 'catchAll' && value === true) return 'warning';
    const negativeSignal = key === 'disposable' || key === 'roleBased';
    return value === negativeSignal ? 'danger' : 'success';
  }
  return toneForStatus(value);
}

function StatusIcon({ tone, size = 18 }) {
  if (tone === 'success') return <CheckCircle2 size={size} aria-hidden="true" />;
  if (tone === 'danger') return <XCircle size={size} aria-hidden="true" />;
  if (tone === 'warning') return <AlertCircle size={size} aria-hidden="true" />;
  return <Minus size={size} aria-hidden="true" />;
}

function formatTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function ConfidenceMeter({ score }) {
  const numericScore = Number(score);
  const safeScore = Number.isFinite(numericScore)
    ? Math.max(0, Math.min(100, numericScore))
    : null;

  if (safeScore === null) return null;

  return (
    <div
      className="email-verifier__confidence"
      style={{ '--confidence': `${safeScore * 3.6}deg` }}
      aria-label={`Confidence score ${safeScore} out of 100`}
    >
      <div className="email-verifier__confidence-inner">
        <strong>{Math.round(safeScore)}</strong>
        <span>/ 100</span>
      </div>
    </div>
  );
}

function ResultPanel({ result }) {
  const overallTone = toneForStatus(result.status);
  const latestEventTime =
    result.latestEventAt || result.latestEventTime || result.updatedAt || result.checkedAt;
  const hasDeliveryFlow =
    (result.deliveryStatus && result.deliveryStatus !== 'not_sent') ||
    (result.confirmationStatus && result.confirmationStatus !== 'not_requested');
  const timeline = hasDeliveryFlow
    ? [
        { key: 'status', label: 'Verification', value: result.statusLabel || result.status },
        { key: 'deliveryStatus', label: 'Delivery', value: result.deliveryStatus },
        { key: 'engagementStatus', label: 'Engagement', value: result.engagementStatus },
        { key: 'confirmationStatus', label: 'Confirmation', value: result.confirmationStatus },
      ].filter((item) => item.value !== null && item.value !== undefined && item.value !== '')
    : [];

  return (
    <section className="email-verifier__result glass-panel" aria-labelledby="verification-result">
      <div className="email-verifier__result-topline">
        <div>
          <span className="email-verifier__eyebrow">Verification result</span>
          <h2 id="verification-result">{result.email}</h2>
        </div>
        <div className={`email-verifier__status email-verifier__status--${overallTone}`}>
          <StatusIcon tone={overallTone} />
          <span>{result.statusLabel || result.status}</span>
        </div>
      </div>

      <div className="email-verifier__summary">
        <ConfidenceMeter score={result.confidenceScore} />
        <div className="email-verifier__summary-copy">
          {result.reason && <p>{result.reason}</p>}
          {result.suggestedEmail && (
            <div className="email-verifier__suggestion">
              <Info size={18} aria-hidden="true" />
              <span>
                Did you mean <strong>{result.suggestedEmail}</strong>?
              </span>
            </div>
          )}
          {latestEventTime && (
            <div className="email-verifier__timestamp">
              <Clock3 size={16} aria-hidden="true" />
              <span>Latest event: {formatTimestamp(latestEventTime)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="email-verifier__section-heading">
        <div>
          <span className="email-verifier__eyebrow">Evidence ladder</span>
          <h3>Signals checked</h3>
        </div>
        <span className="email-verifier__signal-count">{EVIDENCE_FIELDS.length} signals</span>
      </div>

      <dl className="email-verifier__evidence">
        {EVIDENCE_FIELDS.map((field, index) => {
          const value = result[field.key];
          const tone = evidenceTone(field.key, value);
          return (
            <div className={`email-verifier__evidence-item is-${tone}`} key={field.key}>
              <dt>
                <span className="email-verifier__step">{String(index + 1).padStart(2, '0')}</span>
                <span>
                  <strong>{field.label}</strong>
                  <small>{field.description}</small>
                </span>
              </dt>
              <dd>
                <StatusIcon tone={tone} />
                <span>{displayValue(value)}</span>
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="email-verifier__limitations">
        <Info size={18} aria-hidden="true" />
        <div>
          <strong>SMTP probing is unavailable from Cloudflare</strong>
          <p>
            An unavailable SMTP signal does not make an address invalid. The score relies on the
            other returned technical and delivery evidence.
          </p>
        </div>
      </div>

      <details className="email-verifier__score-details">
        <summary>How this score was calculated</summary>
        <p>
          Confidence combines returned syntax, domain, MX, disposable, role-based, catch-all,
          historical delivery, current delivery, engagement, and secure confirmation signals.
          Confirmed Active is strongest; hard bounces and complaints override weaker positive
          signals.
        </p>
        {Array.isArray(result.scoreBreakdown) && result.scoreBreakdown.length > 0 && (
          <ul>
            {result.scoreBreakdown.map((item, index) => (
              <li key={`${item.signal || item.label}-${index}`}>
                <span>{item.signal || item.label}</span>
                <strong>{typeof item.points === 'number' && item.points > 0 ? '+' : ''}{item.points}</strong>
              </li>
            ))}
          </ul>
        )}
      </details>

      {hasDeliveryFlow && (
        <p className="email-verifier__tracking-limitation">
          Open tracking is an estimate. Some email clients block tracking images, while privacy
          features may generate automatic opens. A secure confirmation-link click remains the
          strongest proof.
        </p>
      )}

      {timeline.length > 1 && (
        <div className="email-verifier__timeline-wrap">
          <h3>Live verification states</h3>
          <ol className="email-verifier__timeline">
            {timeline.map((item, index) => {
              const tone = toneForStatus(item.value);
              return (
                <li className={`is-${tone}`} key={item.key}>
                  <span className="email-verifier__timeline-marker">
                    {index === timeline.length - 1 ? (
                      <StatusIcon tone={tone} size={16} />
                    ) : (
                      <Check size={16} aria-hidden="true" />
                    )}
                  </span>
                  <span>
                    <small>{item.label}</small>
                    <strong>{displayValue(item.value)}</strong>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}

export default function EmailVerifier() {
  const [mode, setMode] = useState('instant');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [instantTurnstileRequired, setInstantTurnstileRequired] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollingRunRef = useRef(0);
  const pollingTimerRef = useRef(null);
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/tools/email-verifier', 'Email Verifier', 'mailCheck');
  }, [addHistory]);

  useEffect(
    () => () => {
      pollingRunRef.current += 1;
      if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
    },
    [],
  );

  const handleTurnstileVerify = useCallback((token) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileError = useCallback((message) => {
    setError(message);
  }, []);

  const stopPolling = useCallback(() => {
    pollingRunRef.current += 1;
    if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
    pollingTimerRef.current = null;
    setIsPolling(false);
  }, []);

  const pollVerification = useCallback(async (verificationId, enteredEmail) => {
    const runId = pollingRunRef.current + 1;
    pollingRunRef.current = runId;
    setIsPolling(true);

    const poll = async (attempt) => {
      if (pollingRunRef.current !== runId) return;

      try {
        const update = await apiFetch(
          `/api/email-verifier/status/${encodeURIComponent(verificationId)}`,
        );
        if (pollingRunRef.current !== runId) return;

        setResult((current) => ({
          ...current,
          ...update,
          email: update.email || current?.email || enteredEmail,
        }));

        if (isTerminal(update)) {
          setIsPolling(false);
          return;
        }

        if (attempt >= MAX_POLL_ATTEMPTS - 1) {
          setIsPolling(false);
          setError(
            'The verification is still pending. You can submit the address again later to check its status.',
          );
          return;
        }

        pollingTimerRef.current = setTimeout(() => poll(attempt + 1), POLL_INTERVAL_MS);
      } catch (pollError) {
        if (pollingRunRef.current !== runId) return;
        setIsPolling(false);
        setError(pollError.message);
      }
    };

    poll(0);
  }, []);

  const changeMode = (nextMode) => {
    if (nextMode === mode) return;
    stopPolling();
    setMode(nextMode);
    setConsent(false);
    setTurnstileToken('');
    setInstantTurnstileRequired(false);
    setError('');
    setResult(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    stopPolling();
    setError('');
    setResult(null);

    const enteredEmail = email.trim();
    if (!enteredEmail) {
      setError('Enter an email address to verify.');
      return;
    }
    if (mode === 'confirm' && (!consent || !turnstileToken)) return;

    setIsSubmitting(true);
    try {
      if (mode === 'instant') {
        const checkResult = await apiFetch('/api/email-verifier/check', {
          method: 'POST',
          body: JSON.stringify({
            email: enteredEmail,
            turnstileToken: instantTurnstileRequired ? turnstileToken : undefined,
          }),
        });
        setResult({ ...checkResult, email: checkResult.email || enteredEmail });
        setInstantTurnstileRequired(false);
      } else {
        const sendResult = await apiFetch('/api/email-verifier/send', {
          method: 'POST',
          body: JSON.stringify({
            email: enteredEmail,
            consent: true,
            turnstileToken,
          }),
        });
        setResult({ ...sendResult, email: enteredEmail });
        setTurnstileToken('');
        setTurnstileResetKey((key) => key + 1);
        if (sendResult.verificationId) {
          pollVerification(sendResult.verificationId, enteredEmail);
        }
      }
    } catch (submitError) {
      setError(submitError.message);
      if (mode === 'instant' && submitError.code === 'TURNSTILE_REQUIRED') {
        setInstantTurnstileRequired(true);
      }
      if (mode === 'confirm') {
        setTurnstileToken('');
        setTurnstileResetKey((key) => key + 1);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDisabled =
    mode === 'confirm' && (!consent || !turnstileToken || !TURNSTILE_SITE_KEY);
  const instantDisabled =
    mode === 'instant' &&
    instantTurnstileRequired &&
    (!turnstileToken || !TURNSTILE_SITE_KEY);
  const busy = isSubmitting || isPolling;

  return (
    <>
      <SEOHead
        title="Email Verifier"
        description="Check whether an email address is likely able to receive messages, or send a permission-based confirmation email."
        canonicalUrl="https://www.multitoolhub.space/tools/email-verifier"
      />

      <main className={`email-verifier email-verifier--mode-${mode} container`}>
        <Link to="/utilities" className="email-verifier__back btn-secondary">
          <ArrowLeft size={17} aria-hidden="true" />
          Back to Utilities
        </Link>

        <header className="email-verifier__header">
          <span className="email-verifier__icon" aria-hidden="true">
            <MailCheck size={34} />
          </span>
          <div>
            <span className="email-verifier__eyebrow">Utilities / diagnostics</span>
            <h1>Email Verifier</h1>
            <p>Check whether an email address is likely able to receive messages</p>
          </div>
        </header>

        <section className="email-verifier__console glass-panel" aria-labelledby="check-heading">
          <div className="email-verifier__console-bar">
            <div>
              <span className="email-verifier__console-light" />
              <span className="email-verifier__console-light" />
              <span className="email-verifier__console-light" />
            </div>
            <span>Permission-aware diagnostic</span>
            <ShieldCheck size={18} aria-hidden="true" />
          </div>

          <form onSubmit={handleSubmit}>
            <fieldset className="email-verifier__modes">
              <legend id="check-heading">Choose verification mode</legend>
              <div className="email-verifier__mode-grid">
                <label className={mode === 'instant' ? 'is-selected' : ''}>
                  <input
                    type="radio"
                    name="verification-mode"
                    value="instant"
                    checked={mode === 'instant'}
                    onChange={() => changeMode('instant')}
                    disabled={busy}
                  />
                  <span className="email-verifier__mode-icon">
                    <AtSign size={20} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>Instant Check</strong>
                    <small>No email is sent.</small>
                  </span>
                  <span className="email-verifier__radio-dot" />
                </label>

                <label className={mode === 'confirm' ? 'is-selected' : ''}>
                  <input
                    type="radio"
                    name="verification-mode"
                    value="confirm"
                    checked={mode === 'confirm'}
                    onChange={() => changeMode('confirm')}
                    disabled={busy}
                  />
                  <span className="email-verifier__mode-icon">
                    <Send size={20} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>Confirm by Email</strong>
                    <small>A one-time verification message is sent with your permission.</small>
                  </span>
                  <span className="email-verifier__radio-dot" />
                </label>

                <label className={mode === 'bulk' ? 'is-selected' : ''}>
                  <input
                    type="radio"
                    name="verification-mode"
                    value="bulk"
                    checked={mode === 'bulk'}
                    onChange={() => changeMode('bulk')}
                    disabled={busy}
                  />
                  <span className="email-verifier__mode-icon">
                    <ListChecks size={20} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>Bulk Verification</strong>
                    <small>Review and verify a spreadsheet in a controlled job.</small>
                  </span>
                  <span className="email-verifier__radio-dot" />
                </label>
              </div>
            </fieldset>

            {mode === 'bulk' ? (
              <BulkEmailVerifier />
            ) : (
            <div className="email-verifier__form-body">
              <label className="email-verifier__email-label" htmlFor="email-verifier-input">
                Email address
              </label>
              <div className="email-verifier__input-row">
                <div className="email-verifier__input-wrap">
                  <AtSign size={20} aria-hidden="true" />
                  <input
                    id="email-verifier-input"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={busy}
                    required
                  />
                </div>
                <button
                  className="email-verifier__submit btn-primary"
                  type="submit"
                  disabled={busy || !email.trim() || confirmDisabled || instantDisabled}
                  aria-busy={busy}
                >
                  {busy ? (
                    <>
                      <Loader2 className="email-verifier__spinner" size={19} aria-hidden="true" />
                      {isPolling ? 'Awaiting status' : 'Checking'}
                    </>
                  ) : mode === 'confirm' ? (
                    <>
                      <Send size={18} aria-hidden="true" />
                      Send verification
                    </>
                  ) : (
                    <>
                      <MailCheck size={19} aria-hidden="true" />
                      Verify email
                    </>
                  )}
                </button>
              </div>

              {mode === 'confirm' && (
                <div className="email-verifier__confirm-options">
                  <label className="email-verifier__consent">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(event) => setConsent(event.target.checked)}
                      disabled={busy}
                    />
                    <span className="email-verifier__checkbox">
                      <Check size={15} aria-hidden="true" />
                    </span>
                    <span>
                      I confirm that I own this email address or have permission to send a
                      verification message to it.
                    </span>
                  </label>
                  <TurnstileWidget
                    siteKey={TURNSTILE_SITE_KEY}
                    onVerify={handleTurnstileVerify}
                    onError={handleTurnstileError}
                    resetKey={turnstileResetKey}
                  />
                </div>
              )}

              {mode === 'instant' && instantTurnstileRequired && (
                <div className="email-verifier__adaptive-challenge">
                  <div>
                    <strong>One more security check</strong>
                    <p>Complete the challenge, then submit this instant check again.</p>
                  </div>
                  <TurnstileWidget
                    siteKey={TURNSTILE_SITE_KEY}
                    action="email_verifier_instant"
                    onVerify={handleTurnstileVerify}
                    onError={handleTurnstileError}
                    resetKey={turnstileResetKey}
                  />
                </div>
              )}

              <div className="email-verifier__announcements" aria-live="polite" aria-atomic="true">
                {error && (
                  <div className="email-verifier__error" role="alert">
                    <X size={18} aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}
                {isSubmitting && (
                  <p className="email-verifier__loading">Running the requested verification…</p>
                )}
                {isPolling && (
                  <p className="email-verifier__loading">
                    Verification sent. Waiting for the latest real delivery status…
                  </p>
                )}
              </div>
            </div>
            )}
          </form>
        </section>

        {result && <ResultPanel result={result} />}

        <aside className="email-verifier__privacy">
          <ShieldCheck size={20} aria-hidden="true" />
          <p>
            The entered address is used only to perform the requested verification. Do not use
            this tool to send unsolicited messages or verify addresses without permission.
          </p>
        </aside>
      </main>
    </>
  );
}
