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
} from "../services/llmService.js";
import { haversineDistanceKm } from "../utils/geo.js";

/* ─────────────── helpers ─────────────── */

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function diasEntre(a: Date, b: Date) {
  return Math.max(1, Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

function factorPeriodo(inicio: Date, fin: Date) {
  return diasEntre(inicio, fin) / 30;
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

    const [compras, comprasConDetalles, clientes, inventarios] = await Promise.all([
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
      prisma.inventario.findMany({
        where: sucursalId ? { sucursalId } : {},
        include: { producto: { select: { nombre: true, costo: true } }, sucursal: { select: { nombre: true } } },
      }),
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
      if (diasDesdeUltCompra <= 30 && v.count >= 6 && v.total >= 500) segmento = "vip";
      else if (diasDesdeUltCompra <= 60 && v.count >= 3 && v.total >= 200) segmento = "leal";
      else if (diasDesdeUltCompra <= 90) segmento = "riesgo";
      return { nombre: `${c?.nombre || "Cliente"} ${c?.apellido || id}`, compras: v.count, totalGastado: v.total, ultimaCompra: v.last.toISOString().slice(0, 10), segmento };
    });

    const segmentos = {
      vip: rfmClientes.filter((c) => c.segmento === "vip"),
      leales: rfmClientes.filter((c) => c.segmento === "leal"),
      riesgo: rfmClientes.filter((c) => c.segmento === "riesgo"),
      inactivos: rfmClientes.filter((c) => c.segmento === "inactivo"),
    };

    // --- Market Basket ---
    const basketMap: Record<string, number> = {};
    comprasConDetalles.forEach((c) => {
      const nombres = c.detalles.map((d) => d.producto?.nombre || `Prod#${d.productoId}`).sort();
      for (let i = 0; i < nombres.length; i++) {
        for (let j = i + 1; j < nombres.length; j++) {
          const key = `${nombres[i]}|||${nombres[j]}`;
          basketMap[key] = (basketMap[key] || 0) + 1;
        }
      }
    });
    const marketBasket = Object.entries(basketMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k, v]) => { const [a, b] = k.split("|||"); return { productoA: a, productoB: b, coocurrencia: v }; });

    // --- Churn ---
    const clientesSinCompra90d = clientes.filter((c) => {
      const last = compras.filter((p) => p.clienteId === c.id).sort((a, b) => b.fecha.getTime() - a.fecha.getTime())[0];
      if (!last) return true;
      return Date.now() - last.fecha.getTime() > 90 * 24 * 60 * 60 * 1000;
    }).length;

    // --- CLV ---
    const clvValores = Object.values(clientesCompras).map((v) => v.total);
    const clvPromedio = clvValores.length > 0 ? clvValores.reduce((a, b) => a + b, 0) / clvValores.length : 0;

    // --- Forecasting simple (media movil) ---
    const ultimos3 = ventasPorMes.slice(-3);
    const ventasEstimadas = ultimos3.length > 0 ? ultimos3.reduce((a, b) => a + b.promedio, 0) / ultimos3.length : 0;
    const penultimo = ventasPorMes[ventasPorMes.length - 2];
    const ultimo = ventasPorMes[ventasPorMes.length - 1];
    const tendencia = penultimo && ultimo && penultimo.promedio > 0 ? ((ultimo.promedio - penultimo.promedio) / penultimo.promedio) * 100 : 0;

    // --- Alertas ---
    const alertas: any[] = [];
    inventarios.filter((i) => i.stockActual <= i.stockMinimo).forEach((i) => {
      alertas.push({ tipo: "stock_bajo", producto: i.producto.nombre, stock: i.stockActual, minimo: i.stockMinimo, sucursal: i.sucursal.nombre });
    });
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
          vip: { cantidad: segmentos.vip.length, ticketPromedio: segmentos.vip.length > 0 ? round2(segmentos.vip.reduce((a, b) => a + b.totalGastado, 0) / segmentos.vip.length) : 0 },
          leales: { cantidad: segmentos.leales.length, ticketPromedio: segmentos.leales.length > 0 ? round2(segmentos.leales.reduce((a, b) => a + b.totalGastado, 0) / segmentos.leales.length) : 0 },
          riesgo: { cantidad: segmentos.riesgo.length, ticketPromedio: segmentos.riesgo.length > 0 ? round2(segmentos.riesgo.reduce((a, b) => a + b.totalGastado, 0) / segmentos.riesgo.length) : 0 },
          inactivos: { cantidad: segmentos.inactivos.length, ticketPromedio: segmentos.inactivos.length > 0 ? round2(segmentos.inactivos.reduce((a, b) => a + b.totalGastado, 0) / segmentos.inactivos.length) : 0 },
        },
        topClientes: [...rfmClientes].sort((a, b) => b.totalGastado - a.totalGastado).slice(0, 10),
      },
      marketBasket,
      churn: { tasaRetencion: clientes.length > 0 ? round2((1 - clientesSinCompra90d / clientes.length) * 100) : 100, tasaChurn: clientes.length > 0 ? round2((clientesSinCompra90d / clientes.length) * 100) : 0, clientesSinCompra90d },
      clv: { clvPromedio: round2(clvPromedio) },
      forecasting: { ventasEstimadasProximoMes: round2(ventasEstimadas), tendenciaPct: round2(tendencia) },
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
        vip: dataJsonCompleto.rfm.segmentos.vip.cantidad,
        leales: dataJsonCompleto.rfm.segmentos.leales.cantidad,
        riesgo: dataJsonCompleto.rfm.segmentos.riesgo.cantidad,
        inactivos: dataJsonCompleto.rfm.segmentos.inactivos.cantidad,
      },
      forecasting: dataJsonCompleto.forecasting,
      alertasCount: { stockBajo: alertas.filter((a) => a.tipo === "stock_bajo").length, churn: alertas.filter((a) => a.tipo === "churn").length },
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
      prisma.compra.findMany({ where: whereActual, select: { total: true, fecha: true } }),
      prisma.compra.findMany({ where: whereAnterior, select: { total: true } }),
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
      include: { detalles: { include: { producto: { select: { costo: true } } } } },
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
      return sum + c.detalles.reduce((s, d) => s + (d.producto.costo || 0) * d.cantidad, 0);
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
      },
      ventasPorMes: Object.entries(ventasPorMes).map(([mes, total]) => ({ mes, total: round2(total) })),
      inventario: {
        valorTotalEstimado: round2(valorInventarioTotal),
        stockBajo: stockBajo.map((i) => ({ producto: i.producto.nombre, stock: i.stockActual, minimo: i.stockMinimo, costoUnitario: i.producto.costo })),
        stockExceso: stockExceso.slice(0, 5).map((i) => ({ producto: i.producto.nombre, stock: i.stockActual, minimo: i.stockMinimo, costoUnitario: i.producto.costo })),
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

    const whereSucursal = sucursalId ? { id: sucursalId, status: true } : { status: true };

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

    // --- Compras con detalle del periodo actual para costo ---
    const comprasDetalleActual = await prisma.compra.findMany({
      where: { fecha: { gte: inicio, lte: fin }, status: { not: "cancelado" }, ...(sucursalId ? { sucursalId } : {}) },
      include: { detalles: { include: { producto: { select: { costo: true } } } } },
    });

    const costoPorSucursal: Record<number, number> = {};
    comprasDetalleActual.forEach((c) => {
      const costo = c.detalles.reduce((s, d) => s + (d.producto.costo || 0) * d.cantidad, 0);
      costoPorSucursal[c.sucursalId] = (costoPorSucursal[c.sucursalId] || 0) + costo;
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
        const rotacion = stockTotal > 0 ? totalCompras / stockTotal : 0;

        const gastoPersonalMensual = s.personal.reduce((sum, p) => sum + (p.sueldoMensual ?? p.tipoPersonal?.pagaMensual ?? 0), 0);
        const gastoPersonalPeriodo = round2(gastoPersonalMensual * fPeriodo);
        const costoProd = costoPorSucursal[s.id] || 0;
        const gananciaNeta = round2(revenue - costoProd - gastoPersonalPeriodo);
        const margenBrutoPct = revenue > 0 ? round2(((revenue - costoProd) / revenue) * 100) : 0;

        if (!acc[key]) {
          acc[key] = {
            nombre: s.nombre,
            ciudad: s.ciudad,
            revenue: 0,
            totalCompras: 0,
            ticketPromedio: 0,
            empleados: 0,
            stockBajo: 0,
            stockTotal: 0,
            rotacion: 0,
            crecimientoVsAnteriorPct: crecimiento,
            costoProductosVendidos: 0,
            gastoPersonalPeriodo: 0,
            gananciaNeta: 0,
            margenBrutoPct: 0,
          };
        }
        acc[key].revenue += revenue;
        acc[key].totalCompras += totalCompras;
        acc[key].empleados += s.personal.length;
        acc[key].stockBajo += stockBajo;
        acc[key].stockTotal += stockTotal;
        acc[key].costoProductosVendidos += costoProd;
        acc[key].gastoPersonalPeriodo += gastoPersonalPeriodo;
        acc[key].gananciaNeta += gananciaNeta;
        return acc;
      }, {} as Record<string, any>)
    ).map((s: any) => ({
      ...s,
      revenue: round2(s.revenue),
      ticketPromedio: s.totalCompras > 0 ? round2(s.revenue / s.totalCompras) : 0,
      rotacion: s.stockTotal > 0 ? round2(s.totalCompras / s.stockTotal) : 0,
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
        sucursalId: sucursalId || null,
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
