/* eslint-disable @typescript-eslint/no-explicit-any */
import sgMail, { MailDataRequired } from "@sendgrid/mail";
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
  categories?: string[];
  customArgs?: Record<string, string>;
}

interface ISendGridConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

class EmailService {
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    try {
      // Get config
      const sendGridConfig = config.get<ISendGridConfig>("sendgrid");

      if (!sendGridConfig.apiKey) {
        throw new Error("SendGrid API key is not configured");
      }

      if (!sendGridConfig.fromEmail) {
        throw new Error("SendGrid from email is not configured");
      }

      sgMail.setApiKey(sendGridConfig.apiKey);
      this.isInitialized = true;

      logger.info("SendGrid email service initialized successfully", {
        fromEmail: sendGridConfig.fromEmail,
        fromName: sendGridConfig.fromName
      });
    } catch (error) {
      logger.error("Failed to initialize SendGrid email service", {
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  async sendEmail({
    to,
    subject,
    templateName,
    templateData,
    attachments,
    categories,
    customArgs
  }: ISendEmailOptions): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Email service is not initialized");
    }

    try {
      // Render EJS template
      const templatePath = path.join(__dirname, `../templates/${templateName}.ejs`);
      const html = await ejs.renderFile(templatePath, templateData);

      const sendGridConfig = config.get<ISendGridConfig>("sendgrid");

      const msg: MailDataRequired = {
        to,
        from: {
          email: sendGridConfig.fromEmail,
          name: sendGridConfig.fromName
        },
        subject,
        html,
        ...(attachments && { attachments }),
        ...(categories && { categories }),
        ...(customArgs && { customArgs }),
        trackingSettings: {
          clickTracking: { enable: true },
          openTracking: { enable: true }
        }
      };

      const [response] = await sgMail.send(msg);

      logger.info("Email sent successfully via SendGrid", {
        statusCode: response.statusCode,
        to,
        subject,
        templateName,
        messageId: response.headers["x-message-id"]
      });
    } catch (error: any) {
      // Handle EJS rendering errors
      if (error.code === "ENOENT") {
        logger.error("Email template not found", {
          templateName,
          templatePath: path.join(__dirname, `../templates/${templateName}.ejs`),
          to,
          subject
        });
        throw new Error(`Email template '${templateName}' not found`);
      }

      // SendGrid specific error handling
      if (error.code) {
        const errorDetails = {
          to,
          subject,
          templateName,
          statusCode: error.code,
          message: error.message,
          response: error.response?.body
        };

        logger.error("Failed to send email via SendGrid", errorDetails);

        if (error.code === 401) {
          throw new Error("SendGrid authentication failed. Please check API key.");
        } else if (error.code === 403) {
          throw new Error("SendGrid: Forbidden. Check sender verification and permissions.");
        } else if (error.code === 413) {
          throw new Error("Email payload too large. Consider reducing attachments.");
        } else if (error.code >= 500) {
          throw new Error("SendGrid service is temporarily unavailable. Please try again later.");
        }
      }

      logger.error("An error occurred while sending email", {
        error: error instanceof Error ? error.message : error,
        to,
        subject,
        templateName
      });

      throw error;
    }
  }

  async sendBulkEmail(recipients: string[], options: Omit<ISendEmailOptions, "to">): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Email service is not initialized");
    }

    try {
      const templatePath = path.join(__dirname, `../templates/${options.templateName}.ejs`);
      const html = await ejs.renderFile(templatePath, options.templateData);

      const sendGridConfig = config.get<ISendGridConfig>("sendgrid");

      const msg: MailDataRequired = {
        to: recipients,
        from: {
          email: sendGridConfig.fromEmail,
          name: sendGridConfig.fromName
        },
        subject: options.subject,
        html,
        ...(options.attachments && { attachments: options.attachments }),
        ...(options.categories && { categories: options.categories }),
        ...(options.customArgs && { customArgs: options.customArgs }),
        trackingSettings: {
          clickTracking: { enable: true },
          openTracking: { enable: true }
        }
      };

      const [response] = await sgMail.send(msg);

      logger.info("Bulk email sent successfully via SendGrid", {
        statusCode: response.statusCode,
        recipientCount: recipients.length,
        subject: options.subject,
        templateName: options.templateName
      });
    } catch (error: any) {
      logger.error("Failed to send bulk email via SendGrid", {
        recipientCount: recipients.length,
        subject: options.subject,
        templateName: options.templateName,
        error: error.message,
        response: error.response?.body
      });

      throw new Error(`Failed to send bulk email: ${error.message}`);
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      return this.isInitialized;
    } catch (error) {
      logger.error("SendGrid connection verification failed", {
        error: error instanceof Error ? error.message : error
      });
      return false;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();

// Backward compatibility - export the sendEmail function
export const sendEmail = emailService.sendEmail.bind(emailService);
