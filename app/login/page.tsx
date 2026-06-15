"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { USER_PROFILES } from "@/lib/users";

type LoginAs = "employee" | "brand";

const errorMessages: Record<string, string> = {
  OAuthSignin:
    "Google sign-in could not start. Make sure the dev server has internet access, then try again.",
  OAuthCallback:
    "Google returned an invalid callback. Check the OAuth redirect URI and try again.",
  AccessDenied:
    "Google blocked sign-in because this account is not added as a test user on the Cloutwatch Google Cloud project. Add your Gmail under OAuth consent screen → Test users, then try again.",
  access_denied:
    "Google blocked sign-in because this account is not added as a test user on the Cloutwatch Google Cloud project. Add your Gmail under OAuth consent screen → Test users, then try again.",
  WrongAccountType:
    "This Google account cannot sign in with the role you selected. Try Employee or Brand with an allowed account.",
};

function GoogleLogo() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.24 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </svg>
  );
}

function RoleChoiceButton({
  title,
  description,
  accentClass,
  onClick,
}: {
  title: string;
  description: string;
  accentClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full rounded-xl border border-border-subtle bg-bg-card px-5 py-4 text-left transition-all",
        "hover:border-green-dim hover:shadow-[0_0_22px_rgba(13,204,78,0.18)]",
      ].join(" ")}
    >
      <span
        className={[
          "font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em]",
          accentClass,
        ].join(" ")}
      >
        {title}
      </span>
      <p className="mt-2 text-sm leading-6 text-grey-300">{description}</p>
    </button>
  );
}

function LoginPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const loginAsParam = searchParams.get("as");
  const loginAs =
    loginAsParam === "employee" || loginAsParam === "brand"
      ? loginAsParam
      : null;
  const error = searchParams.get("error");
  const errorMessage = error
    ? (errorMessages[error] ?? "Sign-in failed. Please try again.")
    : "";
  const [isSigningIn, setIsSigningIn] = useState(false);
  const allowedEmails = Object.keys(USER_PROFILES);
  const googleCloudConsentUrl =
    "https://console.cloud.google.com/apis/credentials/consent";

  const chooseRole = (role: LoginAs) => {
    router.push(`/login?as=${role}`);
  };

  const goBack = () => {
    router.push("/login");
  };

  const handleGoogleSignIn = async () => {
    if (!loginAs || isSigningIn) {
      return;
    }

    setIsSigningIn(true);

    try {
      const response = await fetch("/api/auth/login-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginAs }),
      });

      if (!response.ok) {
        throw new Error("Could not prepare sign-in.");
      }

      const callbackUrl =
        loginAs === "brand" ? "/brand-portal" : "/roi-analyzer";

      await signIn("google", { callbackUrl });
    } catch {
      setIsSigningIn(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-base p-6">
      <section className="w-full max-w-md rounded-2xl border border-border-subtle bg-bg-surface p-8 text-center shadow-[0_0_40px_rgba(26,255,102,0.08)]">
        <h1 className="font-mono text-3xl font-bold uppercase tracking-[0.2em] text-green-primary [text-shadow:0_0_28px_rgba(26,255,102,0.32)]">
          ⬡ CLOUTWATCH
        </h1>
        <p className="mt-4 text-sm text-grey-500">
          Creator Investment Intelligence Platform
        </p>

        {!loginAs ? (
          <>
            <p className="mt-8 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-grey-500">
              Choose how you sign in
            </p>
            <div className="mt-4 space-y-3">
              <RoleChoiceButton
                title="Employee"
                description="Access ROI analysis, meeting notes, agents, and internal tools."
                accentClass="text-green-primary"
                onClick={() => chooseRole("employee")}
              />
              <RoleChoiceButton
                title="Brand"
                description="View your brand portal, performance updates, and weekly digests."
                accentClass="text-amber-warn"
                onClick={() => chooseRole("brand")}
              />
            </div>
          </>
        ) : (
          <>
            <div className="mt-8 rounded-xl border border-border-subtle bg-bg-card px-4 py-3">
              <p className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-grey-500">
                Signing in as
              </p>
              <p
                className={[
                  "mt-1 font-mono text-sm font-semibold uppercase tracking-[0.12em]",
                  loginAs === "brand" ? "text-amber-warn" : "text-green-primary",
                ].join(" ")}
              >
                {loginAs === "brand" ? "Brand Client" : "Employee"}
              </p>
            </div>

            {errorMessage ? (
              <div className="mt-4 rounded-xl border border-red-flag/40 bg-red-flag/10 px-4 py-3 text-left text-sm leading-6 text-grey-100">
                <p>{errorMessage}</p>
                {error === "AccessDenied" || error === "access_denied" ? (
                  <div className="mt-3 space-y-2 text-xs leading-5 text-grey-300">
                    <p className="font-mono font-semibold uppercase tracking-[0.12em] text-grey-500">
                      Fix in Google Cloud
                    </p>
                    <ol className="list-decimal space-y-1 pl-4">
                      <li>
                        Open{" "}
                        <a
                          href={googleCloudConsentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-green-primary underline"
                        >
                          OAuth consent screen
                        </a>
                      </li>
                      <li>Add your Gmail under Test users</li>
                      <li>Save, wait 1–2 minutes, then sign in again</li>
                    </ol>
                    <p>
                      App-allowed emails: {allowedEmails.join(", ")}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              disabled={isSigningIn}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-border-subtle bg-bg-card px-4 py-3 text-sm font-semibold text-grey-100 transition-all hover:border-green-dim hover:shadow-[0_0_22px_rgba(13,204,78,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GoogleLogo />
              {isSigningIn ? "Redirecting..." : "Sign in with Google"}
            </button>

            <button
              type="button"
              onClick={goBack}
              className="mt-4 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-grey-500 transition-colors hover:text-green-primary"
            >
              ← Back to role selection
            </button>
          </>
        )}
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPanel />
    </Suspense>
  );
}
