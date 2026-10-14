import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { AxiosError } from "axios";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { api, authApi } from "../src/lib/api.ts";
import type { AuthUser } from "../src/lib/api.ts";
import { AUTH_TOKEN_KEY, restoreSession, subscribeToSessionInvalidation } from "../src/lib/authSession.ts";
import type { RestoredSession } from "../src/lib/authSession.ts";

const user: AuthUser = { id: 1, name: "Admin", email: "admin@example.test", role: "admin" };
const originalAdapter = api.defaults.adapter;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
let unsubscribe: (() => void) | undefined;

beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "sessionStorage", {
        configurable: true,
        value: {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => { values.set(key, value); },
            removeItem: (key: string) => { values.delete(key); },
        },
    });
});

afterEach(() => {
    api.defaults.adapter = originalAdapter;
    unsubscribe?.();
    unsubscribe = undefined;
    if (originalStorage) Object.defineProperty(globalThis, "sessionStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
});

function response(config: InternalAxiosRequestConfig, status: number, data: unknown = {}): AxiosResponse {
    const result = { config, status, data, statusText: String(status), headers: {} };
    if (status >= 400) throw new AxiosError("Request failed", "ERR_BAD_RESPONSE", config, undefined, result);
    return result;
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((complete) => { resolve = complete; });
    return { promise, resolve };
}

test("concurrent authenticated 401 responses invalidate the matching session once", async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, "expired-token");
    let invalidations = 0;
    unsubscribe = subscribeToSessionInvalidation(() => { invalidations += 1; });
    api.defaults.adapter = async (config) => {
        assert.equal(config.headers.get("Authorization"), "Bearer expired-token");
        return response(config, 401);
    };

    const results = await Promise.allSettled([api.get("/quote-requests"), api.get("/staff-users")]);

    assert.ok(results.every((result) => result.status === "rejected"));
    assert.equal(sessionStorage.getItem(AUTH_TOKEN_KEY), null);
    assert.equal(invalidations, 1);
});

test("a stale authenticated 401 cannot clear a newly signed-in session", async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, "old-token");
    const started = deferred<void>();
    const finish = deferred<void>();
    let invalidations = 0;
    unsubscribe = subscribeToSessionInvalidation(() => { invalidations += 1; });
    api.defaults.adapter = async (config) => {
        if (config.url === "/login") {
            return response(config, 200, { token: "new-token", user });
        }
        assert.equal(config.headers.get("Authorization"), "Bearer old-token");
        started.resolve();
        await finish.promise;
        return response(config, 401);
    };
    const pending = assert.rejects(api.get("/quote-requests"));
    await started.promise;
    const login = await authApi.login(user.email, "password");
    sessionStorage.setItem(AUTH_TOKEN_KEY, login.token);
    finish.resolve();
    await pending;

    assert.equal(sessionStorage.getItem(AUTH_TOKEN_KEY), "new-token");
    assert.equal(invalidations, 0);
});

test("login 401 and validation errors never send or invalidate the existing token", async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, "existing-token");
    let invalidations = 0;
    unsubscribe = subscribeToSessionInvalidation(() => { invalidations += 1; });

    for (const status of [401, 422]) {
        api.defaults.adapter = async (config) => {
            assert.equal(config.headers.get("Authorization"), false);
            return response(config, status, { message: "Invalid email or password." });
        };
        await assert.rejects(authApi.login(user.email, "incorrect"), (error: unknown) => {
            assert.ok(error instanceof AxiosError);
            assert.equal(error.response?.status, status);
            assert.equal(error.response?.data.message, "Invalid email or password.");
            return true;
        });
    }

    assert.equal(sessionStorage.getItem(AUTH_TOKEN_KEY), "existing-token");
    assert.equal(invalidations, 0);
});

