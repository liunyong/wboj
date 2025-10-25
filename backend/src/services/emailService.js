import nodemailer from 'nodemailer';

import { SMTP_FROM, SMTP_HOST, SMTP_PASS, SMTP_PORT, SMTP_USER } from '../config/email.js';

let transporter = null;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: Number.isInteger(SMTP_PORT) && SMTP_PORT === 465,
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
  });

  return transporter;
};

export const sendEmail = async ({ to, subject, text, html }) => {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('[email] transport not configured; skipping send', { to, subject });
    return { accepted: [], rejected: [to], skipped: true };
  }

  const message = {
    from: SMTP_FROM || SMTP_USER,
    to,
    subject,
    text,
    html
  };

  const mailer = getTransporter();
  return mailer.sendMail(message);
};

export default sendEmail;
