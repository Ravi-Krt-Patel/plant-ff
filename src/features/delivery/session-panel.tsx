"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { apiRequest, errorMessage } from "./api";
import { sessionSchema, type Session } from "./contracts";
export function SessionPanel({
  onChange,
}: {
  onChange?: (session: Session | null) => void;
}) {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [phone, setPhone] = useState(""),
    [code, setCode] = useState(""),
    [challenge, setChallenge] = useState(""),
    [delivery, setDelivery] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    apiRequest("/auth/session", sessionSchema, { signal: controller.signal })
      .then((s) => {
        setSession(s);
        onChange?.(s);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [onChange]);
  async function requestCode() {
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError("Enter a 10-digit Indian mobile number.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await apiRequest(
        "/auth/otp/request",
        z.object({ challengeId: z.string(), delivery: z.string() }),
        { method: "POST", body: { phone } },
      );
      setChallenge(r.challengeId);
      setDelivery(r.delivery);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    setBusy(true);
    setError("");
    try {
      await apiRequest(
        "/auth/otp/verify",
        z.object({
          csrfToken: z.string(),
          user: z.object({ id: z.string(), role: z.string() }),
        }),
        { method: "POST", body: { challengeId: challenge, code } },
      );
      const s = await apiRequest("/auth/session", sessionSchema);
      setSession(s);
      setCode("");
      setChallenge("");
      onChange?.(s);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await apiRequest("/auth/logout", z.object({ signedOut: z.boolean() }), {
        method: "POST",
        body: {},
      });
      setSession(null);
      onChange?.(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel delivery-session" aria-label="Account sign in">
      <h2>{session?.userId ? "You’re signed in" : "Save your doorsteps"}</h2>
      {loading ? (
        <p role="status">Checking your session…</p>
      ) : session?.userId ? (
        <>
          <p>
            Your saved addresses are available across visits while signed in.
          </p>
          <button
            type="button"
            className="button secondary"
            onClick={logout}
            disabled={busy}
          >
            Sign out
          </button>
        </>
      ) : (
        <>
          <p>
            Verify your mobile number to save and manage addresses. You can also
            check out as a guest.
          </p>
          <div className="delivery-inline">
            <label>
              Mobile number
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="numeric"
                autoComplete="tel"
                maxLength={10}
                disabled={busy}
              />
            </label>
            <button
              type="button"
              className="button secondary"
              onClick={requestCode}
              disabled={busy}
            >
              {challenge ? "Request another code" : "Get verification code"}
            </button>
          </div>
          {challenge && (
            <>
              <label>
                Verification code
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                />
              </label>
              {delivery === "local_outbox" && (
                <p className="message">
                  Local development: no SMS was sent. Read this challenge with
                  the backend’s <code>pnpm dev:otp {challenge}</code> command.
                </p>
              )}
              <button
                type="button"
                className="button"
                onClick={verify}
                disabled={busy || code.length !== 6}
              >
                Verify and sign in
              </button>
            </>
          )}
        </>
      )}
      {error && (
        <p className="error-text message" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
