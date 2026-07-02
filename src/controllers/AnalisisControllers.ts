import type { Response, RequestHandler } from "express";
import type { AuthRequest } from "../types/index.js";
import prisma from "../config/prisma.js";
import fs from "fs";
import path from "path";
import {
  generarInsightPatrones,
  generarInsightDemanda,
  generarInsightRendimiento,
  generarInsightSucursal,
  generarInsightSucursalIndividual,
  generarInsightExpansion,
} from "../services/llmService.js";
import { haversineDistanceKm } from "../utils/geo.js";
import { getDistanciaTiempo } from "../services/RoutingService.js";
import { getNearbyBusinesses } from "../services/OverpassService.js";

/* ─────────────── helpers ─────────────── */

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

function diasEntre(a: Date, b: Date) {
  return Math.max(1, Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

function factorPeriodo(inicio: Date, fin: Date) {
  return diasEntre(inicio, fin) / 30;
}

/* ═══════════════════════════════════════════════════════════
   HELPERS: HOLT-WINTERS FORECASTING (DOUBLE EXPONENTIAL SMOOTHING)
   ═══════════════════════════════════════════════════════════ */

interface HoltResult {
  nivel: number;
  tendencia: number;
  forecast: number;
  confianzaMin: number;
  confianzaMax: number;
}

function holtForecast(valores: number[], horizonte: number = 1): HoltResult {
  if (valores.length === 0) return { nivel: 0, tendencia: 0, forecast: 0, confianzaMin: 0, confianzaMax: 0 };
  if (valores.length < 2) {
    const v = valores[0] ?? 0;
    return { nivel: v, tendencia: 0, forecast: v, confianzaMin: v * 0.8, confianzaMax: v * 1.2 };
  }
  const alpha = 0.3;
  const beta = 0.1;
  let nivel: number = valores[0] as number;
  let tendencia: number = (valores[1] as number) - (valores[0] as number);
  for (let i = 1; i < valores.length; i++) {
    const prevNivel = nivel;
    const vi = valores[i] as number;
    nivel = alpha * vi + (1 - alpha) * (nivel + tendencia);
    tendencia = beta * (nivel - prevNivel) + (1 - beta) * tendencia;
  }
  const forecast = nivel + horizonte * tendencia;
  const residuos = valores.map((v, i) => {
    const estimado: number = i === 0 ? (v as number) : (i === 1 ? (valores[0] as number) : nivel + (i - valores.length + 1) * tendencia);
    return ((v as number) - estimado) ** 2;
  });
  const mse = residuos.reduce((a, b) => a + b, 0) / valores.length;
  const margen = 1.96 * Math.sqrt(mse);
  return {
    nivel: round2(nivel),
    tendencia: round2(tendencia),
    forecast: round2(Math.max(0, forecast)),
    confianzaMin: round2(Math.max(0, forecast - margen)),
    confianzaMax: round2(forecast + margen),
  };
}

function calcularVariacionInteranual(ventasPorMes: { mes: string; promedio: number }[], mesEvaluar: string): number | null {
  const parts = mesEvaluar.split("-");
  const anioActual = parseInt(parts[0] ?? "0");
  const mesStr = parts[1] ?? "";
  const mesAnioPasado = `${anioActual - 1}-${mesStr}`;
  const actual = ventasPorMes.find((m) => m.mes === mesEvaluar);
  const pasado = ventasPorMes.find((m) => m.mes === mesAnioPasado);
  if (!actual || !pasado || pasado.promedio === 0) return null;
  return round2(((actual.promedio - pasado.promedio) / pasado.promedio) * 100);
}

function esFechaFestiva(mes: string): { festivo: string; ajuste: number } | null {
  const festividades: Record<string, { nombre: string; ajuste: number }> = {
    "12": { nombre: "Navidad / Fin de año", ajuste: 1.3 },
    "11": { nombre: "Black Friday / Navidad temprana", ajuste: 1.15 },
    "01": { nombre: "Año Nuevo / Rebajas", ajuste: 0.85 },
    "02": { nombre: "San Valentín", ajuste: 1.1 },
    "07": { nombre: "Vacaciones escolares", ajuste: 0.95 },
    "08": { nombre: "Vacaciones escolares", ajuste: 0.95 },
  };
  const mesNum = mes.split("-")[1] ?? "";
  const info = festividades[mesNum];
  return info ? { festivo: info.nombre, ajuste: info.ajuste } : null;
}

/* ═══════════════════════════════════════════
   1. PATRONES DE VENTAS
   ═══════════════════════════════════════════ */

export const GenerarInformePatrones: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log("[AnalisisControllers] [GenerarInformePatrones] body:", JSON.stringify(req.body, null, 2));
    const { sucursalId, rangoInicio, rangoFin } = req.body;
    const inicio = rangoInicio ? new Date(rangoInicio) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const fin = rangoFin ? new Date(rangoFin) : new Date();

    const where: any = {
      fecha: { gte: inicio, lte: fin },
      status: { not: "cancelado" },
    };
    if (sucursalId) where.sucursalId = sucursalId;

    const [compras, comprasConDetalles, clientes] = await Promise.all([
      prisma.compra.findMany({
        where,
        select: { id: true, total: true, fecha: true, clienteId: true, sucursalId: true, sucursal: { select: { nombre: true } } },
        orderBy: { fecha: "asc" },
      }),
      prisma.compra.findMany({
        where,
        include: {
          sucursal: { select: { nombre: true } },
          detalles: { include: { producto: { select: { nombre: true, costo: true, categoria: { select: { nombre: true } } } } } },
        },
      }),
      prisma.cliente.findMany({ select: { id: true, nombre: true, apellido: true, createdAt: true } }),
    ]);

    // --- Descriptiva ---
    const totalVentas = compras.reduce((s, p) => s + p.total, 0);
    const totalCompras = compras.length;
    const ticketPromedio = totalCompras > 0 ? totalVentas / totalCompras : 0;

    const ventasPorSucursal: Record<string, number> = {};
    compras.forEach((c) => {
      const name = c.sucursal?.nombre || "Desconocida";
      ventasPorSucursal[name] = (ventasPorSucursal[name] || 0) + c.total;
    });

    const catMap: Record<string, number> = {};
    comprasConDetalles.forEach((c) => {
      c.detalles.forEach((d) => {
        const cat = d.producto?.categoria?.nombre || "Sin categoria";
        catMap[cat] = (catMap[cat] || 0) + d.cantidad * d.precioUnit;
      });
    });

    // --- Top 20 productos por categoría con ventas por sucursal ---
    const productoDetalleMap: Record<string, { unidades: number; categoria: string; sucursales: Record<string, number> }> = {};
    comprasConDetalles.forEach((c) => {
      const suc = c.sucursal?.nombre || "Desconocida";
      c.detalles.forEach((d) => {
        const name = d.producto?.nombre || `Producto #${d.productoId}`;
        if (!productoDetalleMap[name]) productoDetalleMap[name] = { unidades: 0, categoria: d.producto?.categoria?.nombre || "Sin categoria", sucursales: {} };
        productoDetalleMap[name].unidades += d.cantidad;
        productoDetalleMap[name].sucursales[suc] = (productoDetalleMap[name].sucursales[suc] || 0) + d.cantidad;
      });
    });
    const topProductos = Object.entries(productoDetalleMap)
      .sort((a, b) => b[1].unidades - a[1].unidades)
      .slice(0, 20)
      .map(([nombre, v]) => ({ nombre, categoria: v.categoria, unidades: v.unidades, ventasPorSucursal: v.sucursales }));

    // --- Ventas por mes: por sucursal + promedio, min, max, compras, ticketPromedio ---
    const ventasMesSucMap: Record<string, Record<string, { total: number; compras: number }>> = {};
    compras.forEach((c) => {
      const mes = c.fecha.toISOString().slice(0, 7);
      const suc = c.sucursal?.nombre || "Desconocida";
      if (!ventasMesSucMap[mes]) ventasMesSucMap[mes] = {};
      if (!ventasMesSucMap[mes][suc]) ventasMesSucMap[mes][suc] = { total: 0, compras: 0 };
      ventasMesSucMap[mes][suc].total += c.total;
      ventasMesSucMap[mes][suc].compras += 1;
    });
    const mesesSorted = Object.entries(ventasMesSucMap).sort((a, b) => a[0].localeCompare(b[0]));
    const ventasPorMes = mesesSorted.map(([mes, porSuc]) => {
      const valores = Object.values(porSuc).map((v) => v.total);
      const promedio = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
      const ventasPorSucursal = Object.entries(porSuc).map(([sucursal, v]) => ({
        sucursal,
        total: round2(v.total),
        compras: v.compras,
        ticketPromedio: v.compras > 0 ? round2(v.total / v.compras) : 0,
      }));
      return { mes, ventasPorSucursal, promedio: round2(promedio), min: round2(Math.min(...valores)), max: round2(Math.max(...valores)) };
    });

    // --- RFM ---
    const clientesCompras: Record<number, { total: number; count: number; last: Date }> = {};
    compras.forEach((c) => {
      const entry = clientesCompras[c.clienteId];
      if (!entry) {
        clientesCompras[c.clienteId] = { total: c.total, count: 1, last: c.fecha };
      } else {
        entry.total += c.total;
        entry.count++;
        if (c.fecha > entry.last) entry.last = c.fecha;
      }
    });

    const rfmClientes = Object.entries(clientesCompras).map(([id, v]) => {
      const c = clientes.find((cl) => cl.id === +id);
      const diasDesdeUltCompra = Math.floor((Date.now() - v.last.getTime()) / (1000 * 60 * 60 * 24));
      let segmento = "inactivo";
      if (diasDesdeUltCompra <= 30 && v.count >= 6 && v.total >= 500) segmento = "constante";
      else if (diasDesdeUltCompra <= 60 && v.count >= 3 && v.total >= 200) segmento = "leal";
      else if (diasDesdeUltCompra <= 90) segmento = "riesgo";
      return { nombre: `${c?.nombre || "Cliente"} ${c?.apellido || id}`, compras: v.count, totalGastado: v.total, ultimaCompra: v.last.toISOString().slice(0, 10), segmento };
    });

    const segmentos = {
      constante: rfmClientes.filter((c) => c.segmento === "constante"),
      leales: rfmClientes.filter((c) => c.segmento === "leal"),
      riesgo: rfmClientes.filter((c) => c.segmento === "riesgo"),
      inactivos: rfmClientes.filter((c) => c.segmento === "inactivo"),
    };

    // --- Market Basket con Lift ---
    const totalTransacciones = comprasConDetalles.length;
    const productoCountMap: Record<string, number> = {};
    const basketMap: Record<string, number> = {};
    comprasConDetalles.forEach((c) => {
      const nombres = c.detalles.map((d) => d.producto?.nombre || `Prod#${d.productoId}`).sort();
      nombres.forEach((n) => { productoCountMap[n] = (productoCountMap[n] || 0) + 1; });
      for (let i = 0; i < nombres.length; i++) {
        for (let j = i + 1; j < nombres.length; j++) {
          const key = `${nombres[i]}|||${nombres[j]}`;
          basketMap[key] = (basketMap[key] || 0) + 1;
        }
      }
    });
    const marketBasket = (Object.entries(basketMap) as [string, number][])
      .map(([k, coocurrencia]) => {
        const parts = k.split("|||");
        const a = parts[0] ?? "";
        const b = parts[1] ?? "";
        const pA = (productoCountMap[a] ?? 0) / totalTransacciones;
        const pB = (productoCountMap[b] ?? 0) / totalTransacciones;
        const pAB = coocurrencia / totalTransacciones;
        const lift = pA > 0 && pB > 0 ? round4(pAB / (pA * pB)) : 0;
        return { productoA: a, productoB: b, coocurrencia, lift, interpretacion: lift > 1.2 ? "sinergia" : lift < 0.8 ? "sustituto" : "neutro" };
      })
      .sort((a, b) => b.lift - a.lift)
      .slice(0, 10);

    // --- Churn ---
    const clientesSinCompra90d = clientes.filter((c) => {
      const last = compras.filter((p) => p.clienteId === c.id).sort((a, b) => b.fecha.getTime() - a.fecha.getTime())[0];
      if (!last) return true;
      return Date.now() - last.fecha.getTime() > 90 * 24 * 60 * 60 * 1000;
    }).length;

    // --- CLV ---
    const clvValores = Object.values(clientesCompras).map((v) => v.total);
    const clvPromedio = clvValores.length > 0 ? clvValores.reduce((a, b) => a + b, 0) / clvValores.length : 0;

    // --- Forecasting: Holt + variación interanual ---
    const promediosMensuales = ventasPorMes.map((m) => m.promedio);
    const holt = holtForecast(promediosMensuales, 1);
    const mesSiguiente = (() => {
      const last = ventasPorMes[ventasPorMes.length - 1];
      if (!last) return { mes: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7), promedio: holt.forecast };
      const parts = last.mes.split("-").map(Number);
      const y = parts[0] ?? new Date().getFullYear();
      const m = parts[1] ?? 0;
      const sig = new Date(y, m, 1);
      return { mes: sig.toISOString().slice(0, 7), promedio: holt.forecast };
    })();
    const variacionInteranual = calcularVariacionInteranual(ventasPorMes, mesSiguiente.mes);
    const festividad = esFechaFestiva(mesSiguiente.mes);
    const variacionFinal = variacionInteranual ?? (festividad ? (festividad.ajuste - 1) * 100 : 0);
    const ajusteFestivo = festividad ? festividad.ajuste : 1;
    const forecastAjustado = round2(holt.forecast * ajusteFestivo);
    const tendencia = holt.tendencia !== 0 ? round2((holt.tendencia / holt.nivel) * 100) : 0;

    // --- Alertas de churn ---
    const alertas: any[] = [];
    segmentos.inactivos.slice(0, 5).forEach((c) => {
      alertas.push({ tipo: "churn", cliente: c.nombre, diasSinCompra: c.ultimaCompra ? Math.floor((Date.now() - new Date(c.ultimaCompra).getTime()) / (1000 * 60 * 60 * 24)) : null });
    });

    const dataJsonCompleto = {
      periodo: { inicio: inicio.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) },
      descriptiva: {
        totalVentas: round2(totalVentas),
        totalCompras,
        ticketPromedio: round2(ticketPromedio),
        ventasPorSucursal: Object.entries(ventasPorSucursal).map(([sucursal, total]) => ({ sucursal, total: round2(total) })),
        ventasPorCategoria: Object.entries(catMap).map(([categoria, total]) => ({ categoria, total: round2(total) })),
      },
      ventasPorMes,
      topProductos,
      rfm: {
        segmentos: {
          constante: { cantidad: segmentos.constante.length, ticketPromedio: segmentos.constante.length > 0 ? round2(segmentos.constante.reduce((a, b) => a + b.totalGastado, 0) / segmentos.constante.length) : 0 },
          leales: { cantidad: segmentos.leales.length, ticketPromedio: segmentos.leales.length > 0 ? round2(segmentos.leales.reduce((a, b) => a + b.totalGastado, 0) / segmentos.leales.length) : 0 },
          riesgo: { cantidad: segmentos.riesgo.length, ticketPromedio: segmentos.riesgo.length > 0 ? round2(segmentos.riesgo.reduce((a, b) => a + b.totalGastado, 0) / segmentos.riesgo.length) : 0 },
          inactivos: { cantidad: segmentos.inactivos.length, ticketPromedio: segmentos.inactivos.length > 0 ? round2(segmentos.inactivos.reduce((a, b) => a + b.totalGastado, 0) / segmentos.inactivos.length) : 0 },
        },
        topClientes: [...rfmClientes].sort((a, b) => b.totalGastado - a.totalGastado).slice(0, 10),
      },
      marketBasket,
      churn: { tasaRetencion: clientes.length > 0 ? round2((1 - clientesSinCompra90d / clientes.length) * 100) : 100, tasaChurn: clientes.length > 0 ? round2((clientesSinCompra90d / clientes.length) * 100) : 0, clientesSinCompra90d },
      clv: { clvPromedio: round2(clvPromedio) },
      forecasting: {
        ventasEstimadasProximoMes: forecastAjustado,
        tendenciaPct: tendencia,
        confianzaMin: holt.confianzaMin,
        confianzaMax: holt.confianzaMax,
        variacionInteranualPct: variacionInteranual,
        festividad: festividad?.festivo ?? null,
        ajusteFestivo: ajusteFestivo,
        metodo: holt.nivel !== holt.forecast ? "holt_doble_exponencial" : "promedio_simple",
      },
      alertas,
    };

    const dataJsonIA = {
      periodo: dataJsonCompleto.periodo,
      kpisClave: {
        totalVentas: dataJsonCompleto.descriptiva.totalVentas,
        ticketPromedio: dataJsonCompleto.descriptiva.ticketPromedio,
        tasaChurn: dataJsonCompleto.churn.tasaChurn,
        clvPromedio: dataJsonCompleto.clv.clvPromedio,
      },
      topCategorias: dataJsonCompleto.descriptiva.ventasPorCategoria.slice(0, 3).map((c: any) => `${c.categoria}: $${c.total}`),
      rfmResumen: {
        constante: dataJsonCompleto.rfm.segmentos.constante.cantidad,
        leales: dataJsonCompleto.rfm.segmentos.leales.cantidad,
        riesgo: dataJsonCompleto.rfm.segmentos.riesgo.cantidad,
        inactivos: dataJsonCompleto.rfm.segmentos.inactivos.cantidad,
      },
      forecasting: {
        ventasEstimadasProximoMes: forecastAjustado,
        tendenciaPct: tendencia,
        confianzaMin: holt.confianzaMin,
        confianzaMax: holt.confianzaMax,
        variacionInteranualPct: variacionInteranual,
        variacionFinalPct: round2(variacionFinal),
        festividad: festividad?.festivo ?? null,
        ajusteFestivo: ajusteFestivo,
        metodo: holt.nivel !== holt.forecast ? "holt_doble_exponencial" : "promedio_simple",
      },
      alertasCount: { churn: alertas.filter((a) => a.tipo === "churn").length },
    };

    const insight = await generarInsightPatrones(dataJsonIA);

    const informe = await prisma.informeAnalitico.create({
      data: {
        tipoAnalisis: "patrones",
        sucursalId: sucursalId || null,
        rangoInicio: inicio,
        rangoFin: fin,
        dataJson: dataJsonCompleto as any,
        insightIA: insight,
      },
    });

    res.json({ message: "Informe generado", data: informe });
  } catch (error) {
    console.error("Error generando informe de patrones:", error);
    res.status(500).json({ message: "Error generando informe" });
  }
};

