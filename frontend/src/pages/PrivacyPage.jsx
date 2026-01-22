function PrivacyPage() {
  return (
    <section className="page legal-page">
      <header className="page-header">
        <div>
          <h1>Privacy Policy</h1>
          <p className="page-updated">Last updated: 2026</p>
        </div>
      </header>

      <div className="legal-content">
        <section>
          <h2>Overview</h2>
          <p>
            This Privacy Policy explains how WBOJ collects and uses information. This content is a
            placeholder for formal legal text and will be updated later.
          </p>
        </section>

        <section>
          <h2>Information We Collect</h2>
          <ul>
            <li>Account details such as email address and display name.</li>
            <li>Submission data, including source code and execution results via Judge0.</li>
            <li>Usage data such as page visits and problem progress.</li>
          </ul>
        </section>

        <section>
          <h2>How We Use Information</h2>
          <ul>
            <li>Provide coding practice, scoring, and progress tracking.</li>
            <li>Maintain platform security and prevent abuse.</li>
            <li>Improve problem quality and platform performance.</li>
          </ul>
        </section>

        <section>
          <h2>Code Execution</h2>
          <p>
            Submissions are processed by Judge0. Execution results may be stored to show verdicts,
            runtime, and memory usage.
          </p>
        </section>

        <section>
          <h2>Data Retention</h2>
          <p>
            We retain account and submission data for educational and competitive programming
            purposes, unless a deletion request is approved.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            If you have privacy questions, email{' '}
            <a href="mailto:liunyong@gmail.com">liunyong@gmail.com</a>.
          </p>
        </section>
      </div>
    </section>
  );
}

export default PrivacyPage;
