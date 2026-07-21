import puppeteer from "puppeteer";

let browserInstance: any = null;

async function getBrowser(): Promise<any> {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }
  browserInstance = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  return browserInstance;
}

function parseDataJson(dataJson: unknown): Record<string, any> {
  if (typeof dataJson === "string") return JSON.parse(dataJson);
  if (typeof dataJson === "object" && dataJson !== null) return dataJson as Record<string, any>;
  return {};
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD" }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-VE").format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function renderInsightJson(insight: any): string {
  if (!insight || typeof insight !== "object") return "<p>Sin analisis disponible</p>";

  let html = `<h2>📊 Analisis de Inteligencia Artificial</h2>`;

  if (insight.resumen) {
    html += `<p style="font-size:11px;margin-bottom:10px;line-height:1.6;color:#1e293b;">${insight.resumen}</p>`;
  }

  if (insight.pronostico) {
    const p = insight.pronostico;
    html += `<h3>Pronostico (Forecast)</h3>
    <div class="stat-grid">`;
    if (p.valorEstimado) html += `<div class="stat-card blue"><div class="value">$${Number(p.valorEstimado).toLocaleString()}</div><div class="label">Valor Estimado</div></div>`;
    if (p.tendencia) html += `<div class="stat-card"><div class="value">${p.tendencia}</div><div class="label">Tendencia</div></div>`;
    if (p.metodo) html += `<div class="stat-card green"><div class="value">${p.metodo}</div><div class="label">Metodo</div></div>`;
    html += `</div>`;
    if (p.interpretacion) html += `<p style="font-size:10px;margin-top:6px;color:#475569;">${p.interpretacion}</p>`;
    if (p.efectoFestivo?.detectado) {
      html += `<p style="font-size:10px;color:#92400e;background:#fef3c7;padding:6px 10px;border-radius:4px;">🎄 Efecto festivo (holiday effect) detectado: <strong>${p.efectoFestivo.nombre}</strong> (ajuste: +${p.efectoFestivo.ajustePorcentual}%)</p>`;
    }
    if (p.variacionInteranual?.porcentaje != null) {
      html += `<p style="font-size:10px;color:#475569;">Variacion interanual (year-over-year): <strong>${p.variacionInteranual.porcentaje >= 0 ? "+" : ""}${p.variacionInteranual.porcentaje}%</strong> — ${p.variacionInteranual.interpretacion || ""}</p>`;
    }
  }

  if (insight.recomendaciones?.length > 0 || insight.recomendacionesOperativas?.length > 0) {
    const recs = insight.recomendaciones || insight.recomendacionesOperativas || [];
    html += `<h3>Recomendaciones</h3>`;
    recs.forEach((r: any, i: number) => {
      const color = r.prioridad === "alta" ? "#fee2e2" : r.prioridad === "media" ? "#fef3c7" : "#f0fdf4";
      const border = r.prioridad === "alta" ? "#ef4444" : r.prioridad === "media" ? "#f59e0b" : "#22c55e";
      html += `<div style="background:${color};border-left:3px solid ${border};padding:8px 12px;margin:4px 0;border-radius:0 4px 4px 0;font-size:10px;">
        <strong>${i + 1}.</strong> ${r.accion || r.paso || ""}
        ${r.datoClave ? `<br/><span style="font-size:9px;color:#64748b;">📊 ${r.datoClave}</span>` : ""}
        ${r.prioridad ? ` <span style="font-size:8px;color:#64748b;">[${r.prioridad}]</span>` : ""}
      </div>`;
    });
  }

  if (insight.alertas?.length > 0 || insight.puntosCriticos?.length > 0) {
    const alerts = insight.alertas || insight.puntosCriticos || [];
    html += `<h3>Alertas / Puntos Criticos</h3>`;
    alerts.forEach((a: any) => {
      const color = a.severidad === "alta" || a.tipo === "churn" ? "#fee2e2" : "#fef3c7";
      html += `<div style="background:${color};padding:8px 12px;margin:4px 0;border-radius:4px;font-size:10px;">
        ⚠️ <strong>${a.tipo}:</strong> ${a.mensaje || a.riesgo || ""}
        ${a.dato ? `<br/><span style="font-size:9px;color:#64748b;">Dato: ${a.dato}</span>` : ""}
      </div>`;
    });
  }

  if (insight.diagnostico && typeof insight.diagnostico === "object" && insight.diagnostico.interpretacion) {
    const d = insight.diagnostico;
    html += `<h3>Diagnostico</h3>
    <div style="background:#f0f9ff;border-left:4px solid #6366f1;padding:10px 14px;margin:6px 0;border-radius:0 6px 6px 0;">
      <p style="font-size:10px;margin:0;color:#1e293b;">${d.interpretacion}</p>
      ${d.variableClave ? `<p style="font-size:9px;color:#64748b;margin-top:4px;">Variable clave: ${d.variableClave} | Cambio: ${d.cambio} (${d.magnitud != null ? d.magnitud : ""})</p>` : ""}
    </div>`;
  }

  if (insight.evaluacionViabilidad) {
    const ev = insight.evaluacionViabilidad;
    const color = ev.categoria === "saludable" ? "#10b981" : ev.categoria === "ajustada" ? "#f59e0b" : "#ef4444";
    html += `<h3>Evaluacion de Viabilidad</h3>
    <div style="background:#f0fdf4;border-left:4px solid ${color};padding:10px 14px;margin:6px 0;border-radius:0 6px 6px 0;">
      <p style="font-size:10px;margin:0;color:#1e293b;">${ev.diagnostico || ""}</p>
      <p style="font-size:10px;margin-top:4px;color:#475569;">Brecha de seguridad (safety margin): <strong>${ev.brechaSeguridadPorcentual != null ? ev.brechaSeguridadPorcentual + "%" : "N/A"}</strong></p>
    </div>`;
  }

  if (insight.interpretacionEstrategica) {
    const ie = insight.interpretacionEstrategica;
    html += `<h3>Interpretacion Estrategica</h3>
    <div style="background:#f0f9ff;border-left:4px solid #6366f1;padding:10px 14px;margin:6px 0;border-radius:0 6px 6px 0;">
      <p style="font-size:10px;margin:0;color:#1e293b;">${ie.diagnostico || ""}</p>
      <p style="font-size:9px;color:#64748b;margin-top:4px;">Nivel de canibalizacion (cannibalization): <strong>${ie.nivelCanibalizacion}</strong> (${ie.porcentaje != null ? ie.porcentaje + "%" : "N/A"})</p>
    </div>`;
  }

  if (insight.recomendacionFinal) {
    const rf = insight.recomendacionFinal;
    const badgeColor = rf.decision === "ABRIR" ? "badge-success" : rf.decision === "NO_ABRIR" ? "badge-danger" : "badge-warning";
    html += `<h3>Recomendacion Final</h3>
    <div style="display:flex;align-items:center;gap:8px;margin:6px 0;">
      <span class="badge ${badgeColor}" style="font-size:11px;padding:4px 12px;">${rf.decision}</span>
      <span style="font-size:10px;color:#64748b;">Confianza: ${rf.confianza || "N/A"}</span>
    </div>
    <p style="font-size:10px;color:#475569;">${rf.justificacion || ""}</p>`;
  }

  if (insight.recomendacion && typeof insight.recomendacion === "object") {
    const r = insight.recomendacion;
    html += `<h3>Recomendacion</h3>
    <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:10px 14px;margin:6px 0;border-radius:0 6px 6px 0;">
      <p style="font-size:10px;margin:0;color:#1e293b;">${r.accion || r.justificacion || ""}</p>
      ${r.decision ? `<p style="font-size:10px;margin-top:4px;">Decision: <strong>${r.decision}</strong></p>` : ""}
    </div>`;
  }

  if (insight.diagnosticoUbicacion) {
    const du = insight.diagnosticoUbicacion;
    html += `<h3>Diagnostico de Ubicacion</h3>`;
    if (du.demanda) html += `<div style="background:#f8fafc;padding:8px 12px;margin:4px 0;border-radius:4px;font-size:10px;"><strong>Demanda:</strong> ${du.demanda.evaluacion || ""} (clientes potenciales: ${du.demanda.clientesPotenciales || "N/A"}, ticket promedio: $${du.demanda.ticketPromedioEstimado || "N/A"})</div>`;
    if (du.cobertura) html += `<div style="background:#f8fafc;padding:8px 12px;margin:4px 0;border-radius:4px;font-size:10px;"><strong>Cobertura:</strong> ${du.cobertura.evaluacion || ""} (radio: ${du.cobertura.radioKm || "N/A"} km, accesibilidad: ${du.cobertura.accesibilidadMinutos || "N/A"} min)</div>`;
    if (du.coTenencia) html += `<div style="background:#f8fafc;padding:8px 12px;margin:4px 0;border-radius:4px;font-size:10px;"><strong>Co-Tenencia:</strong> ${du.coTenencia.evaluacion || ""} (score: ${du.coTenencia.scoreComplementariedad || "N/A"}, negocios: ${du.coTenencia.negociosComplementarios || "N/A"})</div>`;
    if (du.saturacion) html += `<div style="background:#f8fafc;padding:8px 12px;margin:4px 0;border-radius:4px;font-size:10px;"><strong>Saturacion (IRS):</strong> ${du.saturacion.interpretacion || ""} (IRS: ${du.saturacion.irs || "N/A"})</div>`;
  }

  if (insight.puntuacionViabilidad) {
    html += `<h3>Puntuacion de Viabilidad</h3>
    <div class="stat-grid">
      <div class="stat-card ${insight.puntuacionViabilidad.categoria === "alta" ? "green" : insight.puntuacionViabilidad.categoria === "media" ? "orange" : "red"}">
        <div class="value">${insight.puntuacionViabilidad.valor || 0}/100</div>
        <div class="label">${insight.puntuacionViabilidad.categoria || "N/A"}</div>
      </div>
    </div>`;
  }

  if (insight.riesgos?.length > 0) {
    html += `<h3>Riesgos</h3>`;
    insight.riesgos.forEach((r: any) => {
      const bg = r.probabilidad === "alta" || r.dirigidaA === "peor" ? "#fee2e2" : "#fef3c7";
      html += `<div style="background:${bg};padding:8px 12px;margin:4px 0;border-radius:4px;font-size:10px;">⚠️ ${r.riesgo || ""} ${r.probabilidad ? `[${r.probabilidad}]` : ""}${r.dato ? `<br/><span style="font-size:9px;color:#64748b;">Dato: ${r.dato}</span>` : ""}${r.consecuencia ? `<br/><span style="font-size:9px;color:#dc2626;">Consecuencia: ${r.consecuencia}</span>` : ""}</div>`;
    });
  }

  if (insight.proximosPasos?.length > 0) {
    html += `<h3>Proximos Pasos</h3>`;
    insight.proximosPasos.forEach((p: any) => {
      html += `<div style="background:#f8fafc;padding:6px 10px;margin:3px 0;border-radius:4px;font-size:10px;">➡️ ${p.paso || p.accion || ""} ${p.prioridad ? `[${p.prioridad}]` : ""}</div>`;
    });
  }

  if (insight.accionesInmediatas?.length > 0) {
    html += `<h3>Acciones Inmediatas</h3>`;
    insight.accionesInmediatas.forEach((a: any) => {
      html += `<div style="background:#f0fdf4;border-left:3px solid #22c55e;padding:6px 10px;margin:3px 0;border-radius:0 4px 4px 0;font-size:10px;">
        ⏱️ ${a.accion || ""}
        ${a.datoClave ? `<br/><span style="font-size:9px;color:#64748b;">📊 ${a.datoClave}</span>` : ""}
        ${a.plazo ? ` <span style="font-size:8px;color:#64748b;">[${a.plazo}]</span>` : ""}
      </div>`;
    });
  }

  if (insight.comparativaSucursales) {
    const cs = insight.comparativaSucursales;
    html += `<h3>Comparativa entre Sucursales</h3>
    <p style="font-size:10px;color:#475569;">${cs.analisis || ""}</p>
    ${cs.brechaMargen?.valor != null ? `<p style="font-size:10px;color:#475569;">Brecha de margen: <strong>${cs.brechaMargen.valor}%</strong> — ${cs.brechaMargen.interpretacion || ""}</p>` : ""}
    ${cs.posiblesCausas?.length > 0 ? `<ul style="font-size:10px;color:#64748b;">${cs.posiblesCausas.map((c: string) => `<li>${c}</li>`).join("")}</ul>` : ""}`;
  }

  if (insight.evaluacionEnfoques) {
    const ee = insight.evaluacionEnfoques;
    html += `<h3>Evaluacion de Enfoques</h3>`;
    if (ee.concentrico) html += `<div style="background:#f8fafc;padding:8px 12px;margin:4px 0;border-radius:4px;font-size:10px;"><strong>Enfoque Concentrico:</strong> ${ee.concentrico.aplicabilidad ? "✅ Aplicable" : "❌ No aplicable"} — ${ee.concentrico.justificacion || ""}</div>`;
    if (ee.selectivo) html += `<div style="background:#f8fafc;padding:8px 12px;margin:4px 0;border-radius:4px;font-size:10px;"><strong>Enfoque Selectivo:</strong> ${ee.selectivo.aplicabilidad ? "✅ Aplicable" : "❌ No aplicable"} — ${ee.selectivo.justificacion || ""}</div>`;
  }

  if (insight.recomendacionEstrategica) {
    const re = insight.recomendacionEstrategica;
    html += `<h3>Recomendacion Estrategica</h3>
    <div style="background:#f0f9ff;border-left:4px solid #6366f1;padding:10px 14px;margin:6px 0;border-radius:0 6px 6px 0;">
      <p style="font-size:10px;margin:0;color:#1e293b;">Enfoque recomendado: <strong>${re.enfoque || "N/A"}</strong> (confianza: ${re.confianza || "N/A"})</p>
      <p style="font-size:10px;margin-top:4px;color:#475569;">${re.justificacion || ""}</p>
    </div>`;
  }

  if (insight.alerta && typeof insight.alerta === "object") {
    const al = insight.alerta;
    if (al.hayAlerta) {
      html += `<h3>Alerta</h3>
      <div style="background:${al.tipo === "stock" ? "#fee2e2" : "#fef3c7"};padding:8px 12px;margin:4px 0;border-radius:4px;font-size:10px;">
        ⚠️ <strong>${al.tipo}:</strong> ${al.mensaje || ""}
        ${al.dato ? `<br/><span style="font-size:9px;color:#64748b;">${al.dato}</span>` : ""}
      </div>`;
    }
  }

  if (insight.riesgoOperativo) {
    const ro = insight.riesgoOperativo;
    html += `<h3>Riesgo Operativo</h3>
    <div style="background:#fef3c7;padding:8px 12px;margin:4px 0;border-radius:4px;font-size:10px;">
      <p style="margin:0;color:#92400e;">${ro.descripcion || ""}</p>
      ${ro.factores?.length > 0 ? `<ul style="font-size:9px;color:#92400e;margin-top:4px;">${ro.factores.map((f: string) => `<li>${f}</li>`).join("")}</ul>` : ""}
    </div>`;
  }

  return html;
}