/* ═══════════════════════════════════════════
   2. ZONAS DE DEMANDA / EXPANSIÓN
   ═══════════════════════════════════════════ */

export const GenerarInformeDemanda: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log("[AnalisisControllers] [GenerarInformeDemanda] body:", JSON.stringify(req.body, null, 2));
    const { sucursalId, rangoInicio, rangoFin } = req.body;
    const inicio = rangoInicio ? new Date(rangoInicio) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const fin = rangoFin ? new Date(rangoFin) : new Date();

    const [sucursales, conexiones, competidores, compras] = await Promise.all([
      prisma.sucursal.findMany({ where: { status: true }, include: { compras: { where: { fecha: { gte: inicio, lte: fin }, status: { not: "cancelado" } }, select: { total: true } } } }),
      prisma.conexion.findMany({ where: { fecha: { gte: inicio, lte: fin } }, select: { latitud: true, longitud: true, clienteId: true } }),
      prisma.competidor.findMany({ select: { nombre: true, coordenadasLat: true, coordenadasLng: true, ratingPromedio: true, ciudad: true } }),
      prisma.compra.findMany({ where: { fecha: { gte: inicio, lte: fin }, status: { not: "cancelado" } }, select: { total: true, sucursal: { select: { nombre: true, ciudad: true } } } }),
    ]);

    // --- Sucursales existentes ---
    const sucursalesData = sucursales.map((s) => ({
      nombre: s.nombre,
      ciudad: s.ciudad,
      lat: s.coordenadasLat,
      lng: s.coordenadasLng,
      ventasTotales: round2(s.compras.reduce((a, c) => a + c.total, 0)),
    }));

    // --- Clustering geografico de conexiones ---
    const zonaMap: Record<string, { lat: number; lng: number; visitas: number; clientesUnicos: Set<number> }> = {};
    conexiones.forEach((c) => {
      const key = `${c.latitud.toFixed(2)},${c.longitud.toFixed(2)}`;
      if (!zonaMap[key]) zonaMap[key] = { lat: +c.latitud.toFixed(2), lng: +c.longitud.toFixed(2), visitas: 0, clientesUnicos: new Set() };
      zonaMap[key].visitas++;
      if (c.clienteId) zonaMap[key].clientesUnicos.add(c.clienteId);
    });
    const zonas = Object.values(zonaMap).map((z) => ({ ...z, clientesUnicos: z.clientesUnicos.size })).sort((a, b) => b.visitas - a.visitas);

    // --- Zonas sin sucursal ---
    const zonasSinSucursal = zonas.filter((z) => {
      return !sucursales.some((s) => {
        const dist = haversineDistanceKm(s.coordenadasLat, s.coordenadasLng, z.lat, z.lng);
        return dist < 5;
      });
    }).slice(0, 10);

    // --- Competidores por zona ---
    const competidoresPorZona: Record<string, { count: number; ratingPromedio: number }> = {};
    competidores.forEach((c) => {
      const zona = c.ciudad || "Desconocida";
      if (!competidoresPorZona[zona]) competidoresPorZona[zona] = { count: 0, ratingPromedio: 0 };
      competidoresPorZona[zona].count++;
      competidoresPorZona[zona].ratingPromedio += c.ratingPromedio || 0;
    });
    Object.keys(competidoresPorZona).forEach((z) => {
      const entry = competidoresPorZona[z];
      if (entry && entry.count > 0) entry.ratingPromedio = round2(entry.ratingPromedio / entry.count);
    });

    // --- Cobertura ---
    const radioKm = 5;
    const todosClientesConexion = new Set(conexiones.filter((c) => c.clienteId).map((c) => c.clienteId));
    const clientesConSucursalCerca = new Set<number>();
    conexiones.filter((c) => c.clienteId).forEach((con) => {
      sucursales.forEach((s) => {
        const dist = haversineDistanceKm(s.coordenadasLat, s.coordenadasLng, con.latitud, con.longitud);
        if (dist < radioKm && con.clienteId) clientesConSucursalCerca.add(con.clienteId);
      });
    });
    const totalClientesConexion = todosClientesConexion.size;
    const cobertura = totalClientesConexion > 0 ? round2((clientesConSucursalCerca.size / totalClientesConexion) * 100) : 0;

    const dataJsonCompleto = {
      periodo: { inicio: inicio.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) },
      sucursalesExistentes: sucursalesData,
      zonasConDemanda: zonas.slice(0, 15),
      zonasSinSucursal,
      competidoresPorZona,
      coberturaActual: {
        radioAnalizadoKm: radioKm,
        clientesEnCobertura: clientesConSucursalCerca.size,
        clientesFueraCobertura: totalClientesConexion - clientesConSucursalCerca.size,
        porcentajeCobertura: cobertura,
      },
    };

    const top3Ventas = sucursalesData.sort((a, b) => b.ventasTotales - a.ventasTotales).slice(0, 3).map((s) => `${s.nombre}: $${s.ventasTotales}`);
    const zonasSaturadas = Object.entries(competidoresPorZona).filter(([_, v]) => v.count >= 5).length;

    const dataJsonIA = {
      periodo: dataJsonCompleto.periodo,
      resumenSucursales: { cantidad: sucursalesData.length, top3Ventas },
      cobertura: { porcentaje: cobertura, clientesFuera: totalClientesConexion - clientesConSucursalCerca.size },
      competidoresResumen: { totalZonas: Object.keys(competidoresPorZona).length, zonasSaturadas },
      zonasSinSucursalTop3: zonasSinSucursal.slice(0, 3).map((z) => ({ lat: z.lat, lng: z.lng, visitas: z.visitas })),
    };

    const insight = await generarInsightDemanda(dataJsonIA);

    const informe = await prisma.informeAnalitico.create({
      data: {
        tipoAnalisis: "demanda_geo",
        sucursalId: sucursalId || null,
        rangoInicio: inicio,
        rangoFin: fin,
        dataJson: dataJsonCompleto as any,
        insightIA: insight,
      },
    });

    res.json({ message: "Informe generado", data: informe });
  } catch (error) {
    console.error("Error generando informe de demanda:", error);
    res.status(500).json({ message: "Error generando informe" });
  }
};

