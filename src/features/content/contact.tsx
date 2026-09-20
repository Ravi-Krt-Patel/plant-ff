"use client";
import { useState } from "react";
export default function Contact() {
  const [sent, setSent] = useState(false);
  return (
    <div className="page wrap">
      <div className="article">
        <p className="eyebrow">LET’S GROW A CONVERSATION</p>
        <h1>A little help, a little hello.</h1>
        <p>
          Try our sample contact form. Business contact information has not been
          supplied; this demo does not send email.
        </p>
        {sent ? (
          <div className="panel">
            <h2>Your demo message is noted.</h2>
            <p>Simulated submission only — nothing was sent or stored.</p>
            <button className="button secondary" onClick={() => setSent(false)}>
              Try another message
            </button>
          </div>
        ) : (
          <form
            className="panel form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
          >
            <label>
              Your demo name
              <input required minLength={2} />
            </label>
            <label>
              Fictional email
              <input
                type="email"
                required
                placeholder="plantlover@example.com"
              />
            </label>
            <label className="span-2">
              How can we help?
              <textarea required minLength={10} rows={5} />
            </label>
            <button className="button span-2">
              Simulate message submission →
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
