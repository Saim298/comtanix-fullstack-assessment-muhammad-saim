import axios from "axios";
import { AUTH_TOKEN_KEY, invalidateSession } from "./authSession.ts";

export { AUTH_TOKEN_KEY } from "./authSession.ts";

export type UserRole = "admin" | "staff";

export interface AuthUser {
    id: number;
    name: string;
    email: string;
    role: UserRole;
}

interface LoginResponse {
    message: string;
    token: string;
    token_type: string;
    user: AuthUser;
}

interface ProfileResponse {
    data: AuthUser;
}

interface ApiErrorResponse {
    message?: string;
    errors?: Record<string, string[]>;
}

export const api = axios.create({
    baseURL: import.meta.env?.VITE_API_BASE_URL || "/api",
    timeout: 10000,
    headers: {
        Accept: "application/json",
    },
});

api.interceptors.request.use((config) => {
    const token = sessionStorage.getItem(AUTH_TOKEN_KEY);

    if (token && config.headers.get("Authorization") === undefined) {
        config.headers.set("Authorization", `Bearer ${token}`);
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            const authorization = error.config?.headers.get("Authorization");
            if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
                invalidateSession(authorization.slice(7));
            }
        }
        return Promise.reject(error);
    },
);

export const authApi = {
    async login(email: string, password: string): Promise<LoginResponse> {
        const response = await api.post<LoginResponse>("/login", {
            email,
            password,
        }, { headers: { Authorization: false } });

        return response.data;
    },

    async me(signal?: AbortSignal, token?: string): Promise<AuthUser> {
        const response = await api.get<ProfileResponse>("/user", {
            signal,
            ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        });

        return response.data.data;
    },

    async logout(token?: string): Promise<void> {
        await api.post("/logout", undefined, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
    },
};

export function getApiErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as ApiErrorResponse | undefined;

        if (data?.message) {
            return data.message;
        }

        const firstError = Object.values(data?.errors ?? {})[0]?.[0];

        if (firstError) {
            return firstError;
        }

        if (!error.response) {
            return "Unable to connect to the server.";
        }

        return `Request failed with status ${error.response.status}.`;
    }

    return "An unexpected error occurred.";
}