test("unauthenticated 401 and permission errors do not invalidate a session", async () => {
    let invalidations = 0;
    unsubscribe = subscribeToSessionInvalidation(() => { invalidations += 1; });
    api.defaults.adapter = async (config) => response(config, 401);
    await assert.rejects(api.get("/user"));
    sessionStorage.setItem(AUTH_TOKEN_KEY, "valid-token");
    api.defaults.adapter = async (config) => response(config, 403);
    await assert.rejects(api.get("/staff-users"));

    assert.equal(sessionStorage.getItem(AUTH_TOKEN_KEY), "valid-token");
    assert.equal(invalidations, 0);
});

test("restoration without a token completes anonymously without a request", async () => {
    let restored: RestoredSession<typeof user> | undefined;
    await restoreSession<typeof user>(async () => {
        assert.fail("No request should be sent");
    }, new AbortController().signal, (session) => { restored = session; });

    assert.deepEqual(restored, { user: null, error: "" });
});

test("restoration with an invalid token invalidates auth without showing a recovery error", async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, "expired-token");
    let invalidations = 0;
    let restorationCallbacks = 0;
    unsubscribe = subscribeToSessionInvalidation(() => { invalidations += 1; });
    api.defaults.adapter = async (config) => response(config, 401);

    await restoreSession((token, signal) => authApi.me(signal, token), new AbortController().signal, () => {
        restorationCallbacks += 1;
    });

    assert.equal(sessionStorage.getItem(AUTH_TOKEN_KEY), null);
    assert.equal(invalidations, 1);
    assert.equal(restorationCallbacks, 0);
});

for (const failure of ["network", "timeout", 500, 503] as const) {
    test(`restoration preserves the token after ${failure} and succeeds on retry`, async () => {
        sessionStorage.setItem(AUTH_TOKEN_KEY, "valid-token");
        const results: RestoredSession<typeof user>[] = [];
        api.defaults.adapter = async (config) => {
            if (failure === "network" || failure === "timeout") {
                throw new AxiosError("Unavailable", failure === "network" ? "ERR_NETWORK" : "ECONNABORTED", config);
            }
            return response(config, failure);
        };
        const restore = () => restoreSession((token, signal) => authApi.me(signal, token), new AbortController().signal, (session) => { results.push(session); });

        await restore();

        assert.equal(sessionStorage.getItem(AUTH_TOKEN_KEY), "valid-token");
        assert.equal(results[0].user, null);
        assert.match(results[0].error, /try again/i);

        api.defaults.adapter = async (config) => {
            assert.equal(config.headers.get("Authorization"), "Bearer valid-token");
            return response(config, 200, { data: user });
        };
        await restore();

        assert.deepEqual(results[1], { user, error: "" });
        assert.equal(sessionStorage.getItem(AUTH_TOKEN_KEY), "valid-token");
    });
}

test("a stale restoration success cannot overwrite a replacement session", async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, "old-token");
    const started = deferred<void>();
    const finish = deferred<void>();
    let callbacks = 0;
    api.defaults.adapter = async (config) => {
        assert.equal(config.headers.get("Authorization"), "Bearer old-token");
        started.resolve();
        await finish.promise;
        return response(config, 200, { data: user });
    };
    const pending = restoreSession((token, signal) => authApi.me(signal, token), new AbortController().signal, () => { callbacks += 1; });
    await started.promise;
    sessionStorage.setItem(AUTH_TOKEN_KEY, "new-token");
    finish.resolve();
    await pending;

    assert.equal(callbacks, 0);
    assert.equal(sessionStorage.getItem(AUTH_TOKEN_KEY), "new-token");
});

test("cancelled restoration does not show an outage or clear credentials", async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, "valid-token");
    const started = deferred<void>();
    const finish = deferred<void>();
    const controller = new AbortController();
    let callbacks = 0;
    api.defaults.adapter = async (config) => {
        started.resolve();
        await finish.promise;
        return response(config, 503);
    };
    const pending = restoreSession((token, signal) => authApi.me(signal, token), controller.signal, () => { callbacks += 1; });
    await started.promise;
    controller.abort();
    finish.resolve();
    await pending;

    assert.equal(callbacks, 0);
    assert.equal(sessionStorage.getItem(AUTH_TOKEN_KEY), "valid-token");
});
