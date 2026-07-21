import OpenAI from "openai";

const client = new OpenAI({
  baseURL: process.env.LLM_BASE_URL || "http://localhost:11434/v1",
  apiKey: "ollama",
  timeout: 300000,
});

const MODEL = process.env.LLM_MODEL || "ministral-3:3b";

async function llamarLLM(systemPrompt: string, userData: unknown, tipo: string): Promise<string> {
  const dataStr = typeof userData === "string" ? userData : JSON.stringify(userData, null, 2);
  console.log(`\n🤖 [LLM → Mistral] Tipo: ${tipo}`);
  console.log(`   📋 Prompt: ${systemPrompt.length} chars`);
  console.log(`   📊 Datos: ${dataStr.length} chars (${(dataStr.length / 1024).toFixed(1)} KB)`);

  const t0 = Date.now();
  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: dataStr },
      ],
      max_tokens: 1500,
      temperature: 0.2,
    });

    const t1 = Date.now();
    const result = response.choices[0]?.message?.content?.trim() || "No se pudo generar el insight.";
    console.log(`   ⏱️  ${(t1 - t0) / 1000}s | ${result.length} chars`);
    console.log(`   📝 ${result.slice(0, 200)}...`);
    console.log(`   ✅ Tokens: ${JSON.stringify(response.usage)}`);

    return result;
  } catch (error: any) {
    const t1 = Date.now();
    console.error(`   ❌ [LLM ERROR] ${tipo} | ${(t1 - t0) / 1000}s | ${error.message}`);
    throw new Error(`Error en LLM (${tipo}): ${error.message}`);
  }
}

/* ═══════════════════════════ PATRONES ═══════════════════════════ */

export async function generarInsightPatrones(datos: unknown): Promise<string> {
  const prompt = `Eres un analista senior de retail. Analiza los datos de ventas que te voy a dar y escribe un analisis narrativo en 3-4 parrafos en español.

Inclui en tu analisis:
- Resumen general del periodo (tendencias, crecimiento, caidas)
- Pronostico para el proximo mes con numeros concretos
- Segmentacion de clientes (RFM): cuales son leales, cuales estan en riesgo
- Recomendaciones accionables basadas en los datos
- Alertas sobre churn, stock bajo o margenes

No uses formato JSON ni tablas. Solo parrafos narrativos. Se conciso pero completo.`;

  return llamarLLM(prompt, datos, "patrones");
}

/* ═══════════════════════════ DEMANDA GEO ═══════════════════════════ */

export async function generarInsightDemanda(datos: unknown): Promise<string> {
  const prompt = `Eres un consultor de geomarketing. Analiza los datos geograficos que te voy a dar y escribe un analisis narrativo en 3-4 parrafos en español.

Inclui en tu analisis:
- Cobertura actual de sucursales y zonas con demanda no cubierta
- Evaluacion de enfoque concentrico vs selectivo (cual aplicar y por que)
- Competencia detectada por zona
- Recomendacion estrategica concreta
- Proximos pasos priorizados

No uses formato JSON ni tablas. Solo parrafos narrativos. Se conciso pero completo.`;

  return llamarLLM(prompt, datos, "demanda_geo");
}

/* ═══════════════════════════ RENDIMIENTO ═══════════════════════════ */

export async function generarInsightRendimiento(datos: unknown): Promise<string> {
  const prompt = `Eres un consultor financiero de retail. Analiza los datos de rendimiento que te voy a dar y escribe un analisis narrativo en 3-4 parrafos en español.

Inclui en tu analisis:
- Comparativa entre la mejor y peor sucursal (por que una rinde mas)
- Brecha de margen y posibles causas
- Estado del inventario (stock bajo, stock en exceso)
- Recomendaciones concretas para cada sucursal (mejor, peor, general)
- Puntos criticos que requieren atencion inmediata

No uses formato JSON ni tablas. Solo parrafos narrativos. Se conciso pero completo.`;

  return llamarLLM(prompt, datos, "rendimiento");
}

/* ═══════════════════════════ SUCURSAL (COMPARATIVO) ═══════════════════════════ */

