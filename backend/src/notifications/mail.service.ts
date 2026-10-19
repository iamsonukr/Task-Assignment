import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/** Sends via SMTP when configured; otherwise logs so the flow is visible in dev/demo. */
@Injectable()
export class MailService {
  private logger = new Logger('Mail');
  private transport = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587),
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
    : null;

  async send(to: string, subject: string, text: string) {
    if (!this.transport) { this.logger.log(`(SMTP not configured) email to ${to}: ${subject}`); return; }
    try { await this.transport.sendMail({ from: process.env.SMTP_FROM, to, subject, text }); }
    catch (e) { this.logger.error(`email failed: ${(e as Error).message}`); }
  }
}
