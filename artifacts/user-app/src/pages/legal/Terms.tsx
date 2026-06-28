import { LegalLayout } from "@/components/LegalLayout";

export default function Terms() {
  return (
    <LegalLayout title="Terms of Service" updated="June 2026">
      <section>
        <h2>1. Acceptance of terms</h2>
        <p>
          By creating an account or using VIXUS AI (the "Service"), you
          agree to these Terms of Service. If you do not agree, do not use the
          Service.
        </p>
      </section>

      <section>
        <h2>2. Eligibility</h2>
        <p>
          You must be at least 18 years old and legally able to enter into a
          binding contract to use the Service. You are responsible for ensuring
          that your use complies with the laws of your jurisdiction.
        </p>
      </section>

      <section>
        <h2>3. Your account</h2>
        <ul>
          <li>You are responsible for keeping your login credentials secure.</li>
          <li>You agree to provide accurate, current, and complete information.</li>
          <li>You are responsible for all activity that occurs under your account.</li>
        </ul>
      </section>

      <section>
        <h2>4. Trading risk</h2>
        <p>
          Automated trading carries significant financial risk. The Service does
          not guarantee any profit, and you may lose some or all of your
          deposited funds. You trade at your own risk. Please review our Risk
          Disclosure carefully.
        </p>
      </section>

      <section>
        <h2>5. Deposits and withdrawals</h2>
        <p>
          You may fund your account using the supported payment methods. Withdrawal
          requests are processed subject to identity verification and applicable
          security checks. Processing times may vary by method.
        </p>
      </section>

      <section>
        <h2>6. Prohibited conduct</h2>
        <ul>
          <li>Using the Service for any unlawful purpose.</li>
          <li>Attempting to gain unauthorized access to the Service or other accounts.</li>
          <li>Interfering with or disrupting the integrity of the Service.</li>
        </ul>
      </section>

      <section>
        <h2>7. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, VIXUS AI is not liable
          for any indirect, incidental, or consequential damages arising from
          your use of the Service.
        </p>
      </section>

      <section>
        <h2>8. Changes to these terms</h2>
        <p>
          We may update these Terms from time to time. Continued use of the
          Service after changes take effect constitutes acceptance of the revised
          Terms.
        </p>
      </section>
    </LegalLayout>
  );
}
