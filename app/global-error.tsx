"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main style={{ fontFamily: "system-ui", padding: "3rem", textAlign: "center" }}>
          <h1>RISE is having trouble starting</h1>
          <p>Please try again.</p>
          <button onClick={() => reset()}>Try again</button>
        </main>
      </body>
    </html>
  );
}
