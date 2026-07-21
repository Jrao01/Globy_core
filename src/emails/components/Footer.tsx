import { Section, Text, Hr } from "@react-email/components";

interface FooterProps {
  nombreEmpresa: string;
  direccionFiscal: string;
  telefono?: string;
}

export const Footer = ({ nombreEmpresa, direccionFiscal, telefono }: FooterProps) => (
  <Section style={{ padding: "20px 32px" }}>
    <Hr style={{ borderColor: "#e5e7eb", margin: "0 0 16px" }} />
    <Text
      style={{
        color: "#6b7280",
        fontSize: "12px",
        lineHeight: "1.5",
        margin: "0 0 4px",
        textAlign: "center",
      }}
    >
      {nombreEmpresa} &mdash; {direccionFiscal}
    </Text>
    {telefono && (
      <Text
        style={{
          color: "#6b7280",
          fontSize: "12px",
          margin: "0 0 4px",
          textAlign: "center",
        }}
      >
        Tel: {telefono}
      </Text>
    )}
    <Text
      style={{
        color: "#9ca3af",
        fontSize: "11px",
        margin: "8px 0 0",
        textAlign: "center",
      }}
    >
      &copy; {new Date().getFullYear()} {nombreEmpresa}. Todos los derechos reservados.
    </Text>
  </Section>
);
