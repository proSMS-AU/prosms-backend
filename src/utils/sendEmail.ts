/* eslint-disable @typescript-eslint/no-explicit-any */
import { Resend } from "resend";
import config from "config";
import path from "path";
import ejs from "ejs";
import { logger } from "./logger";

interface ISendEmailOptions {
  to: string;
  subject: string;
  templateName: string;
  templateData: Record<string, any>;
  attachments?: {
    filename: string;
    content: string;
    type: string;
    disposition?: "attachment" | "inline";
  }[];
  // Kept for backward compatibility with existing callers (SendGrid metadata).
  // Resend has no direct equivalent, so these are accepted but not forwarded.
  categories?: string[];
  customArgs?: Record<string, string>;
}

interface IResendConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

class EmailService {
  private isInitialized = false;
  private client: Resend | null = null;

  constructor() {
    this.initialize();
  }

  private getConfig(): IResendConfig {
    return config.get<IResendConfig>("resend");
  }

  private fromAddress(): string {
    const { fromEmail, fromName } = this.getConfig();
    return fromName ? `${fromName} <${fromEmail}>` : fromEmail;
  }

  private renderAttachments(attachments?: ISendEmailOptions["attachments"]) {
    if (!attachments?.length) return undefined;
    return attachments.map((a) => ({
      filename: a.filename,
      content: a.content, // base64 string or raw content
      contentType: a.type
    }));
  }

  private initialize(): void {
    try {
      const resendConfig = this.getConfig();

      if (!resendConfig.apiKey) {
        throw new Error("Resend API key is not configured");
      }

      if (!resendConfig.fromEmail) {
        throw new Error("Resend from email is not configured");
      }

      this.client = new Resend(resendConfig.apiKey);
      this.isInitialized = true;

      logger.info("Resend email service initialized successfully", {
        fromEmail: resendConfig.fromEmail,
        fromName: resendConfig.fromName
      });
    } catch (error) {
      logger.error("Failed to initialize Resend email service", {
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  async sendEmail({ to, subject, templateName, templateData, attachments }: ISendEmailOptions): Promise<void> {
    if (!this.isInitialized || !this.client) {
      throw new Error("Email service is not initialized");
    }

    let html: string;
    try {
      const templatePath = path.join(__dirname, `../templates/${templateName}.ejs`);
      html = await ejs.renderFile(templatePath, templateData);
    } catch (error: any) {
      if (error.code === "ENOENT") {
        logger.error("Email template not found", {
          templateName,
          templatePath: path.join(__dirname, `../templates/${templateName}.ejs`),
          to,
          subject
        });
        throw new Error(`Email template '${templateName}' not found`);
      }
      throw error;
    }

    const { data, error } = await this.client.emails.send({
      from: this.fromAddress(),
      to,
      subject,
      html,
      ...(attachments && { attachments: this.renderAttachments(attachments) })
    });

    if (error) {
      logger.error("Failed to send email via Resend", {
        to,
        subject,
        templateName,
        name: (error as any).name,
        message: (error as any).message
      });
      throw new Error(`Resend: ${(error as any).message ?? "failed to send email"}`);
    }

    logger.info("Email sent successfully via Resend", {
      id: data?.id,
      to,
      subject,
      templateName
    });
  }

  async sendBulkEmail(recipients: string[], options: Omit<ISendEmailOptions, "to">): Promise<void> {
    if (!this.isInitialized || !this.client) {
      throw new Error("Email service is not initialized");
    }

    let html: string;
    try {
      const templatePath = path.join(__dirname, `../templates/${options.templateName}.ejs`);
      html = await ejs.renderFile(templatePath, options.templateData);
    } catch (error: any) {
      if (error.code === "ENOENT") {
        throw new Error(`Email template '${options.templateName}' not found`);
      }
      throw error;
    }

    const { data, error } = await this.client.emails.send({
      from: this.fromAddress(),
      to: recipients,
      subject: options.subject,
      html,
      ...(options.attachments && {
        attachments: this.renderAttachments(options.attachments)
      })
    });

    if (error) {
      logger.error("Failed to send bulk email via Resend", {
        recipientCount: recipients.length,
        subject: options.subject,
        templateName: options.templateName,
        message: (error as any).message
      });
      throw new Error(`Failed to send bulk email: ${(error as any).message}`);
    }

    logger.info("Bulk email sent successfully via Resend", {
      id: data?.id,
      recipientCount: recipients.length,
      subject: options.subject,
      templateName: options.templateName
    });
  }

  async verifyConnection(): Promise<boolean> {
    return this.isInitialized;
  }
}

// Export singleton instance
export const emailService = new EmailService();

// Backward compatibility - export the sendEmail function
export const sendEmail = emailService.sendEmail.bind(emailService);
