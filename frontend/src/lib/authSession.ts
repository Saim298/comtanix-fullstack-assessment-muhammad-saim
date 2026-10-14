export const AUTH_TOKEN_KEY = "comtanix_auth_token";

const invalidationListeners = new Set<() => void>();

export function subscribeToSessionInvalidation(listener: () => void): () => void {
    invalidationListeners.add(listener);
    return () => { invalidationListeners.delete(listener); };
}

export function invalidateSession(token: string): boolean {
    if (sessionStorage.getItem(AUTH_TOKEN_KEY) !== token) return false;

    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    invalidationListeners.forEach((listener) => listener());
    return true;
}

export interface RestoredSession<T> {
    user: T | null;
    error: string;
}

export async function restoreSession<T>(
    loadUser: (token: string, signal: AbortSignal) => Promise<T>,
    signal: AbortSignal,
    onRestored: (session: RestoredSession<T>) => void,
): Promise<void> {
    if (signal.aborted) return;
    const token = sessionStorage.getItem(AUTH_TOKEN_KEY);

    if (!token) {
        onRestored({ user: null, error: "" });
        return;
    }

    try {
        const user = await loadUser(token, signal);
        if (!signal.aborted && sessionStorage.getItem(AUTH_TOKEN_KEY) === token) {
            onRestored({ user, error: "" });
        }
    } catch {
        if (!signal.aborted && sessionStorage.getItem(AUTH_TOKEN_KEY) === token) {
            onRestored({ user: null, error: "Unable to check your session. Please try again." });
        }
    }
}
