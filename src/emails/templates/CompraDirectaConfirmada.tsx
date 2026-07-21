import {
  Html,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Hr,
  Preview,
} from "@react-email/components";
import { Header } from "../components/Header.js";
import { Footer } from "../components/Footer.js";
import type { EmpresaConfigInfo, DetalleInfo } from "../types.js";

interface CompraDirectaConfirmadaProps {
  clienteNombre?: string;
  compraId?: number;
  total?: number;
  sucursalNombre?: string;
  detalles?: DetalleInfo[];
  empresaConfig?: EmpresaConfigInfo;
  fecha?: string;
}

export const CompraDirectaConfirmada = ({
  clienteNombre = "Cliente",
  compraId = 0,
  total = 0,
  sucursalNombre = "",
  detalles = [],
  empresaConfig,
  fecha = new Date().toLocaleDateString("es-VE"),
}: CompraDirectaConfirmadaProps) => {
  const { nombreEmpresa = "Globy", logoUrl, colorPrimario = "#5713be", direccionFiscal = "", telefono } = empresaConfig ?? {};

  return (
    <Html>
      <Preview>{`Compra #${compraId} registrada en ${sucursalNombre} — ${nombreEmpresa}`}</Preview>
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "Arial, sans-serif", margin: "0", padding: "0" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "20px 0" }}>
          <Header nombreEmpresa={nombreEmpresa} logoUrl={logoUrl} colorPrimario={colorPrimario} />

          <Section style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "0 0 8px 8px" }}>
            <Text style={{ fontSize: "16px", color: "#1f2937", margin: "0 0 4px" }}>
              Hola, <strong>{clienteNombre}</strong>.
            </Text>
            <Text style={{ fontSize: "13px", color: "#6b7280", margin: "0 0 24px" }}>
              Compra <strong>#{compraId}</strong> &bull; {fecha}
            </Text>

            <Section
              style={{
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "6px",
                padding: "12px 16px",
                marginBottom: "24px",
              }}
            >
              <Text style={{ fontSize: "14px", color: "#166534", margin: "0" }}>
                Tu compra realizada en la sucursal <strong>{sucursalNombre}</strong> ha sido registrada exitosamente.
              </Text>
            </Section>

            <Heading
              as="h2"
              style={{ fontSize: "16px", color: "#1f2937", margin: "0 0 12px" }}
            >
              Resumen de la compra
            </Heading>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 4px", borderBottom: "2px solid #e5e7eb", fontSize: "12px", color: "#6b7280", textTransform: "uppercase" }}>Producto</th>
                  <th style={{ textAlign: "center", padding: "8px 4px", borderBottom: "2px solid #e5e7eb", fontSize: "12px", color: "#6b7280", textTransform: "uppercase" }}>Cant</th>
                  <th style={{ textAlign: "right", padding: "8px 4px", borderBottom: "2px solid #e5e7eb", fontSize: "12px", color: "#6b7280", textTransform: "uppercase" }}>Precio</th>
                  <th style={{ textAlign: "right", padding: "8px 4px", borderBottom: "2px solid #e5e7eb", fontSize: "12px", color: "#6b7280", textTransform: "uppercase" }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {detalles.map((detalle, i) => (
                  <tr key={i}>
                    <td style={{ padding: "10px 4px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", color: "#1f2937" }}>{detalle.producto}</td>
                    <td style={{ textAlign: "center", padding: "10px 4px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", color: "#374151" }}>{detalle.cantidad}</td>
                    <td style={{ textAlign: "right", padding: "10px 4px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", color: "#374151" }}>${detalle.precioUnit.toFixed(2)}</td>
                    <td style={{ textAlign: "right", padding: "10px 4px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", color: "#374151", fontWeight: "600" }}>${detalle.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ textAlign: "right", padding: "12px 4px 4px", fontSize: "16px", color: "#1f2937", fontWeight: "700" }}>Total</td>
                  <td style={{ textAlign: "right", padding: "12px 4px 4px", fontSize: "16px", color: colorPrimario || "#5713be", fontWeight: "700" }}>${total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </Section>

          <Footer nombreEmpresa={nombreEmpresa} direccionFiscal={direccionFiscal} telefono={telefono} />
        </Container>
      </Body>
    </Html>
  );
};

export default CompraDirectaConfirmada;
