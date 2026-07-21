import {
  Html,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Preview,
} from "@react-email/components";
import { Header } from "../components/Header.js";
import { Footer } from "../components/Footer.js";
import type { EmpresaConfigInfo } from "../types.js";

interface BienvenidaProps {
  clienteNombre?: string;
  empresaConfig?: EmpresaConfigInfo;
}

export const Bienvenida = ({ clienteNombre, empresaConfig }: BienvenidaProps) => {
  const nombre = clienteNombre || "Cliente";
  const { nombreEmpresa = "Globy", logoUrl, colorPrimario = "#5713be", direccionFiscal = "", telefono } = empresaConfig ?? {};

  return (
    <Html>
      <Preview>Bienvenido a {nombreEmpresa}, {nombre}</Preview>
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "Arial, sans-serif", margin: "0", padding: "0" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "20px 0" }}>
          <Header nombreEmpresa={nombreEmpresa} logoUrl={logoUrl} colorPrimario={colorPrimario} />

          <Section style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "0 0 8px 8px" }}>
            <Text style={{ fontSize: "16px", color: "#1f2937", margin: "0 0 16px" }}>
              Hola <strong>{nombre}</strong>,
            </Text>

            <Text style={{ fontSize: "15px", color: "#374151", lineHeight: "1.6", margin: "0 0 16px" }}>
              ¡Bienvenido a <strong>{nombreEmpresa}</strong>! Nos alegra mucho que te hayas registrado
              en nuestra plataforma. A partir de ahora podrás disfrutar de una experiencia de compra
              rápida, segura y totalmente pensada para ti.
            </Text>

            <Text style={{ fontSize: "15px", color: "#374151", lineHeight: "1.6", margin: "0 0 24px" }}>
              Explora nuestro catálogo de productos, descubre ofertas exclusivas y recibe tus pedidos
              directamente en la puerta de tu casa.
            </Text>

            <Hr style={{ borderColor: "#e5e7eb", margin: "0 0 16px" }} />

            <Text style={{ fontSize: "13px", color: "#6b7280", margin: "0" }}>
              Si tienes alguna pregunta, no dudes en responder a este correo o contactarnos por
              nuestros canales de atención.
            </Text>
          </Section>

          <Footer nombreEmpresa={nombreEmpresa} direccionFiscal={direccionFiscal} telefono={telefono} />
        </Container>
      </Body>
    </Html>
  );
};

export default Bienvenida;
