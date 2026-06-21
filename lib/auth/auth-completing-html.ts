import { safeRedirectPath } from "@/lib/auth/safe-redirect"

/**
 * Standalone HTML for post-OAuth session sync. Bypasses the React app shell so private /
 * incognito browsers never flash a failed page load while SiteChrome and client bundles hydrate.
 */
export function buildAuthCompletingHtml(destination: string): string {
  const dest = safeRedirectPath(destination)
  const destJson = JSON.stringify(dest)
  const loginHref = `/auth/login?redirect=${encodeURIComponent(dest)}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="robots" content="noindex, nofollow">
  <title>Completing sign in — Reswell</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0;
      min-height: 100dvh;
      background: #fff;
      color: #171717;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .wrap {
      display: flex;
      min-height: 100dvh;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .panel { text-align: center; max-width: 20rem; }
    .spinner {
      width: 1.25rem;
      height: 1.25rem;
      margin: 0 auto;
      border: 2px solid #e5e5e5;
      border-top-color: #737373;
      border-radius: 9999px;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .fail { display: none; }
    .fail h1 {
      margin: 0 0 0.5rem;
      font-size: 1.125rem;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .fail p {
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.5;
      color: #737373;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 1.25rem;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 2.75rem;
      padding: 0 1.25rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 500;
      text-decoration: none;
    }
    .btn-primary { background: #171717; color: #fff; }
    .btn-outline { border: 1px solid #d4d4d4; color: #171717; }
  </style>
</head>
<body>
  <div class="wrap" role="status" aria-live="polite" aria-label="Completing sign in">
    <div class="panel">
      <div id="loading"><div class="spinner" aria-hidden="true"></div></div>
      <div id="fail" class="fail">
        <h1>Sign-in is taking longer than expected</h1>
        <p>Try again — your account may already be signed in on another tab.</p>
        <div class="actions">
          <a class="btn btn-primary" href="${loginHref}">Try again</a>
          <a class="btn btn-outline" href="/">Go home</a>
        </div>
      </div>
    </div>
  </div>
  <script>
    (function () {
      var dest = ${destJson};
      var maxAttempts = 200;
      var msBetween = 50;

      function showFail() {
        var loading = document.getElementById("loading");
        var fail = document.getElementById("fail");
        if (loading) loading.style.display = "none";
        if (fail) fail.style.display = "block";
      }

      function sleep(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
      }

      async function poll() {
        for (var i = 0; i < maxAttempts; i += 1) {
          try {
            var res = await fetch("/api/auth/session-ready", {
              credentials: "include",
              cache: "no-store",
            });
            if (res.status === 204) {
              window.location.replace(dest);
              return;
            }
          } catch (e) { /* private mode / transient network */ }
          await sleep(msBetween);
        }
        try {
          var res = await fetch("/api/auth/session-ready", {
            credentials: "include",
            cache: "no-store",
          });
          if (res.status === 204) {
            window.location.replace(dest);
            return;
          }
        } catch (e) { /* ignore */ }
        showFail();
      }

      void poll();
    })();
  </script>
</body>
</html>`
}
