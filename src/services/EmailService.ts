import nodemailer from "nodemailer";
import prisma from "../config/prisma.js";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

const getTransporter = async () => {
  const config = await prisma.empresaConfig.findFirst();
  if (!config?.smtpHost || !config?.smtpUser || !config?.smtpPass) {
    throw new Error("SMTP_NO_CONFIGURED");
  }
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort || 587,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });
};

export const sendEmail = async (options: EmailOptions) => {
  const config = await prisma.empresaConfig.findFirst();
  const transporter = await getTransporter();
  await transporter.sendMail({
    from: `"${config?.nombreEmpresa || "Globy"}" <${config?.smtpUser}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
};
