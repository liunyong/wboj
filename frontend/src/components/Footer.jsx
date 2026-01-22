import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer className="app-footer">
      <div className="app-footer__content">
        <div className="app-footer__brand">
          <h2 className="app-footer__title">WB Online Judge</h2>
          <p className="app-footer__description">
            WBOJ provides coding practice, algorithm problems, and competitive programming tools
            with Judge0-powered execution.
          </p>
        </div>
        <div className="app-footer__links">
          <nav className="app-footer__nav" aria-label="Footer">
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
          </nav>
          <div className="app-footer__support">
            Support: <a href="mailto:liunyong@gmail.com">liunyong@gmail.com</a>
          </div>
        </div>
      </div>
      <div className="app-footer__bottom">© 2026 WBOJ. All rights reserved.</div>
    </footer>
  );
}

export default Footer;