/* ═══════════════════════════════════════════
   3. RENDIMIENTO GENERAL
   ═══════════════════════════════════════════ */

export const GenerarInformeRendimiento: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log("[AnalisisControllers] [GenerarInformeRendimiento] body:", JSON.stringify(req.body, null, 2));
    const { sucursalId, rangoInicio, rangoFin } = req.body;
    const inicio = rangoInicio ? new Date(rangoInicio) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const fin = rangoFin ? new Date(rangoFin) : new Date();
    const inicioAnt = new Date(inicio.getTime() - (fin.getTime() - inicio.getTime()));
    const fPeriodo = factorPeriodo(inicio, fin);

    const whereActual: any = { fecha: { gte: inicio, lte: fin }, status: { not: "cancelado" } };
    const whereAnterior: any = { fecha: { gte: inicioAnt, lt: inicio }, status: { not: "cancelado" } };
    if (sucursalId) { whereActual.sucursalId = sucursalId; whereAnterior.sucursalId = sucursalId; }

    const [comprasActual, comprasAnterior, inventarios, ofertasActivas, ultimaTasa, clientesNuevos, personal] = await Promise.all([
      prisma.compra.findMany({ where: whereActual, select: { total: true, fecha: true, sucursalId: true, sucursal: { select: { nombre: true } } } }),
      prisma.compra.findMany({ where: whereAnterior, select: { total: true, sucursalId: true, sucursal: { select: { nombre: true } } } }),
      prisma.inventario.findMany({
        where: sucursalId ? { sucursalId } : {},
        include: { producto: { select: { nombre: true, costo: true } }, sucursal: { select: { nombre: true } } },
      }),
      prisma.oferta.count({ where: { activo: true, fechaInicio: { lte: fin }, fechaFin: { gte: inicio } } }),
      prisma.tasaCambio.findFirst({ where: { moneda: "USD" }, orderBy: { fecha: "desc" }, select: { precio: true } }),
      prisma.cliente.count({ where: { createdAt: { gte: inicio, lte: fin } } }),
      prisma.personal.findMany({
        where: { status: true, ...(sucursalId ? { sucursalId } : {}) },
        include: { tipoPersonal: { select: { pagaMensual: true } }, sucursal: { select: { nombre: true } } },
      }),
    ]);

    // --- Compras con detalle para costo ---
    const comprasConDetalle = await prisma.compra.findMany({
      where: whereActual,
      include: { detalles: { include: { producto: { select: { costo: true } } } }, sucursal: { select: { nombre: true } } },
    });

    const revenueActual = comprasActual.reduce((s, c) => s + c.total, 0);
    const totalComprasActual = comprasActual.length;
    const ticketPromedio = totalComprasActual > 0 ? revenueActual / totalComprasActual : 0;
    const revenueAnterior = comprasAnterior.reduce((s, c) => s + c.total, 0);
    const crecimiento = revenueAnterior > 0 ? round2(((revenueActual - revenueAnterior) / revenueAnterior) * 100) : null;

    const ventasPorMes: Record<string, number> = {};
    comprasActual.forEach((c) => { const m = c.fecha.toISOString().slice(0, 7); ventasPorMes[m] = (ventasPorMes[m] || 0) + c.total; });

    // --- Costo de productos vendidos ---
    const costoProductosVendidos = comprasConDetalle.reduce((sum, c) => {
      return sum + c.detalles.reduce((s, d) => s + ((d.costoUnit ?? d.producto.costo) || 0) * d.cantidad, 0);
    }, 0);

    // --- Inventario valorado con costo real ---
    const valorInventarioTotal = inventarios.reduce((s, i) => s + i.stockActual * (i.producto.costo || 0), 0);
    const stockBajo = inventarios.filter((i) => i.stockActual <= i.stockMinimo);
    const stockExceso = inventarios.filter((i) => i.stockActual > i.stockMinimo * 3);

    // --- Gastos de personal ---
    const gastoPersonalMensual = personal.reduce((sum, p) => {
      const sueldo = p.sueldoMensual ?? p.tipoPersonal?.pagaMensual ?? 0;
      return sum + sueldo;
    }, 0);
    const gastoPersonalPeriodo = round2(gastoPersonalMensual * fPeriodo);

    const gananciaNeta = round2(revenueActual - costoProductosVendidos - gastoPersonalPeriodo);
    const margenBrutoPct = revenueActual > 0 ? round2(((revenueActual - costoProductosVendidos) / revenueActual) * 100) : 0;

    // --- Per-sucursal breakdown ---
    const costoPorSucursal: Record<string, number> = {};
    comprasConDetalle.forEach((c) => {
      const key = c.sucursal?.nombre || "Desconocida";
      const costo = c.detalles.reduce((s, d) => s + ((d.costoUnit ?? d.producto.costo) || 0) * d.cantidad, 0);
      costoPorSucursal[key] = (costoPorSucursal[key] || 0) + costo;
    });

    const valorInventarioPorSucursal: Record<string, number> = {};
    inventarios.forEach((i) => {
      const key = i.sucursal?.nombre || "Desconocida";
      if (!valorInventarioPorSucursal[key]) valorInventarioPorSucursal[key] = 0;
      valorInventarioPorSucursal[key] += i.stockActual * (i.producto.costo || 0);
    });

    const sucursalMap: Record<string, any> = {};
    comprasActual.forEach((c) => {
      const key = c.sucursal?.nombre || "Desconocida";
      if (!sucursalMap[key]) sucursalMap[key] = { nombre: key, revenue: 0, totalCompras: 0, stockBajo: 0, stockTotal: 0, empleados: 0, rotacion: 0, ticketPromedio: 0, crecimientoVsAnteriorPct: null, costoProductosVendidos: 0, gastoPersonalPeriodo: 0, gananciaNeta: 0, margenBrutoPct: 0, valorInventario: 0 };
      sucursalMap[key].revenue += c.total;
      sucursalMap[key].totalCompras += 1;
    });
    sucursalMap["Desconocida"] && delete sucursalMap["Desconocida"];

    // Inventory per sucursal
    inventarios.forEach((i) => {
      const key = i.sucursal?.nombre || "Desconocida";
      if (sucursalMap[key]) {
        if (i.stockActual <= i.stockMinimo) sucursalMap[key].stockBajo += 1;
        sucursalMap[key].stockTotal += i.stockActual;
      }
    });

    // Personal per sucursal
    personal.forEach((p) => {
      const key = p.sucursal?.nombre || "Sin sucursal";
      if (sucursalMap[key]) {
        sucursalMap[key].empleados += 1;
        const sueldo = p.sueldoMensual ?? p.tipoPersonal?.pagaMensual ?? 0;
        sucursalMap[key].gastoPersonalPeriodo = round2((sucursalMap[key].gastoPersonalPeriodo || 0) + sueldo * fPeriodo);
      }
    });

    // Costos per sucursal
    Object.entries(costoPorSucursal).forEach(([key, costo]) => {
      if (sucursalMap[key]) sucursalMap[key].costoProductosVendidos = round2(costo);
    });

    // Valor inventario per sucursal
    Object.entries(valorInventarioPorSucursal).forEach(([key, val]) => {
      if (sucursalMap[key]) sucursalMap[key].valorInventario = round2(val);
    });

    // Growth per sucursal
    const antPorSucursal: Record<string, number> = {};
    comprasAnterior.forEach((c) => {
      const key = c.sucursal?.nombre || (sucursalId?.toString() || "Desconocida");
      antPorSucursal[key] = (antPorSucursal[key] || 0) + c.total;
    });

    const sucursalesData = Object.values(sucursalMap).map((s: any) => {
      const revenueAnt = antPorSucursal[s.nombre] || 0;
      const crecimientoPct = revenueAnt > 0 ? round2(((s.revenue - revenueAnt) / revenueAnt) * 100) : null;
      const gastoPersonal = s.gastoPersonalPeriodo || 0;
      const costoProd = s.costoProductosVendidos || 0;
      return {
        nombre: s.nombre,
        revenue: round2(s.revenue),
        totalCompras: s.totalCompras,
        ticketPromedio: s.totalCompras > 0 ? round2(s.revenue / s.totalCompras) : 0,
        empleados: s.empleados,
        stockBajo: s.stockBajo,
        stockTotal: s.stockTotal,
        rotacion: s.valorInventario > 0 ? round2(costoProd / s.valorInventario) : 0,
        crecimientoVsAnteriorPct: crecimientoPct,
        costoProductosVendidos: round2(costoProd),
        gastoPersonalPeriodo: round2(gastoPersonal),
        gananciaNeta: round2(s.revenue - costoProd - gastoPersonal),
        margenBrutoPct: s.revenue > 0 ? round2(((s.revenue - costoProd) / s.revenue) * 100) : 0,
        valorInventario: s.valorInventario,
      };
    }).sort((a: any, b: any) => b.revenue - a.revenue);

    const mejor = sucursalesData[0] || null;
    const peor = sucursalesData[sucursalesData.length - 1] || null;

    const dataJsonCompleto = {
      periodo: { inicio: inicio.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) },
      resumen: {
        revenueTotal: round2(revenueActual),
        totalCompras: totalComprasActual,
        ticketPromedio: round2(ticketPromedio),
        clientesNuevos,
        ofertasActivas,
        crecimientoVsAnteriorPct: crecimiento,
        costoProductosVendidos: round2(costoProductosVendidos),
        gastoPersonalPeriodo,
        gananciaNeta,
        margenBrutoPct,
        totalSucursales: sucursalesData.length,
        mejor,
        peor,
      },
      sucursales: sucursalesData,
      ventasPorMes: Object.entries(ventasPorMes).map(([mes, total]) => ({ mes, total: round2(total) })),
      inventario: {
        valorTotalEstimado: round2(valorInventarioTotal),
        stockBajo: stockBajo.map((i) => ({ producto: i.producto.nombre, stock: i.stockActual, minimo: i.stockMinimo, costoUnitario: i.producto.costo, sucursal: i.sucursal?.nombre })),
        stockExceso: stockExceso.slice(0, 5).map((i) => ({ producto: i.producto.nombre, stock: i.stockActual, minimo: i.stockMinimo, costoUnitario: i.producto.costo, sucursal: i.sucursal?.nombre })),
      },
      tasaCambio: ultimaTasa ? { usdAVes: ultimaTasa.precio, revenueEnVes: round2(revenueActual * ultimaTasa.precio) } : null,
      personal: {
        totalEmpleados: personal.length,
        gastoPersonalMensual: round2(gastoPersonalMensual),
        gastoPersonalPeriodo,
        empleadosPorSucursal: Object.entries(
          personal.reduce((acc: Record<string, number>, p) => {
            const suc = p.sucursal?.nombre || "Sin sucursal";
            acc[suc] = (acc[suc] || 0) + 1;
            return acc;
          }, {})
        ).map(([sucursal, cantidad]) => ({ sucursal, cantidad })),
      },
    };

    const mejoresSuc = sucursalesData.slice(0, 2).map((s: any) => `${s.nombre} ($${s.revenue}, ${s.margenBrutoPct}% margen)`);
    const peoresSuc = sucursalesData.slice(-2).reverse().map((s: any) => `${s.nombre} ($${s.revenue}, ${s.margenBrutoPct}% margen)`);

    const dataJsonIA = {
      periodo: dataJsonCompleto.periodo,
      kpis: {
        revenueTotal: dataJsonCompleto.resumen.revenueTotal,
        ticketPromedio: dataJsonCompleto.resumen.ticketPromedio,
        crecimientoVsAnteriorPct: dataJsonCompleto.resumen.crecimientoVsAnteriorPct,
        clientesNuevos: dataJsonCompleto.resumen.clientesNuevos,
        ofertasActivas: dataJsonCompleto.resumen.ofertasActivas,
        gananciaNeta: dataJsonCompleto.resumen.gananciaNeta,
        margenBrutoPct: dataJsonCompleto.resumen.margenBrutoPct,
      },
      inventarioResumen: {
        stockBajoCount: stockBajo.length,
        stockExcesoCount: stockExceso.length,
        valorTotalEstimado: dataJsonCompleto.inventario.valorTotalEstimado,
      },
      tasaCambio: dataJsonCompleto.tasaCambio,
      comparativaSucursales: {
        total: sucursalesData.length,
        mejores: mejoresSuc,
        peores: peoresSuc,
        brechaMargen: mejor && peor ? round2(mejor.margenBrutoPct - peor.margenBrutoPct) : null,
      },
    };

    const insight = await generarInsightRendimiento(dataJsonIA);

    const informe = await prisma.informeAnalitico.create({
      data: {
        tipoAnalisis: "rendimiento",
        sucursalId: sucursalId || null,
        rangoInicio: inicio,
        rangoFin: fin,
        dataJson: dataJsonCompleto as any,
        insightIA: insight,
      },
    });

    res.json({ message: "Informe generado", data: informe });
  } catch (error) {
    console.error("Error generando informe de rendimiento:", error);
    res.status(500).json({ message: "Error generando informe" });
  }
};