const BASE_STYLES = `
  @page { margin: 15mm; size: A4; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a2e; line-height: 1.5; font-size: 11px; }
  .header { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px solid #6366f1; }
  .header h1 { font-size: 22px; color: #6366f1; margin-bottom: 5px; }
  .header .subtitle { font-size: 12px; color: #64748b; }
  .header .date { font-size: 10px; color: #94a3b8; margin-top: 4px; }
  .section { margin-bottom: 18px; }
  .section h2 { font-size: 14px; color: #6366f1; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; }
  .section h3 { font-size: 12px; color: #475569; margin: 10px 0 6px 0; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 10px; }
  th { background: #6366f1; color: white; padding: 7px 10px; text-align: left; font-weight: 600; }
  td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) { background: #f8fafc; }
  tr:hover { background: #f1f5f9; }
  .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin: 10px 0; }
  .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; border-radius: 8px; text-align: center; }
  .stat-card.green { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
  .stat-card.orange { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
  .stat-card.red { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
  .stat-card.blue { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
  .stat-card .value { font-size: 18px; font-weight: 700; }
  .stat-card .label { font-size: 9px; opacity: 0.9; margin-top: 2px; }
  .insight-box { background: #f0f9ff; border-left: 4px solid #6366f1; padding: 12px 15px; border-radius: 0 8px 8px 0; margin: 10px 0; }
  .insight-box h2 { border: none; color: #6366f1; font-size: 13px; margin-bottom: 6px; }
  .insight-box h3 { color: #475569; font-size: 11px; }
  .insight-box p { margin: 4px 0; }
  .insight-box strong { color: #1e293b; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 600; }
  .badge-success { background: #dcfce7; color: #166534; }
  .badge-warning { background: #fef3c7; color: #92400e; }
  .badge-danger { background: #fee2e2; color: #991b1b; }
  .badge-info { background: #dbeafe; color: #1e40af; }
  .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9px; color: #94a3b8; }
  .chart-placeholder { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 15px; margin: 8px 0; }
  .chart-title { font-size: 11px; font-weight: 600; color: #475569; margin-bottom: 8px; }
`;

