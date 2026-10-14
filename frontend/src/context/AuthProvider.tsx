import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useMatch } from "react-router-dom";
import { AuthContext } from "./auth-context";
import { AUTH_TOKEN_KEY, authApi } from "../lib/api";
import type { AuthUser } from "../lib/api";
import { invalidateSession, restoreSession, subscribeToSessionInvalidation } from "../lib/authSession";

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const publicQuoteRoute = useMatch("/request-quote");
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [restorationError, setRestorationError] = useState("");
    const [restorationAttempt, setRestorationAttempt] = useState(0);

    useEffect(() => subscribeToSessionInvalidation(() => {
        setUser(null);
        setRestorationError("");
        setLoading(false);
    }), []);

    useEffect(() => {
        const controller = new AbortController();

        void restoreSession(
            (token, signal) => authApi.me(signal, token),
            controller.signal,
            (session) => {
                setUser(session.user);
                setRestorationError(session.error);
                setLoading(false);
            },
        );

        return () => {
            controller.abort();
        };
    }, [restorationAttempt]);

    const login = async (email: string, password: string) => {
        const response = await authApi.login(email, password);

        sessionStorage.setItem(AUTH_TOKEN_KEY, response.token);
        setUser(response.user);
        setRestorationError("");
        setLoading(false);
    };

    const logout = async (): Promise<boolean> => {
        let revoked = true;
        const token = sessionStorage.getItem(AUTH_TOKEN_KEY);

        try {
            if (token) {
                await authApi.logout(token);
            }
        } catch {
            revoked = false;
        } finally {
            if (token) invalidateSession(token);
            else if (!sessionStorage.getItem(AUTH_TOKEN_KEY)) setUser(null);
        }

        return revoked;
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {restorationError && !publicQuoteRoute ? (
                <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
                    <div role="alert" className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <p className="text-sm text-slate-700">{restorationError}</p>
                        <button type="button" onClick={() => {
                            setRestorationError("");
                            setLoading(true);
                            setRestorationAttempt((value) => value + 1);
                        }} className="mt-4 cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Retry</button>
                    </div>
                </main>
            ) : children}
        </AuthContext.Provider>
    );
}
