import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import prisma from "../config/prisma.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import type { Cliente } from "../generated/index.js";
import { sendTemplateEmail, getEmpresaConfig } from "./EmailService.js";
import { Bienvenida } from "../emails/templates/Bienvenida.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

export async function googleLogin(
  credential: string
): Promise<{ user: Omit<Cliente, "password">; token: string; isNew: boolean }> {
  if (!googleClient || !GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_OAUTH_NOT_CONFIGURED");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new Error("GOOGLE_TOKEN_INVALID");
  }

  const googleId = payload.sub;
  const email = payload.email;
  const name = payload.name || "";
  const givenName = payload.given_name;
  const familyName = payload.family_name;

  let user = await prisma.cliente.findFirst({
    where: { OR: [{ googleId }, { correo: email }] },
  });

  let isNew = false;

  if (user) {
    if (!user.googleId) {
      user = await prisma.cliente.update({
        where: { id: user.id },
        data: { googleId },
      });
    }
  } else {
    const nameParts = name.split(" ");
    const nombre = givenName || nameParts[0] || email.split("@")[0] || "Usuario";
    const apellido = familyName || nameParts.slice(1).join(" ") || "Google";
    const dummyPassword = await bcrypt.hash(crypto.randomUUID(), 10);

    user = await prisma.cliente.create({
      data: {
        googleId,
        nombre,
        apellido,
        cedula: `google_${googleId.slice(0, 10)}`,
        correo: email,
        password: dummyPassword,
      },
    });
    isNew = true;
  }

  const { password: _, ...safeUser } = user;

  if (isNew) {
    sendTemplateEmail(email, "Bienvenido a Globy", Bienvenida, {
      clienteNombre: name || email.split("@")[0],
      empresaConfig: await getEmpresaConfig(),
    }).catch((err) => console.error("[Email] Error enviando bienvenida:", err.message));
  }

  const token = jwt.sign(
    { id: user.id, rol: "cliente", correo: user.correo },
    JWT_SECRET,
    { expiresIn: "24h" }
  );

  return { user: safeUser, token, isNew };
}
