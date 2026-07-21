import nodemailer from "nodemailer";
import prisma from "../config/prisma.js";
import { renderEmailComponent } from "../emails/renderEmail.js";
import type { ComponentType } from "react";
import type { EmpresaConfigInfo } from "../emails/types.js";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const getEmpresaConfig = async (): Promise<EmpresaConfigInfo> => {
  const config = await prisma.empresaConfig.findFirst();
  return {
    nombreEmpresa: config?.nombreEmpresa || "Globy",
    rif: config?.rif || "00000000",
    direccionFiscal: config?.direccionFiscal || "",
    telefono: config?.telefono || undefined,
    logoUrl: config?.logoUrl || undefined,
    colorPrimario: config?.colorPrimario || "#5713be",
  };
};

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

export const sendTemplateEmail = async <T extends Record<string, unknown>>(
  to: string,
  subject: string,
  Template: ComponentType<T>,
  props: T,
) => {
  const html = await renderEmailComponent(Template, props);
  await sendEmail({ to, subject, html });
};
