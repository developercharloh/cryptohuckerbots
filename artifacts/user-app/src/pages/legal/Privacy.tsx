import { LegalLayout } from "@/components/LegalLayout";

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" updated="June 2026">
      <section>
        <h2>1. Information we collect</h2>
        <ul>
          <li>Account information such as your name and email address.</li>
          <li>Identity verification documents you choose to upload (KYC).</li>
          <li>Transaction and usage data generated while using the Service.</li>
          <li>Device and log information for security and diagnostics.</li>
        </ul>
      </section>

      <section>
        <h2>2. How we use your information</h2>
        <p>
          We use your information to operate and improve the Service, process
          transactions, verify your identity, prevent fraud, and communicate with
          you about your account.
        </p>
      </section>

      <section>
        <h2>3. How we protect your data</h2>
        <p>
          We use industry-standard safeguards, including encryption in transit
          and at rest, access controls, and two-factor authentication, to protect
          your information. No system is completely secure, but we work hard to
          keep your data safe.
        </p>
      </section>

      <section>
        <h2>4. Sharing your information</h2>
        <p>
          We do not sell your personal information. We may share data with trusted
          service providers who help us operate the Service, or when required by
          law.
        </p>
      </section>

      <section>
        <h2>5. Your rights</h2>
        <p>
          You may request access to, correction of, or deletion of your personal
          information by contacting us. We will respond in accordance with
          applicable law.
        </p>
      </section>

      <section>
        <h2>6. Contact</h2>
        <p>
          For privacy questions, contact us at{" "}
          <span className="text-primary">privacy@vixus.ai</span>.
        </p>
      </section>
    </LegalLayout>
  );
}