/* ═══════════════════════════════════════════
   4. RENDIMIENTO POR SUCURSAL
   ═══════════════════════════════════════════ */

export const GenerarInformeSucursal: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log("[AnalisisControllers] [GenerarInformeSucursal] body:", JSON.stringify(req.body, null, 2));
    const { sucursalId, rangoInicio, rangoFin } = req.body;
    const inicio = rangoInicio ? new Date(rangoInicio) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const fin = rangoFin ? new Date(rangoFin) : new Date();
    const inicioAnt = new Date(inicio.getTime() - (fin.getTime() - inicio.getTime()));
    const fPeriodo = factorPeriodo(inicio, fin);

    function varPct(actual: number, anterior: number): number | null {
      return anterior > 0 ? round2(((actual - anterior) / anterior) * 100) : null;
    }

    /* ════════ INDIVIDUAL: 1 SUCURSAL ════════ */
    if (sucursalId) {
      const sucursal = await prisma.sucursal.findFirst({
        where: { id: sucursalId, status: true },
        include: {
          compras: { where: { fecha: { gte: inicio, lte: fin }, status: { not: "cancelado" } }, select: { total: true, fecha: true, clienteId: true } },
          inventarios: { include: { producto: { select: { nombre: true, costo: true } } } },
          personal: { where: { status: true }, include: { tipoPersonal: { select: { pagaMensual: true } } } },
        },
      });
      if (!sucursal) { res.status(404).json({ message: "Sucursal no encontrada" }); return; }

      const [comprasDetalleActual, comprasDetalleAnterior, comprasAnteriores] = await Promise.all([
        prisma.compra.findMany({
          where: { fecha: { gte: inicio, lte: fin }, status: { not: "cancelado" }, sucursalId },
          include: { detalles: { include: { producto: { select: { costo: true } } } } },
        }),
        prisma.compra.findMany({
          where: { fecha: { gte: inicioAnt, lt: inicio }, status: { not: "cancelado" }, sucursalId },
          include: { detalles: { include: { producto: { select: { costo: true } } } } },
        }),
        prisma.compra.findMany({
          where: { fecha: { gte: inicioAnt, lt: inicio }, status: { not: "cancelado" }, sucursalId },
          select: { total: true },
        }),
      ]);

      // --- Clientes de esta sucursal (para RFM) ---
      const historiqueSucursal = await prisma.compra.findMany({
        where: { sucursalId, status: { not: "cancelado" }, fecha: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } },
        select: { clienteId: true },
      });
      const clienteIds = [...new Set(historiqueSucursal.map((c) => c.clienteId))];

      const [clientes, comprasClientes] = await Promise.all([
        prisma.cliente.findMany({
          where: { id: { in: clienteIds } },
          select: { id: true, nombre: true, apellido: true },
        }),
        prisma.compra.findMany({
          where: { clienteId: { in: clienteIds }, status: { not: "cancelado" }, fecha: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } },
          select: { total: true, fecha: true, clienteId: true },
        }),
      ]);

      // ── KPIs financieros ──
      const revenueActual = sucursal.compras.reduce((s, c) => s + c.total, 0);
      const totalComprasActual = sucursal.compras.length;
      const ticketActual = totalComprasActual > 0 ? revenueActual / totalComprasActual : 0;

      const revenueAnterior = comprasAnteriores.reduce((s, c) => s + c.total, 0);
      const totalComprasAnterior = comprasAnteriores.length;
      const ticketAnterior = totalComprasAnterior > 0 ? revenueAnterior / totalComprasAnterior : 0;

      function calcCogs(detalleCompras: typeof comprasDetalleActual) {
        return detalleCompras.reduce((sum, c) =>
          sum + c.detalles.reduce((s, d) => s + ((d.costoUnit ?? d.producto.costo) || 0) * d.cantidad, 0), 0);
      }
      const cogsActual = calcCogs(comprasDetalleActual);
      const cogsAnterior = calcCogs(comprasDetalleAnterior);

      const margenBrutoActual = revenueActual > 0 ? (revenueActual - cogsActual) / revenueActual * 100 : 0;
      const margenBrutoAnterior = revenueAnterior > 0 ? (revenueAnterior - cogsAnterior) / revenueAnterior * 100 : 0;

      // ── Personal y gastos ──
      const totalEmpleados = sucursal.personal.length;
      const gastoPersonalMensual = sucursal.personal.reduce((sum, p) => sum + (p.sueldoMensual ?? p.tipoPersonal?.pagaMensual ?? 0), 0);
      const gastoPersonalPeriodo = round2(gastoPersonalMensual * fPeriodo);
      const gastoPersonalPeriodoAnt = round2(gastoPersonalMensual * fPeriodo); // misma plantilla

      const gananciaNeta = round2(revenueActual - cogsActual - gastoPersonalPeriodo);
      const gananciaNetaAnt = round2(revenueAnterior - cogsAnterior - gastoPersonalPeriodoAnt);

      const margenNetoActual = revenueActual > 0 ? round2((gananciaNeta / revenueActual) * 100) : 0;
      const margenNetoAnterior = revenueAnterior > 0 ? round2((gananciaNetaAnt / revenueAnterior) * 100) : 0;

      // ── Operativo ──
      const ventasPorEmpleado = totalEmpleados > 0 ? round2(revenueActual / totalEmpleados) : 0;
      const costoPersonalPct = revenueActual > 0 ? round2((gastoPersonalPeriodo / revenueActual) * 100) : 0;
      const valorInventarioTotal = sucursal.inventarios.reduce((s, i) => s + i.stockActual * (i.producto.costo || 0), 0);
      const rotacion = valorInventarioTotal > 0 ? round2(cogsActual / valorInventarioTotal) : 0;

      // ── Inventario crítico ──
      const diasPeriodo = Math.max(1, Math.floor((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)));
      const stockBajoDetalle = sucursal.inventarios
        .filter((i) => i.stockActual <= i.stockMinimo)
        .slice(0, 5)
        .map((i) => {
          const ventasProducto = comprasDetalleActual.reduce((sum, c) =>
            sum + c.detalles.filter((d) => d.productoId === i.productoId).reduce((s, d) => s + d.cantidad, 0), 0);
          const ventaDiaria = ventasProducto / diasPeriodo;
          const diasRestantes = ventaDiaria > 0 ? Math.round(i.stockActual / ventaDiaria) : 999;
          return { producto: i.producto.nombre, stock: i.stockActual, minimo: i.stockMinimo, diasRestantes };
        });

      const stockExcesoDetalle = sucursal.inventarios
        .filter((i) => i.stockActual > i.stockMinimo * 3)
        .slice(0, 5)
        .map((i) => ({ producto: i.producto.nombre, stock: i.stockActual, minimo: i.stockMinimo }));

      // ── RFM de clientes de la sucursal ──
      const rfmMap: Record<number, { total: number; count: number; last: Date }> = {};
      comprasClientes.forEach((c) => {
        const e = rfmMap[c.clienteId];
        if (!e) { rfmMap[c.clienteId] = { total: c.total, count: 1, last: c.fecha }; }
        else { e.total += c.total; e.count++; if (c.fecha > e.last) e.last = c.fecha; }
      });
      const rfmClientes = Object.entries(rfmMap).map(([id, v]) => {
        const cl = clientes.find((c) => c.id === +id);
        const dias = Math.floor((Date.now() - v.last.getTime()) / (1000 * 60 * 60 * 24));
        let seg = "inactivo";
        if (dias <= 30 && v.count >= 6 && v.total >= 500) seg = "constante";
        else if (dias <= 60 && v.count >= 3 && v.total >= 200) seg = "leal";
        else if (dias <= 90) seg = "riesgo";
        return { nombre: `${cl?.nombre || "Cliente"} ${cl?.apellido || id}`, compras: v.count, totalGastado: v.total, ultimaCompra: v.last.toISOString().slice(0, 10), segmento: seg };
      });
      const segmentos = {
        constante: rfmClientes.filter((c) => c.segmento === "constante"),
        leales: rfmClientes.filter((c) => c.segmento === "leal"),
        riesgo: rfmClientes.filter((c) => c.segmento === "riesgo"),
        inactivos: rfmClientes.filter((c) => c.segmento === "inactivo"),
      };
      const totalUnicos = clienteIds.length;
      const recurrentes = Object.values(rfmMap).filter((v) => v.count > 1).length;
      const tasaRecurrencia = totalUnicos > 0 ? round2((recurrentes / totalUnicos) * 100) : 0;
      const clvPromedio = totalUnicos > 0 ? round2(Object.values(rfmMap).reduce((a, v) => a + v.total, 0) / totalUnicos) : 0;

      // ── Ventas por mes ──
      const vpmMap: Record<string, number> = {};
      sucursal.compras.forEach((c) => { const m = c.fecha.toISOString().slice(0, 7); vpmMap[m] = (vpmMap[m] || 0) + c.total; });

      const dataJsonCompleto = {
        periodo: { inicio: inicio.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) },
        sucursal: { nombre: sucursal.nombre, ciudad: sucursal.ciudad },
        kpis: {
          revenue: { actual: round2(revenueActual), anterior: round2(revenueAnterior), variacionPct: varPct(revenueActual, revenueAnterior) },
          ticketPromedio: { actual: round2(ticketActual), anterior: round2(ticketAnterior), variacionPct: varPct(ticketActual, ticketAnterior) },
          margenBruto: { actual: round2(margenBrutoActual), anterior: round2(margenBrutoAnterior), variacionPct: varPct(margenBrutoActual, margenBrutoAnterior) },
          margenNeto: { actual: margenNetoActual, anterior: margenNetoAnterior, variacionPct: varPct(margenNetoActual, margenNetoAnterior) },
        },
        operativo: { ventasPorEmpleado, costoPersonalPct, rotacion, totalCompras: totalComprasActual, totalEmpleados },
        ventasPorMes: Object.entries(vpmMap).sort((a, b) => a[0].localeCompare(b[0])).map(([mes, total]) => ({ mes, total: round2(total) })),
        inventario: { valorTotal: round2(valorInventarioTotal), stockBajo: stockBajoDetalle, stockExceso: stockExcesoDetalle },
        clientes: {
          totalUnicos,
          tasaRecurrencia,
          clvPromedio,
          rfm: {
            segmentos: {
              constante: { cantidad: segmentos.constante.length, ticketPromedio: segmentos.constante.length > 0 ? round2(segmentos.constante.reduce((a, b) => a + b.totalGastado, 0) / segmentos.constante.length) : 0 },
              leales: { cantidad: segmentos.leales.length, ticketPromedio: segmentos.leales.length > 0 ? round2(segmentos.leales.reduce((a, b) => a + b.totalGastado, 0) / segmentos.leales.length) : 0 },
              riesgo: { cantidad: segmentos.riesgo.length, ticketPromedio: segmentos.riesgo.length > 0 ? round2(segmentos.riesgo.reduce((a, b) => a + b.totalGastado, 0) / segmentos.riesgo.length) : 0 },
              inactivos: { cantidad: segmentos.inactivos.length, ticketPromedio: segmentos.inactivos.length > 0 ? round2(segmentos.inactivos.reduce((a, b) => a + b.totalGastado, 0) / segmentos.inactivos.length) : 0 },
            },
            topClientes: [...rfmClientes].sort((a, b) => b.totalGastado - a.totalGastado).slice(0, 5),
          },
        },
        personal: { totalEmpleados, gastoMensual: round2(gastoPersonalMensual), gastoPeriodo: gastoPersonalPeriodo },
      };

      const dataJsonIA = {
        periodo: dataJsonCompleto.periodo,
        sucursal: dataJsonCompleto.sucursal,
        kpis: {
          revenue: `$${dataJsonCompleto.kpis.revenue.actual} (${dataJsonCompleto.kpis.revenue.variacionPct != null ? (dataJsonCompleto.kpis.revenue.variacionPct >= 0 ? "+" : "") + dataJsonCompleto.kpis.revenue.variacionPct + "%" : "sin dato anterior"})`,
          ticketPromedio: `$${dataJsonCompleto.kpis.ticketPromedio.actual}`,
          margenBruto: `${dataJsonCompleto.kpis.margenBruto.actual}%`,
          margenNeto: `${dataJsonCompleto.kpis.margenNeto.actual}%`,
        },
        operativo: { ventasPorEmpleado: `$${ventasPorEmpleado}`, costoPersonalPct: `${costoPersonalPct}%`, rotacion: `${rotacion}x` },
        inventarioAlerta: stockBajoDetalle.map((i) => `${i.producto}: ${i.stock}/${i.minimo} — ${i.diasRestantes}d restantes`),
        clientesResumen: { totalUnicos, tasaRecurrencia: `${tasaRecurrencia}%`, clvPromedio: `$${clvPromedio}`, constante: segmentos.constante.length, leales: segmentos.leales.length, riesgo: segmentos.riesgo.length, inactivos: segmentos.inactivos.length },
      };

      const insight = await generarInsightSucursalIndividual(dataJsonIA);

      const informe = await prisma.informeAnalitico.create({
        data: { tipoAnalisis: "sucursal", sucursalId, rangoInicio: inicio, rangoFin: fin, dataJson: dataJsonCompleto as any, insightIA: insight },
      });
      res.json({ message: "Informe generado", data: informe });
      return;
    }

    /* ════════ COMPARATIVO: MÚLTIPLES SUCURSALES ════════ */
    const whereSucursal = { status: true };

    const [sucursales, comprasAnteriores] = await Promise.all([
      prisma.sucursal.findMany({
        where: whereSucursal,
        include: {
          compras: { where: { fecha: { gte: inicio, lte: fin }, status: { not: "cancelado" } }, select: { total: true, fecha: true } },
          inventarios: { include: { producto: { select: { nombre: true, costo: true } } } },
          personal: { include: { tipoPersonal: { select: { pagaMensual: true } } } },
        },
      }),
      prisma.compra.findMany({
        where: { fecha: { gte: inicioAnt, lt: inicio }, status: { not: "cancelado" } },
        select: { total: true, sucursalId: true },
      }),
    ]);

    const comprasDetalleActual = await prisma.compra.findMany({
      where: { fecha: { gte: inicio, lte: fin }, status: { not: "cancelado" } },
      include: { detalles: { include: { producto: { select: { costo: true } } } } },
    });

    const costoPorSucursal: Record<number, number> = {};
    comprasDetalleActual.forEach((c) => {
      const costo = c.detalles.reduce((s, d) => s + ((d.costoUnit ?? d.producto.costo) || 0) * d.cantidad, 0);
      costoPorSucursal[c.sucursalId] = (costoPorSucursal[c.sucursalId] || 0) + costo;
    });

    const valorInventarioPorSucursal: Record<number, number> = {};
    sucursales.forEach((s) => {
      valorInventarioPorSucursal[s.id] = round2(s.inventarios.reduce((sum, i) => sum + i.stockActual * (i.producto.costo || 0), 0));
    });

    const sucursalesData = Object.values(
      sucursales.reduce((acc, s) => {
        const key = s.nombre;
        const revenue = s.compras.reduce((a, c) => a + c.total, 0);
        const totalCompras = s.compras.length;
        const ticketPromedio = totalCompras > 0 ? revenue / totalCompras : 0;
        const revenueAnt = comprasAnteriores.filter((c) => c.sucursalId === s.id).reduce((a, c) => a + c.total, 0);
        const crecimiento = revenueAnt > 0 ? round2(((revenue - revenueAnt) / revenueAnt) * 100) : null;
        const stockBajo = s.inventarios.filter((i) => i.stockActual <= i.stockMinimo).length;
        const stockTotal = s.inventarios.reduce((a, i) => a + i.stockActual, 0);
        const costoProd = costoPorSucursal[s.id] || 0;
        const valorInv = valorInventarioPorSucursal[s.id] || 0;
        const rotacion = valorInv > 0 ? round2(costoProd / valorInv) : 0;
        const gastoPersonalMensual = s.personal.reduce((sum, p) => sum + (p.sueldoMensual ?? p.tipoPersonal?.pagaMensual ?? 0), 0);
        const gastoPersonalPeriodo = round2(gastoPersonalMensual * fPeriodo);
        const gananciaNeta = round2(revenue - costoProd - gastoPersonalPeriodo);
        const margenBrutoPct = revenue > 0 ? round2(((revenue - costoProd) / revenue) * 100) : 0;
        if (!acc[key]) {
          acc[key] = { nombre: s.nombre, ciudad: s.ciudad, revenue: 0, totalCompras: 0, ticketPromedio: 0, empleados: 0, stockBajo: 0, stockTotal: 0, rotacion: 0, crecimientoVsAnteriorPct: crecimiento, costoProductosVendidos: 0, gastoPersonalPeriodo: 0, gananciaNeta: 0, margenBrutoPct: 0, valorInventario: 0 };
        }
        acc[key].revenue += revenue;
        acc[key].totalCompras += totalCompras;
        acc[key].empleados += s.personal.length;
        acc[key].stockBajo += stockBajo;
        acc[key].stockTotal += stockTotal;
        acc[key].costoProductosVendidos += costoProd;
        acc[key].gastoPersonalPeriodo += gastoPersonalPeriodo;
        acc[key].gananciaNeta += gananciaNeta;
        acc[key].rotacion = rotacion;
        acc[key].valorInventario = valorInv;
        return acc;
      }, {} as Record<string, any>)
    ).map((s: any) => ({
      ...s,
      revenue: round2(s.revenue),
      ticketPromedio: s.totalCompras > 0 ? round2(s.revenue / s.totalCompras) : 0,
      margenBrutoPct: s.revenue > 0 ? round2(((s.revenue - s.costoProductosVendidos) / s.revenue) * 100) : 0,
    })).sort((a: any, b: any) => b.revenue - a.revenue);

    const dataJsonCompleto = {
      periodo: { inicio: inicio.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) },
      sucursales: sucursalesData,
      resumen: {
        totalSucursales: sucursalesData.length,
        revenueTotal: round2(sucursalesData.reduce((a, s) => a + s.revenue, 0)),
        costoTotal: round2(sucursalesData.reduce((a, s) => a + s.costoProductosVendidos, 0)),
        gastoPersonalTotal: round2(sucursalesData.reduce((a, s) => a + s.gastoPersonalPeriodo, 0)),
        gananciaNetaTotal: round2(sucursalesData.reduce((a, s) => a + s.gananciaNeta, 0)),
        mejor: sucursalesData[0] || null,
        peor: sucursalesData[sucursalesData.length - 1] || null,
      },
    };

    const mejor = dataJsonCompleto.resumen.mejor;
    const peor = dataJsonCompleto.resumen.peor;

    const dataJsonIA = {
      periodo: dataJsonCompleto.periodo,
      resumen: {
        totalSucursales: dataJsonCompleto.resumen.totalSucursales,
        revenueTotal: dataJsonCompleto.resumen.revenueTotal,
        gananciaNetaTotal: dataJsonCompleto.resumen.gananciaNetaTotal,
        mejor: mejor ? { nombre: mejor.nombre, revenue: mejor.revenue, ticketPromedio: mejor.ticketPromedio, gananciaNeta: mejor.gananciaNeta, margenBrutoPct: mejor.margenBrutoPct } : null,
        peor: peor ? { nombre: peor.nombre, revenue: peor.revenue, ticketPromedio: peor.ticketPromedio, gananciaNeta: peor.gananciaNeta, margenBrutoPct: peor.margenBrutoPct } : null,
      },
    };

    const insight = await generarInsightSucursal(dataJsonIA);

    const informe = await prisma.informeAnalitico.create({
      data: {
        tipoAnalisis: "sucursal",
        sucursalId: null,
        rangoInicio: inicio,
        rangoFin: fin,
        dataJson: dataJsonCompleto as any,
        insightIA: insight,
      },
    });

    res.json({ message: "Informe generado", data: informe });
  } catch (error) {
    console.error("Error generando informe de sucursales:", error);
    res.status(500).json({ message: "Error generando informe" });
  }
};

