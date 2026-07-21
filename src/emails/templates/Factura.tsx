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

interface FacturaProps {
  clienteNombre?: string;
  clienteCedula?: string;
  compraId?: number;
  total?: number;
  metodoPago?: string;
  refPago?: string;
  detalles?: DetalleInfo[];
  empresaConfig?: EmpresaConfigInfo;
  fecha?: string;
}

export const Factura = ({
  clienteNombre = "Cliente",
  clienteCedula = "00000000",
  compraId = 0,
  total = 0,
  metodoPago,
  refPago,
  detalles = [],
  empresaConfig,
  fecha = new Date().toLocaleDateString("es-VE"),
}: FacturaProps) => {
  const { nombreEmpresa = "Globy", rif = "00000000", logoUrl, colorPrimario = "#5713be", direccionFiscal = "", telefono } = empresaConfig ?? {};

  const metodoPagoLabel =
    metodoPago === "transferencia" ? "Transferencia bancaria"
    : metodoPago === "pago_movil" ? "Pago móvil"
    : metodoPago === "efectivo_bs" ? "Efectivo (Bs)"
    : metodoPago === "efectivo_usd" ? "Efectivo (USD)"
    : metodoPago || "—";

  return (
    <Html>
      <Preview>{`Factura #${compraId} — ${nombreEmpresa}`}</Preview>
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "Arial, sans-serif", margin: "0", padding: "0" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "20px 0" }}>
          <Header nombreEmpresa={nombreEmpresa} logoUrl={logoUrl} colorPrimario={colorPrimario} />

          <Section style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "0 0 8px 8px" }}>
            <Heading
              as="h2"
              style={{
                fontSize: "20px",
                color: "#1f2937",
                margin: "0 0 4px",
                textAlign: "center",
              }}
            >
              FACTURA
            </Heading>
            <Text style={{ fontSize: "13px", color: "#6b7280", margin: "0 0 24px", textAlign: "center" }}>
              N° <strong>{compraId}</strong> &bull; {fecha}
            </Text>

            <table style={{ width: "100%", marginBottom: "24px" }}>
              <tr>
                <td style={{ verticalAlign: "top", paddingRight: "16px" }}>
                  <Text style={{ fontSize: "12px", color: "#6b7280", textTransform: "uppercase", margin: "0 0 4px", fontWeight: "600" }}>Emisor</Text>
                  <Text style={{ fontSize: "14px", color: "#1f2937", margin: "0" }}>{nombreEmpresa}</Text>
                  <Text style={{ fontSize: "14px", color: "#374151", margin: "0" }}>RIF: {rif}</Text>
                  <Text style={{ fontSize: "14px", color: "#374151", margin: "0" }}>{direccionFiscal}</Text>
                  {telefono && <Text style={{ fontSize: "14px", color: "#374151", margin: "0" }}>Tel: {telefono}</Text>}
                </td>
                <td style={{ verticalAlign: "top" }}>
                  <Text style={{ fontSize: "12px", color: "#6b7280", textTransform: "uppercase", margin: "0 0 4px", fontWeight: "600" }}>Cliente</Text>
                  <Text style={{ fontSize: "14px", color: "#1f2937", margin: "0" }}>{clienteNombre}</Text>
                  <Text style={{ fontSize: "14px", color: "#374151", margin: "0" }}>C.I: {clienteCedula}</Text>
                </td>
              </tr>
            </table>

            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px" }}>
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

            <Section
              style={{
                backgroundColor: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                padding: "16px",
                marginBottom: "24px",
              }}
            >
              <Heading
                as="h3"
                style={{ fontSize: "14px", color: "#1f2937", margin: "0 0 8px" }}
              >
                Información de pago
              </Heading>
              <table style={{ width: "100%" }}>
                <tr>
                  <td style={{ fontSize: "13px", color: "#6b7280", padding: "2px 8px 2px 0", width: "120px" }}>Método de pago</td>
                  <td style={{ fontSize: "13px", color: "#1f2937", fontWeight: "600" }}>{metodoPagoLabel}</td>
                </tr>
                {refPago && (
                  <tr>
                    <td style={{ fontSize: "13px", color: "#6b7280", padding: "2px 8px 2px 0" }}>Referencia</td>
                    <td style={{ fontSize: "13px", color: "#1f2937", fontWeight: "600" }}>{refPago}</td>
                  </tr>
                )}
              </table>
            </Section>

            <Text style={{ fontSize: "12px", color: "#9ca3af", margin: "0", textAlign: "center" }}>
              Este documento es un comprobante de compra. Conserva esta factura para cualquier
              reclamo o devolución.
            </Text>
          </Section>

          <Footer nombreEmpresa={nombreEmpresa} direccionFiscal={direccionFiscal} telefono={telefono} />
        </Container>
      </Body>
    </Html>
  );
};

export default Factura;
