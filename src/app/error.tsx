"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="page wrap empty-state">
      <h1 className="page-title">A little hiccup.</h1>
      <p>Your saved bag is safe. Please try loading this page again.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