function buildHtml(content: string, styles: string = ""): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>${BASE_STYLES}${styles}</style>
</head>
<body>
  ${content}
</body>
</html>`;
}

function renderPatrones(data: Record<string, any>): string {
  const { descriptiva, ventasPorMes, topProductos, rfm, marketBasket, churn, clv, forecasting, alertas, periodo } = data;

  let html = `<div class="header">
    <h1>Reporte de Patrones de Compra</h1>
    <div class="subtitle">Análisis completo de comportamiento de clientes y productos</div>
    <div class="date">Generado: ${new Date().toLocaleDateString("es-VE")} | Período: ${periodo?.inicio ? new Date(periodo.inicio).toLocaleDateString("es-VE") : "N/A"} - ${periodo?.fin ? new Date(periodo.fin).toLocaleDateString("es-VE") : "N/A"}</div>
  </div>`;

  if (descriptiva) {
    html += `<div class="section">
      <h2>Resumen Descriptivo</h2>
      <div class="stat-grid">
        <div class="stat-card"><div class="value">${formatCurrency(descriptiva.totalVentas || 0)}</div><div class="label">Total Ventas</div></div>
        <div class="stat-card green"><div class="value">${formatCurrency(descriptiva.totalCompras || 0)}</div><div class="label">Total Compras</div></div>
        <div class="stat-card orange"><div class="value">${formatCurrency(descriptiva.ticketPromedio || 0)}</div><div class="label">Ticket Promedio</div></div>
      </div>`;

    if (descriptiva.ventasPorSucursal?.length > 0) {
      html += `<h3>Ventas por Sucursal</h3>
      <table><thead><tr><th>Sucursal</th><th>Total Ventas</th></tr></thead><tbody>
      ${descriptiva.ventasPorSucursal.map((s: any) => `<tr><td>${s.sucursal}</td><td>${formatCurrency(s.total)}</td></tr>`).join("")}
      </tbody></table>`;
    }

    if (descriptiva.ventasPorCategoria?.length > 0) {
      html += `<h3>Ventas por Categoría</h3>
      <table><thead><tr><th>Categoría</th><th>Total</th></tr></thead><tbody>
      ${descriptiva.ventasPorCategoria.map((c: any) => `<tr><td>${c.categoria}</td><td>${formatCurrency(c.total)}</td></tr>`).join("")}
      </tbody></table>`;
    }
    html += `</div>`;
  }

  if (ventasPorMes?.length > 0) {
    html += `<div class="section">
      <h2>Tendencia Mensual de Ventas</h2>
      <table><thead><tr><th>Mes</th><th>Promedio</th><th>Mínimo</th><th>Máximo</th></tr></thead><tbody>
      ${ventasPorMes.map((v: any) => `<tr><td>${v.mes}</td><td>${formatCurrency(v.promedio || 0)}</td><td>${formatCurrency(v.min || 0)}</td><td>${formatCurrency(v.max || 0)}</td></tr>`).join("")}
      </tbody></table>
    </div>`;
  }

  if (topProductos?.length > 0) {
    html += `<div class="section">
      <h2>Top Productos</h2>
      <table><thead><tr><th>#</th><th>Producto</th><th>Categoría</th><th>Unidades</th></tr></thead><tbody>
      ${topProductos.slice(0, 10).map((p: any, i: number) => `<tr><td>${i + 1}</td><td>${p.nombre}</td><td>${p.categoria}</td><td>${formatNumber(p.unidades)}</td></tr>`).join("")}
      </tbody></table>
    </div>`;
  }

  if (rfm) {
    html += `<div class="section">
      <h2>Segmentación RFM</h2>
      <div class="stat-grid">
        ${rfm.segmentos?.constante ? `<div class="stat-card"><div class="value">${rfm.segmentos.constante.cantidad || 0}</div><div class="label">Constante (Ticket: ${formatCurrency(rfm.segmentos.constante.ticketPromedio || 0)})</div></div>` : ""}
        ${rfm.segmentos?.leales ? `<div class="stat-card green"><div class="value">${rfm.segmentos.leales.cantidad || 0}</div><div class="label">Leales (Ticket: ${formatCurrency(rfm.segmentos.leales.ticketPromedio || 0)})</div></div>` : ""}
        ${rfm.segmentos?.riesgo ? `<div class="stat-card orange"><div class="value">${rfm.segmentos.riesgo.cantidad || 0}</div><div class="label">En Riesgo (Ticket: ${formatCurrency(rfm.segmentos.riesgo.ticketPromedio || 0)})</div></div>` : ""}
        ${rfm.segmentos?.inactivos ? `<div class="stat-card red"><div class="value">${rfm.segmentos.inactivos.cantidad || 0}</div><div class="label">Inactivos (Ticket: ${formatCurrency(rfm.segmentos.inactivos.ticketPromedio || 0)})</div></div>` : ""}
      </div>
      ${rfm.topClientes?.length > 0 ? `
      <h3>Top Clientes</h3>
      <table><thead><tr><th>Cliente</th><th>Compras</th><th>Total Gastado</th><th>Última Compra</th><th>Segmento</th></tr></thead><tbody>
      ${rfm.topClientes.slice(0, 10).map((c: any) => `<tr><td>${c.nombre}</td><td>${c.compras}</td><td>${formatCurrency(c.totalGastado)}</td><td>${c.ultimaCompra ? new Date(c.ultimaCompra).toLocaleDateString("es-VE") : "N/A"}</td><td><span class="badge badge-${c.segmento === "constante" ? "info" : c.segmento === "leales" ? "success" : "warning"}">${c.segmento}</span></td></tr>`).join("")}
      </tbody></table>` : ""}
    </div>`;
  }

  if (marketBasket?.length > 0) {
    html += `<div class="section">
      <h2>Market Basket Analysis</h2>
      <table><thead><tr><th>Producto A</th><th>Producto B</th><th>Co-ocurrencia</th></tr></thead><tbody>
      ${marketBasket.slice(0, 10).map((m: any) => `<tr><td>${m.productoA}</td><td>${m.productoB}</td><td>${m.coocurrencia}</td></tr>`).join("")}
      </tbody></table>
    </div>`;
  }

  if (churn || forecasting) {
    html += `<div class="section"><h2>Métricas Clave</h2><div class="stat-grid">`;
    if (churn) {
      html += `<div class="stat-card green"><div class="value">${formatPercent(churn.tasaRetencion || 0)}</div><div class="label">Retención</div></div>
        <div class="stat-card red"><div class="value">${formatPercent(churn.tasaChurn || 0)}</div><div class="label">Churn</div></div>
        <div class="stat-card orange"><div class="value">${formatNumber(churn.clientesSinCompra90d || 0)}</div><div class="label">Sin Compra 90d</div></div>`;
    }
    if (forecasting) {
      html += `<div class="stat-card blue"><div class="value">${formatCurrency(forecasting.ventasEstimadasProximoMes || 0)}</div><div class="label">Estimado Próximo Mes</div></div>`;
    }
    html += `</div></div>`;
  }

  if (alertas?.length > 0) {
    html += `<div class="section">
      <h2>Alertas</h2>
      <table><thead><tr><th>Tipo</th><th>Detalle</th><th>Valor</th><th>Sucursal</th></tr></thead><tbody>
      ${alertas.map((a: any) => `<tr><td><span class="badge badge-danger">${a.tipo}</span></td><td>${a.producto || a.cliente || "N/A"}</td><td>${a.stock !== undefined ? formatNumber(a.stock) : a.diasSinCompra !== undefined ? `${a.diasSinCompra} días` : "N/A"}</td><td>${a.sucursal || "General"}</td></tr>`).join("")}
      </tbody></table>
    </div>`;
  }

  return html;
}

function renderDemanda(data: Record<string, any>): string {
  const { sucursalesExistentes, zonasConDemanda, zonasSinSucursal, competidoresPorZona, coberturaActual } = data;

  let html = `<div class="header">
    <h1>Reporte de Demanda Geográfica</h1>
    <div class="subtitle">Análisis de cobertura, zonas de oportunidad y competencia</div>
    <div class="date">Generado: ${new Date().toLocaleDateString("es-VE")}</div>
  </div>`;

  if (coberturaActual) {
    html += `<div class="section">
      <h2>Cobertura Actual</h2>
      <div class="stat-grid">
        <div class="stat-card blue"><div class="value">${formatPercent(coberturaActual.porcentajeCobertura || 0)}</div><div class="label">Cobertura</div></div>
        <div class="stat-card green"><div class="value">${formatNumber(coberturaActual.clientesEnCobertura || 0)}</div><div class="label">Clientes en Cobertura</div></div>
        <div class="stat-card orange"><div class="value">${formatNumber(coberturaActual.clientesFueraCobertura || 0)}</div><div class="label">Clientes Fuera</div></div>
        <div class="stat-card"><div class="value">${coberturaActual.radioAnalizadoKm || 0} km</div><div class="label">Radio Analizado</div></div>
      </div>
    </div>`;
  }

  if (sucursalesExistentes?.length > 0) {
    html += `<div class="section">
      <h2>Sucursales Existentes</h2>
      <table><thead><tr><th>Sucursal</th><th>Ciudad</th><th>Ventas Totales</th></tr></thead><tbody>
      ${sucursalesExistentes.map((s: any) => `<tr><td>${s.nombre}</td><td>${s.ciudad || "N/A"}</td><td>${formatCurrency(s.ventasTotales || 0)}</td></tr>`).join("")}
      </tbody></table>
    </div>`;
  }

  if (zonasConDemanda?.length > 0) {
    html += `<div class="section">
      <h2>Zonas con Mayor Demanda</h2>
      <table><thead><tr><th>#</th><th>Visitas</th><th>Clientes Únicos</th><th>Lat</th><th>Lng</th></tr></thead><tbody>
      ${zonasConDemanda.slice(0, 15).map((z: any, i: number) => `<tr><td>${i + 1}</td><td>${formatNumber(z.visitas)}</td><td>${formatNumber(z.clientesUnicos)}</td><td>${z.lat?.toFixed(4)}</td><td>${z.lng?.toFixed(4)}</td></tr>`).join("")}
      </tbody></table>
    </div>`;
  }

  if (zonasSinSucursal?.length > 0) {
    html += `<div class="section">
      <h2>Zonas sin Sucursal (Oportunidad)</h2>
      <table><thead><tr><th>#</th><th>Visitas</th><th>Clientes Únicos</th><th>Lat</th><th>Lng</th></tr></thead><tbody>
      ${zonasSinSucursal.slice(0, 10).map((z: any, i: number) => `<tr><td>${i + 1}</td><td>${formatNumber(z.visitas)}</td><td>${formatNumber(z.clientesUnicos)}</td><td>${z.lat?.toFixed(4)}</td><td>${z.lng?.toFixed(4)}</td></tr>`).join("")}
      </tbody></table>
    </div>`;
  }

  if (competidoresPorZona && Object.keys(competidoresPorZona).length > 0) {
    html += `<div class="section">
      <h2>Competidores por Zona</h2>
      <table><thead><tr><th>Zona</th><th>Cantidad</th><th>Rating Promedio</th></tr></thead><tbody>
      ${Object.entries(competidoresPorZona).slice(0, 10).map(([zona, info]: [string, any]) => `<tr><td>${zona}</td><td>${info.count}</td><td>${info.ratingPromedio?.toFixed(1) || "N/A"} ⭐</td></tr>`).join("")}
      </tbody></table>
    </div>`;
  }

  return html;
}

function renderRendimiento(data: Record<string, any>): string {
  const { periodo, resumen, ventasPorMes, inventario, tasaCambio } = data;

  let html = `<div class="header">
    <h1>Reporte de Rendimiento</h1>
    <div class="subtitle">Análisis de rendimiento general del negocio</div>
    <div class="date">Generado: ${new Date().toLocaleDateString("es-VE")} | Período: ${periodo?.inicio ? new Date(periodo.inicio).toLocaleDateString("es-VE") : "N/A"} - ${periodo?.fin ? new Date(periodo.fin).toLocaleDateString("es-VE") : "N/A"}</div>
  </div>`;

  if (resumen) {
    html += `<div class="section">
      <h2>Resumen General</h2>
      <div class="stat-grid">
        <div class="stat-card"><div class="value">${formatCurrency(resumen.revenueTotal || 0)}</div><div class="label">Revenue Total</div></div>
        <div class="stat-card green"><div class="value">${formatNumber(resumen.totalCompras || 0)}</div><div class="label">Total Compras</div></div>
        <div class="stat-card orange"><div class="value">${formatCurrency(resumen.ticketPromedio || 0)}</div><div class="label">Ticket Promedio</div></div>
        <div class="stat-card blue"><div class="value">${formatNumber(resumen.clientesNuevos || 0)}</div><div class="label">Clientes Nuevos</div></div>
      </div>
      ${resumen.crecimientoVsAnteriorPct !== undefined ? `
      <div class="stat-grid">
        <div class="stat-card ${resumen.crecimientoVsAnteriorPct >= 0 ? 'green' : 'red'}">
          <div class="value">${resumen.crecimientoVsAnteriorPct >= 0 ? '+' : ''}${formatPercent(resumen.crecimientoVsAnteriorPct)}</div>
          <div class="label">Crecimiento vs Anterior</div>
        </div>
        ${resumen.ofertasActivas !== undefined ? `<div class="stat-card"><div class="value">${formatNumber(resumen.ofertasActivas)}</div><div class="label">Ofertas Activas</div></div>` : ""}
      </div>` : ""}
    </div>`;
  }

  if (ventasPorMes?.length > 0) {
    html += `<div class="section">
      <h2>Revenue Mensual</h2>
      <table><thead><tr><th>Mes</th><th>Total</th></tr></thead><tbody>
      ${ventasPorMes.map((v: any) => `<tr><td>${v.mes}</td><td>${formatCurrency(v.total || 0)}</td></tr>`).join("")}
      </tbody></table>
    </div>`;
  }

  if (inventario) {
    html += `<div class="section">
      <h2>Inventario</h2>
      <div class="stat-grid">
        <div class="stat-card"><div class="value">${formatCurrency(inventario.valorTotalEstimado || 0)}</div><div class="label">Valor Total Estimado</div></div>
      </div>`;

    if (inventario.stockBajo?.length > 0) {
      html += `<h3>Stock Bajo</h3>
      <table><thead><tr><th>Producto</th><th>Stock Actual</th><th>Mínimo</th></tr></thead><tbody>
      ${inventario.stockBajo.map((s: any) => `<tr><td>${s.producto}</td><td><span class="badge badge-danger">${formatNumber(s.stock)}</span></td><td>${formatNumber(s.minimo)}</td></tr>`).join("")}
      </tbody></table>`;
    }

    if (inventario.stockExceso?.length > 0) {
      html += `<h3>Stock en Exceso</h3>
      <table><thead><tr><th>Producto</th><th>Stock Actual</th><th>Mínimo</th></tr></thead><tbody>
      ${inventario.stockExceso.map((s: any) => `<tr><td>${s.producto}</td><td><span class="badge badge-warning">${formatNumber(s.stock)}</span></td><td>${formatNumber(s.minimo)}</td></tr>`).join("")}
      </tbody></table>`;
    }
    html += `</div>`;
  }

  if (tasaCambio) {
    html += `<div class="section">
      <h2>Conversión de Moneda</h2>
      <div class="stat-grid">
        <div class="stat-card"><div class="value">${formatCurrency(tasaCambio.usdAVes || 0)}</div><div class="label">USD → VES</div></div>
        <div class="stat-card green"><div class="value">${formatCurrency(tasaCambio.revenueEnVes || 0)}</div><div class="label">Revenue en VES</div></div>
      </div>
    </div>`;
  }

  return html;
}

function renderSucursal(data: Record<string, any>): string {
  const { periodo, sucursales, resumen } = data;

  let html = `<div class="header">
    <h1>Reporte Comparativo de Sucursales</h1>
    <div class="subtitle">Análisis comparativo del rendimiento por sucursal</div>
    <div class="date">Generado: ${new Date().toLocaleDateString("es-VE")} | Período: ${periodo?.inicio ? new Date(periodo.inicio).toLocaleDateString("es-VE") : "N/A"} - ${periodo?.fin ? new Date(periodo.fin).toLocaleDateString("es-VE") : "N/A"}</div>
  </div>`;

  if (resumen) {
    html += `<div class="section">
      <h2>Resumen General</h2>
      <div class="stat-grid">
        <div class="stat-card"><div class="value">${formatNumber(resumen.totalSucursales || 0)}</div><div class="label">Total Sucursales</div></div>
        <div class="stat-card green"><div class="value">${formatCurrency(resumen.revenueTotal || 0)}</div><div class="label">Revenue Total</div></div>
        ${resumen.mejor ? `<div class="stat-card blue"><div class="value">${resumen.mejor.nombre}</div><div class="label">Mejor Sucursal (${formatCurrency(resumen.mejor.revenue || 0)})</div></div>` : ""}
        ${resumen.peor ? `<div class="stat-card orange"><div class="value">${resumen.peor.nombre}</div><div class="label">Menor Revenue (${formatCurrency(resumen.peor.revenue || 0)})</div></div>` : ""}
      </div>
    </div>`;
  }

  if (sucursales?.length > 0) {
    html += `<div class="section">
      <h2>Detalle por Sucursal</h2>
      <table><thead><tr><th>Sucursal</th><th>Ciudad</th><th>Revenue</th><th>Compras</th><th>Ticket Prom.</th><th>Empleados</th><th>Stock Bajo</th><th>Crecimiento</th></tr></thead><tbody>
      ${sucursales.map((s: any) => `<tr>
        <td><strong>${s.nombre}</strong></td>
        <td>${s.ciudad || "N/A"}</td>
        <td>${formatCurrency(s.revenue || 0)}</td>
        <td>${formatNumber(s.totalCompras || 0)}</td>
        <td>${formatCurrency(s.ticketPromedio || 0)}</td>
        <td>${formatNumber(s.empleados || 0)}</td>
        <td>${s.stockBajo > 0 ? `<span class="badge badge-danger">${s.stockBajo}</span>` : '<span class="badge badge-success">0</span>'}</td>
        <td>${s.crecimientoVsAnteriorPct !== undefined ? `<span class="badge ${s.crecimientoVsAnteriorPct >= 0 ? 'badge-success' : 'badge-danger'}">${s.crecimientoVsAnteriorPct >= 0 ? '+' : ''}${formatPercent(s.crecimientoVsAnteriorPct)}</span>` : "N/A"}</td>
      </tr>`).join("")}
      </tbody></table>
    </div>`;
  }

  return html;
}

export async function generarPdf(
  tipoAnalisis: string,
  dataJson: unknown,
  insightIA: any,
  titulo: string
): Promise<Buffer> {
  const data = parseDataJson(dataJson);

  let reportContent = "";
  switch (tipoAnalisis) {
    case "patrones":
      reportContent = renderPatrones(data);
      break;
    case "demanda_geo":
      reportContent = renderDemanda(data);
      break;
    case "rendimiento":
      reportContent = renderRendimiento(data);
      break;
    case "sucursal":
      reportContent = renderSucursal(data);
      break;
    default:
      reportContent = `<div class="header"><h1>${titulo}</h1></div><div class="section"><p>Tipo de reporte no soportado: ${tipoAnalisis}</p></div>`;
  }

  if (insightIA) {
    reportContent += `<div class="section insight-box">
      ${renderInsightJson(insightIA)}
    </div>`;
  }

  reportContent += `<div class="footer">Globy - Sistema de Análisis de Negocio | Generado automáticamente</div>`;

  const fullHtml = buildHtml(reportContent);

  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "15mm", bottom: "15mm", left: "15mm", right: "15mm" },
  });

  await page.close();

  return Buffer.from(pdfBuffer);
}

export async function closePdfService(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
