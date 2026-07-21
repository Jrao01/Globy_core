import {
  Html,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Hr,
  Row,
  Column,
  Preview,
} from "@react-email/components";
import { Header } from "../components/Header.js";
import { Footer } from "../components/Footer.js";
import type { EmpresaConfigInfo, ProductoSolicitud } from "../types.js";

interface SolicitudProveedorProps {
  proveedorNombre?: string;
  sucursalNombre?: string;
  productos?: ProductoSolicitud[];
  empresaConfig?: EmpresaConfigInfo;
}

export const SolicitudProveedor = ({
  proveedorNombre = "Proveedor",
  sucursalNombre = "Sucursal",
  productos = [],
  empresaConfig,
}: SolicitudProveedorProps) => {
  const { nombreEmpresa = "Globy", logoUrl, colorPrimario = "#5713be", direccionFiscal = "", telefono } = empresaConfig ?? {};

  return (
    <Html>
      <Preview>Solicitud de reposición &mdash; {nombreEmpresa}</Preview>
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "Arial, sans-serif", margin: "0", padding: "0" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "20px 0" }}>
          <Header nombreEmpresa={nombreEmpresa} logoUrl={logoUrl} colorPrimario={colorPrimario} />

          <Section style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "0 0 8px 8px" }}>
            <Text style={{ fontSize: "16px", color: "#1f2937", margin: "0 0 16px" }}>
              Hola <strong>{proveedorNombre}</strong>,
            </Text>

            <Text style={{ fontSize: "15px", color: "#374151", lineHeight: "1.6", margin: "0 0 24px" }}>
              Somos <strong>{nombreEmpresa}</strong> y necesitamos reabastecer nuestro inventario
              en la sucursal <strong>{sucursalNombre}</strong>. A continuación te detallamos los
              productos que requerimos:
            </Text>

            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 4px", borderBottom: "2px solid #e5e7eb", fontSize: "12px", color: "#6b7280", textTransform: "uppercase" }}>Producto</th>
                  <th style={{ textAlign: "center", padding: "8px 4px", borderBottom: "2px solid #e5e7eb", fontSize: "12px", color: "#6b7280", textTransform: "uppercase" }}>Stock actual</th>
                  <th style={{ textAlign: "center", padding: "8px 4px", borderBottom: "2px solid #e5e7eb", fontSize: "12px", color: "#6b7280", textTransform: "uppercase" }}>Cant. necesaria</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((producto, i) => (
                  <tr key={i}>
                    <td style={{ padding: "10px 4px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", color: "#1f2937" }}>{producto.nombre}</td>
                    <td style={{ textAlign: "center", padding: "10px 4px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", color: "#ef4444", fontWeight: "600" }}>{producto.stockActual}</td>
                    <td style={{ textAlign: "center", padding: "10px 4px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", color: colorPrimario || "#5713be", fontWeight: "600" }}>{producto.cantidadNecesaria}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {telefono && (
              <Section style={{ backgroundColor: "#f9fafb", borderRadius: "6px", padding: "16px", marginBottom: "24px" }}>
                <Text style={{ fontSize: "13px", color: "#6b7280", margin: "0 0 4px" }}>
                  Si tienes alguna duda, contáctanos al:
                </Text>
                <Text style={{ fontSize: "15px", color: "#1f2937", margin: "0", fontWeight: "600" }}>
                  {telefono}
                </Text>
              </Section>
            )}

            <Text style={{ fontSize: "15px", color: "#374151", lineHeight: "1.6", margin: "0 0 8px" }}>
              Agradecemos confirmar la disponibilidad y los tiempos de entrega a la brevedad.
            </Text>

            <Text style={{ fontSize: "15px", color: "#374151", lineHeight: "1.6", margin: "0" }}>
              Saludos cordiales,
            </Text>
            <Text style={{ fontSize: "15px", color: "#1f2937", margin: "0", fontWeight: "600" }}>
              Equipo {nombreEmpresa}
            </Text>
          </Section>

          <Footer nombreEmpresa={nombreEmpresa} direccionFiscal={direccionFiscal} telefono={telefono} />
        </Container>
      </Body>
    </Html>
  );
};

export default SolicitudProveedor;
