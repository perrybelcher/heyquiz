"use client";
import { useEffect, useRef, useState } from "react";
type Turnstile = {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
    },
  ) => string;
  remove: (id: string) => void;
};
export default function Challenge({
  onChange,
}: {
  onChange: (v: unknown) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    callback = useRef(onChange);
  const [error, setError] = useState("");
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);
  useEffect(() => {
    let id: string | undefined,
      cancelled = false;
    const target = window as Window & { turnstile?: Turnstile };
    async function mount() {
      const cfg = await (await fetch("/api/config")).json();
      if (!cfg.turnstileSiteKey) {
        setError(
          "The quiz owner needs to configure the security challenge before this quiz can be used.",
        );
        return;
      }
      if (!target.turnstile)
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src =
            "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Challenge could not load."));
          document.head.append(script);
        });
      if (!cancelled && ref.current && target.turnstile)
        id = target.turnstile.render(ref.current, {
          sitekey: cfg.turnstileSiteKey,
          callback: (v) => callback.current(v),
          "expired-callback": () => callback.current(undefined),
        });
    }
    void mount().catch(() =>
      setError("The security challenge could not load. Please refresh."),
    );
    return () => {
      cancelled = true;
      if (id) target.turnstile?.remove(id);
    };
  }, []);
  return (
    <div>
      <div ref={ref} />
      {error && (
        <p role="alert" className="hq-error">
          {error}
        </p>
      )}
    </div>
  );
}