export async function generarInsightSucursal(datos: unknown): Promise<string> {
  const prompt = `Eres un gerente de operaciones de retail. Analiza los datos comparativos de sucursales que te voy a dar y escribe un analisis narrativo en 3-4 parrafos en español.

Inclui en tu analisis:
- Comparativa entre sucursales (quien lidera, quien necesita atencion)
- Recomendaciones operativas concretas por sucursal con datos que las respalden
- Riesgos identificados y sus consecuencias si no se mitigan

No uses formato JSON ni tablas. Solo parrafos narrativos. Se conciso pero completo.`;

  return llamarLLM(prompt, datos, "sucursal");
}

/* ═══════════════════════════ SUCURSAL INDIVIDUAL ═══════════════════════════ */

export async function generarInsightSucursalIndividual(datos: unknown): Promise<string> {
  const prompt = `Eres un auditor de rendimiento de sucursal. Analiza los datos de UNA sucursal que te voy a dar y escribe un analisis narrativo en 3-4 parrafos en español.

Inclui en tu analisis:
- Diagnostico de la variable mas importante (revenue, margen o ticket) y su cambio vs periodo anterior
- Causas del cambio identificadas en los datos
- Alertas criticas (stock bajo, churn, margen negativo)
- Acciones inmediatas con plazo concreto

No uses formato JSON ni tablas. Solo parrafos narrativos. Se conciso pero completo.`;

  return llamarLLM(prompt, datos, "sucursal_individual");
}

/* ═══════════════════════════ EQUILIBRIO ═══════════════════════════ */

export async function generarInsightEquilibrio(datos: unknown): Promise<string> {
  const prompt = `Eres un analista financiero de retail. Analiza los datos de punto de equilibrio que te voy a dar y escribe un analisis narrativo en 3-4 parrafos en español.

Inclui en tu analisis:
- Evaluacion de viabilidad (saludable, ajustada o de alto riesgo)
- Brecha de seguridad entre el forecast y el punto de equilibrio
- Riesgos operativos principales y sus factores
- Recomendacion concreta (reducir costos, aumentar margen o crecer ingresos)

No uses formato JSON ni tablas. Solo parrafos narrativos. Se conciso pero completo.`;

  return llamarLLM(prompt, datos, "equilibrio");
}

/* ═══════════════════════════ CANIBALIZACION ═══════════════════════════ */

export async function generarInsightCanibalizacion(datos: unknown): Promise<string> {
  const prompt = `Eres un estratega de expansion de retail. Analiza los datos de canibalizacion (modelo de Huff) que te voy a dar y escribe un analisis narrativo en 3-4 parrafos en español.

Inclui en tu analisis:
- Nivel de canibalizacion (baja, moderada o alta) y su significado
- Si es defensiva (conviene abrir) o danina (conviene reconsiderar)
- Impacto estimado en la sucursal existente
- Recomendacion final: ABRIR, EVALUAR o RECONSIDERAR, con justificacion

No uses formato JSON ni tablas. Solo parrafos narrativos. Se conciso pero completo.`;

  return llamarLLM(prompt, datos, "canibalizacion");
}

/* ═══════════════════════════ EXPANSION ═══════════════════════════ */

export async function generarInsightExpansion(datos: unknown): Promise<string> {
  const prompt = `Eres un consultor de viabilidad de expansion de retail. Analiza los datos de una ubicacion propuesta que te voy a dar y escribe un analisis narrativo en 3-4 parrafos en español.

Inclui en tu analisis:
- Evaluacion de la demanda en la zona (clientes potenciales, ticket esperado)
- Cobertura y accesibilidad (radio, tiempo de llegada)
- Co-tenencia (negocios complementarios cercanos)
- Saturacion del mercado (IRS)
- Puntuacion de viabilidad general (0-100)
- Recomendacion final: ABRIR, NO ABRIR o EVALUAR, con justificacion clara
- Riesgos principales y probabilidad
- Proximos pasos concretos

No uses formato JSON ni tablas. Solo parrafos narrativos. Se conciso pero completo.`;

  return llamarLLM(prompt, datos, "expansion");
}
