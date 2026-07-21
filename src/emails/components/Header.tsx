import { Section, Row, Column, Img, Heading, Text } from "@react-email/components";

interface HeaderProps {
  nombreEmpresa: string;
  logoUrl?: string;
  colorPrimario?: string;
}

export const Header = ({ nombreEmpresa, logoUrl, colorPrimario = "#5713be" }: HeaderProps) => (
  <Section
    style={{
      backgroundColor: colorPrimario,
      padding: "24px 32px",
      borderRadius: "8px 8px 0 0",
    }}
  >
    <Row>
      <Column align="center">
        {logoUrl && (
          <Img
            src={logoUrl}
            alt={nombreEmpresa}
            width="80"
            height="80"
            style={{ borderRadius: "50%", marginBottom: "8px" }}
          />
        )}
        <Heading
          as="h1"
          style={{
            color: "#ffffff",
            fontSize: "22px",
            fontWeight: "700",
            margin: "0",
            textAlign: "center",
          }}
        >
          {nombreEmpresa}
        </Heading>
        <Text
          style={{
            color: "rgba(255,255,255,0.85)",
            fontSize: "13px",
            margin: "4px 0 0",
            textAlign: "center",
          }}
        >
          Tu tienda de confianza
        </Text>
      </Column>
    </Row>
  </Section>
);
