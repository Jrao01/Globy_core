import {
  GenerarInformeEquilibrio,
  GenerarInformeCanibalizacion,
  GenerarInformeExpansion,
} from './src/controllers/AnalisisControllers.js';
import type { AuthRequest } from './src/types/index.js';
import type { Response } from 'express';

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';

let passed = 0;
let failed = 0;

function mockRes(): Response {
  let statusCode = 200;
  return {
    status: (code: number) => {
      statusCode = code;
      return { json: (data: any) => { } } as any;
    },
    json: (data: any) => { },
    get statusCode() { return statusCode; },
  } as any;
}

function mockReq(overrides: any = {}): AuthRequest {
  return { body: overrides, user: { id: 1, rol: 'admin' }, params: {}, query: {}, headers: {} } as any;
}

async function runTest(name: string, handler: any, req: AuthRequest) {
  process.stdout.write(`${name}... `);
  const t0 = Date.now();
  try {
    const res = mockRes();
    await handler(req, res);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const status = (res as any).statusCode;
    if (status === 200) {
      console.log(`${GREEN}✓ ${status} (${elapsed}s)${RESET}`);
      passed++;
    } else {
      console.log(`${RED}✗ ${status} (${elapsed}s)${RESET}`);
      failed++;
    }
  } catch (e: any) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`${RED}✗ ERROR (${elapsed}s): ${e.message?.slice(0, 150)}${RESET}`);
    failed++;
  }
}

async function main() {
  console.log(`${CYAN}--- Restantes: Equilibrio, Canibalización, Expansión ---${RESET}\n`);

  await runTest('Punto de Equilibrio', GenerarInformeEquilibrio, mockReq({
    sucursalId: 25, alquiler: 2000, costosPersonal: 5000, costosServicios: 800,
    rangoInicio: '2026-01-01', rangoFin: '2026-03-31',
  }));

  await runTest('Canibalización', GenerarInformeCanibalizacion, mockReq({
    sucursalExistenteId: 25, lat: 10.1667, lng: -68.0, sucursalNuevaRevenue: 8000,
  }));

  await runTest('Expansión', GenerarInformeExpansion, mockReq({
    latitud: 10.1667, longitud: -68.0, radioKm: 5,
    rangoInicio: '2026-01-01', rangoFin: '2026-03-31',
  }));

  console.log(`\n${CYAN}--- Resultados ---${RESET}`);
  console.log(`Total: ${passed + failed}  |  ${GREEN}Pasaron: ${passed}${RESET}  |  ${RED}Fallaron: ${failed}${RESET}`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
