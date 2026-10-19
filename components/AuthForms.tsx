"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { redeemCode, sendMagicLink, signIn, signUp, type FormState } from "@/lib/actions/auth";

// React resets uncontrolled fields after every form action. Controlled fields
// keep what the student typed when the server answers with an error.
function useField(initial = "") {
  const [value, setValue] = useState(initial);
  return { value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value) };
}

function Message({ state }: { state: FormState }) {
  if (state.error) return <div className="msg err" role="alert">{state.error}</div>;
  if (state.info) return <div className="msg info" role="status">{state.info}</div>;
  return null;
}

export function SignUpForm({ codeExample }: { codeExample: string }) {
  const [state, action, pending] = useActionState(signUp, {});
  const code = useField();
  const name = useField();
  const email = useField();
  const password = useField();
  return (
    <form className="gatecard" action={action}>
      <div className="eyebrow">Create your account</div>
      <h2>Enter your access code</h2>
      <p className="muted" style={{ margin: 0 }}>
        Your course owner gave you a personal code. It works once, for one person: after you use it, it&apos;s tied
        to your account and nobody else can use it.
      </p>
      <div className="field">
        <label htmlFor="code">Access code</label>
        <input {...code} id="code" name="code" className="codein" autoComplete="off" spellCheck={false} placeholder={codeExample} required />
      </div>
      <div className="field">
        <label htmlFor="name">Your name</label>
        <input {...name} id="name" name="name" autoComplete="name" placeholder="First and last name" required maxLength={80} />
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input {...email} id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input {...password} id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
        <small>At least 10 characters.</small>
      </div>
      <Message state={state} />
      <button className="btn primary" disabled={pending}>{pending ? "Checking code…" : "Create account"}</button>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        Already have an account? <Link className="link" href="/login">Sign in</Link>
      </p>
    </form>
  );
}

export function SignInForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action, pending] = useActionState(signIn, {});
  const email = useField();
  const password = useField();
  const [linkState, linkAction, linkPending] = useActionState(sendMagicLink, {});
  return (
    <form className="gatecard" action={action}>
      <div className="eyebrow">Sign in</div>
      <h2>Welcome back</h2>
      {notice && <div className="msg info">{notice}</div>}
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="email">Email</label>
        <input {...email} id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input {...password} id="password" name="password" type="password" autoComplete="current-password" />
      </div>
      <Message state={state} />
      <Message state={linkState} />
      <div className="row">
        <button className="btn primary" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
        <button className="btn" formAction={linkAction} formNoValidate disabled={linkPending}>
          {linkPending ? "Sending…" : "Email me a sign-in link"}
        </button>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        New here? <Link className="link" href="/signup">Create an account with your access code</Link>
      </p>
    </form>
  );
}

export function RedeemForm({ name, reason, codeExample }: { name: string | null; reason: string; codeExample: string }) {
  const [state, action, pending] = useActionState(redeemCode, {});
  const code = useField();
  const nameField = useField();
  return (
    <form className="gatecard" action={action}>
      <div className="eyebrow">Access code</div>
      <h2>Enter an access code</h2>
      <p className="muted" style={{ margin: 0 }}>{reason}</p>
      <div className="field">
        <label htmlFor="code">Access code</label>
        <input {...code} id="code" name="code" className="codein" autoComplete="off" spellCheck={false} placeholder={codeExample} required />
      </div>
      {!name && (
        <div className="field">
          <label htmlFor="name">Your name</label>
          <input {...nameField} id="name" name="name" autoComplete="name" required maxLength={80} />
        </div>
      )}
      <Message state={state} />
      <button className="btn primary" disabled={pending}>{pending ? "Checking code…" : "Unlock"}</button>
    </form>
  );
}
