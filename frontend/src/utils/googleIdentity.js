let googleScriptPromise = null;

export function loadGoogleIdentityScript() {
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Identity script')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity script'));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

export function renderGoogleSignInButton({ container, clientId, callback, width = 320, text = 'continue_with' }) {
  if (!container || !clientId || !window.google?.accounts?.id) return;

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback
  });

  container.innerHTML = '';
  const containerWidth = Math.floor(container.getBoundingClientRect().width || width);
  const resolvedWidth = Math.max(220, Math.min(width, containerWidth));
  window.google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text,
    shape: 'rectangular',
    logo_alignment: 'left',
    width: resolvedWidth
  });
}
