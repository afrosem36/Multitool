import React, { useEffect, useRef, useState } from 'react';

const TURNSTILE_SCRIPT_ID = 'cloudflare-turnstile-script';
const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);

  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID);

    const handleLoad = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Turnstile did not initialize.'));
    };

    if (existingScript) {
      existingScript.addEventListener('load', handleLoad, { once: true });
      existingScript.addEventListener(
        'error',
        () => reject(new Error('Turnstile could not be loaded.')),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error('Turnstile could not be loaded.')),
      { once: true },
    );
    document.head.appendChild(script);
  });
}

export default function TurnstileWidget({
  siteKey,
  action = 'email_verifier_send',
  onVerify,
  onError,
  resetKey,
}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    onVerify('');
    setLoadError('');

    if (!siteKey) {
      const message = 'Verification challenge is not configured.';
      setLoadError(message);
      onError?.(message);
      return undefined;
    }

    loadTurnstile()
      .then((turnstile) => {
        if (!active || !containerRef.current) return;

        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          theme: 'auto',
          callback: (token) => {
            if (active) onVerify(token);
          },
          'expired-callback': () => {
            if (active) onVerify('');
          },
          'error-callback': () => {
            if (!active) return;
            onVerify('');
            onError?.('The security check failed. Please try again.');
          },
        });
      })
      .catch((error) => {
        if (!active) return;
        const message = error.message || 'Verification challenge could not be loaded.';
        setLoadError(message);
        onError?.(message);
      });

    return () => {
      active = false;
      onVerify('');
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [siteKey, action, onVerify, onError, resetKey]);

  return (
    <div className="email-verifier__turnstile">
      <div ref={containerRef} aria-label="Security verification challenge" />
      {loadError && (
        <p className="email-verifier__challenge-error" role="alert">
          {loadError}
        </p>
      )}
    </div>
  );
}
