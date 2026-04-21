import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy – TimeHarbor",
  description: "Privacy Policy for the TimeHarbor time tracking app.",
};

export default function PrivacyPolicyPage() {
  const effectiveDate = "April 21, 2026";

  return (
    <main className="privacy-policy-page">
      <div className="privacy-policy-container">
        <h1>Privacy Policy</h1>
        <p className="privacy-policy-effective-date">Effective date: {effectiveDate}</p>

        <section>
          <p>
            TimeHarbor (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;the app&rdquo;) is an
            open-source, offline-first time tracking application developed by MIEWeb. This policy
            describes exactly what data the app stores, where it is stored, and how it is used. We
            only describe what the app actually does — nothing more.
          </p>
        </section>

        <section>
          <h2>1. No Account Required</h2>
          <p>
            TimeHarbor does not require you to create an account, provide an email address, or set
            a password. Your identity is a randomly generated UUID created on your device the first
            time you open the app. This UUID is stored only in your browser&rsquo;s local storage
            and is never linked to your real name or contact information by the server.
          </p>
        </section>

        <section>
          <h2>2. Data You Create — Stored Locally</h2>
          <p>
            All time entries, work sessions, tickets, projects, and notes you create are stored
            locally on your device using IndexedDB (via Dexie.js). This data never leaves your
            device unless you explicitly enable sync (see Section 3). You can clear all local data
            at any time from <strong>Settings &rarr; Clear Local Data</strong>.
          </p>
          <p>
            The following preferences are stored in your browser&rsquo;s local storage:
          </p>
          <ul>
            <li>Theme preference (light / dark / system)</li>
            <li>Walkthrough completion flag</li>
            <li>App lock preference and hashed PIN (if set)</li>
            <li>Biometric credential identifier (if biometric lock is enabled)</li>
            <li>Your encryption passphrase (used to derive your sync key on this device)</li>
          </ul>
          <p>
            None of this data is transmitted to our servers.
          </p>
        </section>

        <section>
          <h2>3. Encrypted Sync (Optional)</h2>
          <p>
            If you choose to enable sync, your data is serialised, encrypted on-device using
            AES-256-GCM, and then transmitted to our relay server. The server stores only opaque
            encrypted blobs. It cannot read, search, or modify the content of your data.
          </p>
          <p>
            The server stores the following metadata alongside each encrypted batch:
          </p>
          <ul>
            <li>Your identity UUID (not linked to your name or email)</li>
            <li>A device identifier (randomly generated per device)</li>
            <li>A logical clock value (used for ordering batches)</li>
            <li>A count of entries in the batch</li>
            <li>The date the batch was uploaded</li>
          </ul>
          <p>
            Your encryption key is derived from your passphrase and never leaves your device.
            Losing your passphrase and recovery key means permanent, unrecoverable data loss — we
            have no ability to decrypt or restore your data.
          </p>
        </section>

        <section>
          <h2>4. Profile Information (Optional)</h2>
          <p>
            If you choose to set up a public profile, the following information is stored on our
            server and may be visible to others you share your profile link with:
          </p>
          <ul>
            <li>Display name (chosen by you)</li>
            <li>Profile photo / avatar (uploaded by you)</li>
            <li>Optional public URLs you provide: GitHub, LinkedIn, Redmine</li>
            <li>Online/offline status and last-seen timestamp</li>
          </ul>
          <p>
            All profile fields are optional and can be left blank or removed at any time.
          </p>
        </section>

        <section>
          <h2>5. Push Notifications (Optional, Native App Only)</h2>
          <p>
            On the iOS and Android apps, if you grant notification permission, the app registers a
            device push token (FCM on Android, APNs on iOS) with our server. This token is stored
            in your profile record and used solely to deliver notifications triggered by your own
            app activity. You can revoke permission at any time in your device&rsquo;s system
            settings.
          </p>
          <p>
            Push notifications are not available on the web version of the app.
          </p>
        </section>

        <section>
          <h2>6. Session Metadata</h2>
          <p>
            When your device communicates with our server, standard HTTP metadata is recorded in
            server sessions: your IP address and user-agent string. This information is used solely
            to maintain your session and is not shared with third parties or used for tracking.
          </p>
        </section>

        <section>
          <h2>7. No Analytics or Advertising</h2>
          <p>
            We do not use any third-party analytics, crash-reporting, advertising, or tracking
            SDKs. No behavioral data, advertising identifiers, or fingerprinting is collected or
            shared.
          </p>
        </section>

        <section>
          <h2>8. Data Retention &amp; Deletion</h2>
          <p>
            You can purge all encrypted sync data from our server at any time from{" "}
            <strong>Settings &rarr; Encryption &rarr; Regenerate Key</strong>, which wipes all
            server-side batches. Local data can be cleared from{" "}
            <strong>Settings &rarr; Clear Local Data</strong>.
          </p>
          <p>
            We do not currently apply an automatic expiry to encrypted batches on the server. No
            data is sold or transferred to third parties under any circumstances.
          </p>
        </section>

        <section>
          <h2>9. Open Source</h2>
          <p>
            TimeHarbor is fully open source. You can inspect the exact code that runs in this app,
            including all data handling, on our{" "}
            <a
              href="https://github.com/mieweb/TimeharborApp"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub repository
            </a>
            . You can also self-host the backend server so that no data ever leaves your own
            infrastructure.
          </p>
        </section>

        <section>
          <h2>10. Children&rsquo;s Privacy</h2>
          <p>
            TimeHarbor is not directed at children under 13. We do not knowingly collect personal
            information from children.
          </p>
        </section>

        <section>
          <h2>11. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. The effective date at the top of this page
            will reflect the most recent revision. Continued use of the app after changes
            constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2>12. Contact</h2>
          <p>
            If you have questions about this policy, please open an issue on our{" "}
            <a
              href="https://github.com/mieweb/TimeharborApp"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub repository
            </a>{" "}
            or contact us at{" "}
            <a href="mailto:support@mieweb.com">support@mieweb.com</a> or{" "}
            <a href="mailto:dharamkarpoonam9@gmail.com">dharamkarpoonam9@gmail.com</a>.
          </p>
        </section>
      </div>

      <style>{`
        .privacy-policy-page {
          min-height: 100vh;
          background: var(--background, #fff);
          color: var(--foreground, #111);
          padding: 2rem 1rem 4rem;
        }
        .privacy-policy-container {
          max-width: 760px;
          margin: 0 auto;
          font-family: system-ui, sans-serif;
          line-height: 1.7;
        }
        .privacy-policy-container h1 {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.25rem;
        }
        .privacy-policy-effective-date {
          color: #666;
          font-size: 0.9rem;
          margin-bottom: 2rem;
        }
        .privacy-policy-container h2 {
          font-size: 1.15rem;
          font-weight: 600;
          margin-top: 2rem;
          margin-bottom: 0.5rem;
        }
        .privacy-policy-container p {
          margin: 0 0 1rem;
        }
        .privacy-policy-container ul {
          margin: 0 0 1rem 1.5rem;
        }
        .privacy-policy-container li {
          margin-bottom: 0.25rem;
        }
        .privacy-policy-container a {
          color: #2563eb;
          text-decoration: underline;
        }
      `}</style>
    </main>
  );
}