/* ═══════════════════════════════════════════
   5. ANÁLISIS DE EXPANSIÓN
   ═══════════════════════════════════════════ */

export const GenerarInformeExpansion: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log("[AnalisisControllers] [GenerarInformeExpansion] body:", JSON.stringify(req.body, null, 2));
    const { latitud, longitud, radioKm = 5, rangoInicio, rangoFin } = req.body;
    if (!latitud || !longitud) {
      res.status(400).json({ message: "latitud y longitud son requeridos" });
      return;
    }

    const inicio = rangoInicio ? new Date(rangoInicio) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const fin = rangoFin ? new Date(rangoFin) : new Date();

    const [conexiones, competidoresDB, categorias, sinergias, ultimasTasas] = await Promise.all([
      prisma.conexion.findMany({
        where: { latitud: { not: 0 }, longitud: { not: 0 } },
        select: { latitud: true, longitud: true, clienteId: true },
      }),
      prisma.competidor.findMany({
        where: { coordenadasLat: { not: 0 }, coordenadasLng: { not: 0 } },
        select: { nombre: true, coordenadasLat: true, coordenadasLng: true, ratingPromedio: true, ciudad: true },
      }),
      prisma.categoria.findMany({ select: { id: true, nombre: true } }),
      prisma.categoriaSinergia.findMany({ where: { activo: true } }),
      prisma.tasaCambio.findMany({ where: { moneda: "USD" }, orderBy: { fecha: "desc" }, take: 1 }),
    ]);

    const categoriasEmpresa = categorias.map((c) => c.nombre);
    const ticketPromedio = ultimasTasas[0]?.precio ?? 50;

    // Capa 1: Conexiones cercanas vía OSRM
    const radioMaxMinutos = 10;
    const conexionesCercanas: Array<{ lat: number; lng: number; duracionMinutos: number; distanciaKm: number }> = [];
    for (const con of conexiones) {
      try {
        const ruta = await getDistanciaTiempo(latitud, longitud, con.latitud, con.longitud, radioMaxMinutos);
        if (ruta.dentro) {
          conexionesCercanas.push({ lat: con.latitud, lng: con.longitud, duracionMinutos: ruta.duracionMinutos, distanciaKm: ruta.distanciaKm });
        }
      } catch {
        const distHav = haversineDistanceKm(latitud, longitud, con.latitud, con.longitud);
        if (distHav < radioKm) {
          conexionesCercanas.push({ lat: con.latitud, lng: con.longitud, duracionMinutos: distHav / 50 * 60, distanciaKm: distHav });
        }
      }
    }

    const clientesPotenciales = new Set(conexionesCercanas.map((c) => c.lat + "," + c.lng)).size;
    const conexionesTotales = conexionesCercanas.length;

    // Capa 2: Void Analysis vía Overpass
    const overpassResult = await getNearbyBusinesses(latitud, longitud, 2000);
    const negociosMap: Record<string, number> = {};
    overpassResult.negocios.forEach((n) => { negociosMap[n.type] = (negociosMap[n.type] || 0) + 1; });

    const sinergiaMap: Record<string, number> = {};
    categoriasEmpresa.forEach((catEmp) => {
      const syns = sinergias.filter((s) => s.categoriaEmpresa === catEmp);
      syns.forEach((s) => {
        const key = s.categoriaTractora;
        const matchCount = Object.keys(negociosMap).filter((tipo) =>
          tipo.toLowerCase().includes(key.toLowerCase()) ||
          key.toLowerCase().includes(tipo.toLowerCase())
        ).length;
        if (matchCount > 0) {
          sinergiaMap[key] = (sinergiaMap[key] || 0) + matchCount * s.peso;
        }
      });
    });
    const scoreCoTenencia = Math.min(100, round2(Object.values(sinergiaMap).reduce((a, b) => a + b, 0) * 3));
    const categoriasTractoras = Object.entries(sinergiaMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);

    // Capa 3: IRS (Índice de Saturación de Retailing)
    const competidoresCercanos: Array<{ nombre: string; duracionMinutos: number; distanciaKm: number; rating: number }> = [];
    for (const comp of competidoresDB) {
      try {
        const ruta = await getDistanciaTiempo(latitud, longitud, comp.coordenadasLat, comp.coordenadasLng, radioMaxMinutos);
        if (ruta.dentro) {
          competidoresCercanos.push({ nombre: comp.nombre, duracionMinutos: ruta.duracionMinutos, distanciaKm: ruta.distanciaKm, rating: comp.ratingPromedio ?? 0 });
        }
      } catch {
        const distHav = haversineDistanceKm(latitud, longitud, comp.coordenadasLat, comp.coordenadasLng);
        if (distHav < radioKm) {
          competidoresCercanos.push({ nombre: comp.nombre, duracionMinutos: distHav / 50 * 60, distanciaKm: distHav, rating: comp.ratingPromedio ?? 0 });
        }
      }
    }

    const totalCompetidores = competidoresCercanos.length;
    const ratingPromedio = totalCompetidores > 0
      ? round2(competidoresCercanos.reduce((a, c) => a + (c.rating || 0), 0) / totalCompetidores)
      : 0;
    const rf = totalCompetidores > 0
      ? totalCompetidores * (ratingPromedio > 0 ? ratingPromedio / 5 : 1)
      : 0.5;
    const Ci = clientesPotenciales;
    const REi = ticketPromedio;
    const irs = rf > 0 ? round2((Ci * REi) / rf) : 0;

    const interpretacionIRS = irs > 1.5 ? "Alta oportunidad — demanda supera la oferta" : irs >= 0.8 ? "Mercado moderado — viable con diferenciación" : "Mercado saturado — alto riesgo de guerra de precios";

    // Construcción del dataJsonCompleto
    const dataJsonCompleto = {
      ubicacionPropuesta: { latitud, longitud, radioKm },
      periodo: { inicio: inicio.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) },
      demanda: {
        clientesPotenciales: conexionesTotales,
        zonasUnicasCercanas: clientesPotenciales,
        ticketPromedioEstimado: ticketPromedio,
      },
      cobertura: {
        radioAnalizadoKm: radioKm,
        conexionesEnCobertura: conexionesTotales,
        radioMaximoMinutos: radioMaxMinutos,
      },
      coTenencia: {
        negociosComplementarios: overpassResult.total,
        categoriasTractoras,
        scoreComplementariedad: scoreCoTenencia,
        detalleNegocios: Object.entries(negociosMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tipo, count]) => ({ tipo, count })),
      },
      competencia: {
        totalCompetidores,
        ratingPromedio,
        competidoresCercanos: competidoresCercanos.slice(0, 10),
        irs,
        interpretacionIRS,
      },
      puntuacionViabilidad: round2(Math.min(100, Math.max(0, (scoreCoTenencia * 0.3 + (irs > 1.5 ? 40 : irs < 0.8 ? 10 : 25)) + Math.min(30, conexionesTotales * 2)))),
    };

    const dataJsonIA = {
      ubicacion: dataJsonCompleto.ubicacionPropuesta,
      demanda: dataJsonCompleto.demanda,
      cobertura: dataJsonCompleto.cobertura,
      coTenencia: dataJsonCompleto.coTenencia,
      competencia: dataJsonCompleto.competencia,
      puntuacionViabilidad: dataJsonCompleto.puntuacionViabilidad,
    };

    const insight = await generarInsightExpansion(dataJsonIA);

    const informe = await prisma.informeAnalitico.create({
      data: {
        tipoAnalisis: "expansion",
        sucursalId: null,
        rangoInicio: inicio,
        rangoFin: fin,
        dataJson: dataJsonCompleto as any,
        insightIA: insight,
      },
    });

    res.json({ message: "Informe de expansión generado", data: informe });
  } catch (error) {
    console.error("Error generando informe de expansión:", error);
    res.status(500).json({ message: "Error generando informe de expansión" });
  }
};

