export function getValidatedConvexUrl(rawValue: string | undefined) {
  const value = rawValue?.trim();

  if (!value) {
    throw new Error(
      "Missing VITE_CONVEX_URL. Set the frontend environment variable before deploying the web app."
    );
  }

  try {
    return new URL(value).origin;
  } catch {
    throw new Error(
      "Invalid VITE_CONVEX_URL. Use the full Convex deployment URL from the backend environment."
    );
  }
}
