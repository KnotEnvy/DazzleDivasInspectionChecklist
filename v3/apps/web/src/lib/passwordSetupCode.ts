const PASSWORD_SETUP_CODE_STORAGE_KEY = "dazzle-password-setup-code";

export function stashPasswordSetupCodeFromUrl() {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  if (url.pathname !== "/set-password") {
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return;
  }

  window.sessionStorage.setItem(PASSWORD_SETUP_CODE_STORAGE_KEY, code);
  url.searchParams.delete("code");
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}

export function getStoredPasswordSetupCode() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.sessionStorage.getItem(PASSWORD_SETUP_CODE_STORAGE_KEY);
}

export function clearStoredPasswordSetupCode() {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(PASSWORD_SETUP_CODE_STORAGE_KEY);
}