/* ═══════════════════════════════════════════
   LISTAR INFORMES / ESTADÍSTICAS / GUARDAR PDF
   ═══════════════════════════════════════════ */

export const ListarInformes: RequestHandler = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log("[AnalisisControllers] [ListarInformes]");
    const informes = await prisma.informeAnalitico.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { sucursal: { select: { nombre: true } } },
    });
    res.json({ message: "Informes encontrados", data: informes });
  } catch (error) {
    console.error("Error listando informes:", error);
    res.status(500).json({ message: "Error al obtener informes" });
  }
};

export const ObtenerEstadisticas: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { dias, sucursalId, categoriaId } = req.query;
    const diasNum = parseInt(dias as string) || 30;
    const inicio = new Date(Date.now() - diasNum * 24 * 60 * 60 * 1000);
    const fin = new Date();
    const inicioAnt = new Date(inicio.getTime() - (fin.getTime() - inicio.getTime()));

    const whereCompra: any = { fecha: { gte: inicio, lte: fin }, status: { not: "cancelado" } };
    if (sucursalId) whereCompra.sucursalId = parseInt(sucursalId as string);

    const whereCompraAnt: any = { fecha: { gte: inicioAnt, lt: inicio }, status: { not: "cancelado" } };
    if (sucursalId) whereCompraAnt.sucursalId = parseInt(sucursalId as string);

    const [compras, comprasAnt, clientes, clientesNuevos, categorias, sucursales, detalles] = await Promise.all([
      prisma.compra.findMany({ where: whereCompra, select: { id: true, total: true, fecha: true, sucursalId: true, clienteId: true } }),
      prisma.compra.findMany({ where: whereCompraAnt, select: { total: true } }),
      prisma.cliente.findMany({ select: { id: true, createdAt: true } }),
      prisma.cliente.count({ where: { createdAt: { gte: inicio, lte: fin } } }),
      prisma.categoria.findMany({ select: { id: true, nombre: true } }),
      prisma.sucursal.findMany({ where: { status: true }, select: { id: true, nombre: true } }),
      prisma.compraDetalle.findMany({
        where: { compra: { fecha: { gte: inicio, lte: fin }, status: { not: "cancelado" } } },
        select: { cantidad: true, precioUnit: true, producto: { select: { categoria: { select: { nombre: true } } } } },
      }),
    ]);

    const revenueActual = compras.reduce((s, c) => s + c.total, 0);
    const revenueAnterior = comprasAnt.reduce((s, c) => s + c.total, 0);
    const crecimiento = revenueAnterior > 0 ? round2(((revenueActual - revenueAnterior) / revenueAnterior) * 100) : null;
    const ticketPromedio = compras.length > 0 ? revenueActual / compras.length : 0;

    const ventasPorMes: Record<string, { revenue: number; compras: number }> = {};
    compras.forEach((c) => {
      const mes = c.fecha.toISOString().slice(0, 7);
      if (!ventasPorMes[mes]) ventasPorMes[mes] = { revenue: 0, compras: 0 };
      ventasPorMes[mes].revenue += c.total;
      ventasPorMes[mes].compras++;
    });

    const ventasPorSucursal: Record<string, { revenue: number; compras: number }> = {};
    compras.forEach((c) => {
      const s = sucursales.find((su) => su.id === c.sucursalId);
      const name = s?.nombre || "Desconocida";
      if (!ventasPorSucursal[name]) ventasPorSucursal[name] = { revenue: 0, compras: 0 };
      ventasPorSucursal[name].revenue += c.total;
      ventasPorSucursal[name].compras++;
    });

    const clientesPorMes: Record<string, number> = {};
    clientes.forEach((c) => {
      const mes = c.createdAt.toISOString().slice(0, 7);
      clientesPorMes[mes] = (clientesPorMes[mes] || 0) + 1;
    });

    const ventasPorCategoria: Record<string, number> = {};
    detalles.forEach((d) => {
      const cat = d.producto?.categoria?.nombre || "Sin categoría";
      ventasPorCategoria[cat] = (ventasPorCategoria[cat] || 0) + d.cantidad * d.precioUnit;
    });

    res.json({
      data: {
        periodo: { dias: diasNum, inicio: inicio.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) },
        kpis: {
          revenueTotal: round2(revenueActual),
          totalCompras: compras.length,
          ticketPromedio: round2(ticketPromedio),
          clientesNuevos,
          crecimientoVsAnteriorPct: crecimiento,
        },
        ventasPorMes: Object.entries(ventasPorMes).sort((a, b) => a[0].localeCompare(b[0])).map(([mes, v]) => ({ mes, ...v })),
        ventasPorSucursal: Object.entries(ventasPorSucursal).map(([sucursal, v]) => ({ sucursal, ...v })),
        clientesPorMes: Object.entries(clientesPorMes).sort((a, b) => a[0].localeCompare(b[0])).map(([mes, total]) => ({ mes, total })),
        ventasPorCategoria: Object.entries(ventasPorCategoria).map(([categoria, total]) => ({ categoria, total: round2(total) })),
        categorias: categorias.map((c) => c.nombre),
        sucursales,
      },
    });
  } catch (error) {
    console.error("Error obteniendo estadísticas:", error);
    res.status(500).json({ message: "Error al obtener estadísticas" });
  }
};

