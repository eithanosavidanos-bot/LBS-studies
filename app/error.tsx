"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="authwrap">
      <div className="gatecard">
        <div className="eyebrow">Something went wrong</div>
        <h2>This page couldn&apos;t load.</h2>
        <p className="muted" style={{ margin: 0 }}>Try again in a moment.</p>
        <button className="btn primary" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