const REPORTES_DIR = path.join(process.cwd(), "documents", "reportes");

function generarNombreArchivo(tipo: string, sucursalNombre?: string | null): string {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const y = now.getFullYear();
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  const suc = sucursalNombre ? `_${sucursalNombre.replace(/\s+/g, "-").toLowerCase()}` : "_general";
  return `${tipo}${suc}_${d}_${m}_${y}_${h}_${min}_${s}.pdf`;
}

export const GuardarPDF: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { informeId, pdfBase64 } = req.body;
    if (!informeId || !pdfBase64) {
      res.status(400).json({ message: "informeId y pdfBase64 son requeridos" });
      return;
    }

    const informe = await prisma.informeAnalitico.findUnique({
      where: { id: parseInt(informeId) },
      include: { sucursal: { select: { nombre: true } } },
    });
    if (!informe) {
      res.status(404).json({ message: "Informe no encontrado" });
      return;
    }

    if (!fs.existsSync(REPORTES_DIR)) {
      fs.mkdirSync(REPORTES_DIR, { recursive: true });
    }

    const nombreArchivo = generarNombreArchivo(informe.tipoAnalisis, informe.sucursal?.nombre);
    const filePath = path.join(REPORTES_DIR, nombreArchivo);
    const buffer = Buffer.from(pdfBase64, "base64");
    fs.writeFileSync(filePath, buffer);

    console.log(`📄 PDF guardado: ${filePath} (${(buffer.length / 1024).toFixed(1)} KB)`);

    res.json({ message: "PDF guardado", data: { archivo: nombreArchivo, ruta: filePath } });
  } catch (error) {
    console.error("Error guardando PDF:", error);
    res.status(500).json({ message: "Error al guardar PDF" });
  }
};
