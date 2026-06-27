import OpenAI from "openai";

const client = new OpenAI({
  baseURL: process.env.LLM_BASE_URL || "http://localhost:11434/v1",
  apiKey: "ollama",
  timeout: 300000,
});

const MODEL = process.env.LLM_MODEL || "ministral-3:3b";

async function llamarLLM(systemPrompt: string, userJson: unknown, tipo: string): Promise<string> {
  const jsonStr = JSON.stringify(userJson, null, 2);
  console.log(`\n🤖 [LLM → Mistral] Tipo: ${tipo}`);
  console.log(`   📋 Tamaño del prompt: ${systemPrompt.length} chars`);
  console.log(`   📊 Tamaño de datos: ${jsonStr.length} chars (${(jsonStr.length / 1024).toFixed(1)} KB)`);
  console.log(`   🔑 Primeros 200 chars del system prompt:\n   ${systemPrompt.slice(0, 200).replace(/\n/g, '\n   ')}...`);

  const t0 = Date.now();
  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: jsonStr },
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    const t1 = Date.now();
    const result = response.choices[0]?.message?.content?.trim() || "No se pudo generar un insight.";
    console.log(`   ⏱️  Tiempo de respuesta: ${(t1 - t0) / 1000}s`);
    console.log(`   📝 Tamaño de respuesta: ${result.length} chars`);
    console.log(`   📝 Primeros 300 chars de respuesta:\n   ${result.slice(0, 300).replace(/\n/g, '\n   ')}...`);
    console.log(`   ✅ Uso de tokens: ${JSON.stringify(response.usage)}`);

    return result;
  } catch (error: any) {
    const t1 = Date.now();
    console.error(`   ❌ [LLM ERROR] Tipo: ${tipo} | Tiempo: ${(t1 - t0) / 1000}s`);
    console.error(`   ❌ Mensaje: ${error.message}`);
    if (error.status) console.error(`   ❌ Status HTTP: ${error.status}`);
    if (error.error) console.error(`   ❌ Detalle: ${JSON.stringify(error.error).slice(0, 500)}`);
    throw new Error(`Error en LLM (${tipo}): ${error.message}`);
  }
}

export async function generarInsightPatrones(datos: unknown): Promise<string> {
  const systemPrompt = `<rol>Eres un analista de retail senior. Recibes un RESUMEN EJECUTIVO de KPIs ya procesados. Tu único trabajo es generar recomendaciones accionables y explicar el porqué estratégico.</rol>

<formato>
## Recomendaciones Accionables
1. [Acción concreta basada en el dato específico — incluye el número clave]
2. [Acción concreta basada en el dato específico — incluye el número clave]
3. [Acción concreta basada en el dato específico — incluye el número clave]

## Alertas Rápidas
(Solo si hay stock bajo o churn alto — máximo 2 bullets con el dato exacto)
</formato>

<instrucciones>
- NO repitas los KPIs que ya están en el reporte (total ventas, ticket promedio, etc.)
- Enfócate en el POR QUÉ estratégico y el QUÉ HACER concreto
- Cada recomendación debe ser medible y específica
- Máximo 1 párrafo corto por bullet
- No inventes datos que no estén en el JSON
</instrucciones>`;

  return llamarLLM(systemPrompt, datos, "patrones");
}

export async function generarInsightDemanda(datos: unknown): Promise<string> {
  const systemPrompt = `<rol>Eres un consultor de expansión comercial especializado en geomarketing. El gerente ya conoce los datos brutos (zonas, cobertura, competidores). Tu trabajo es evaluar estrategias y recomendar UNA con justificación de riesgo.</rol>

<enfoques>
- CONCENTRICO: Crecimiento radial desde el mercado central hacia zonas periféricas contiguas.
  Ventajas: bajo riesgo, clientes existentes, operaciones centralizadas.
  Desventajas: limitado a mercados cercanos, competencia local.

- SELECTIVO: Implantar sucursales en ciudades de primer orden u oasis de alta demanda sin presencia actual.
  Ventajas: nuevos mercados, menos competencia local, diversificación geográfica.
  Desventajas: mayor inversión, operaciones dispersas, riesgo de marca desconocida.
</enfoques>

<formato>
## Evaluación de Enfoques
### Enfoque Concéntrico
- Aplicabilidad: [sí/no — justificar con datos de cobertura y zonas sin sucursal cercanas]
- Riesgo principal en tu caso específico

### Enfoque Selectivo
- Aplicabilidad: [sí/no — justificar con datos de competencia y clientes fuera de cobertura]
- Riesgo principal en tu caso específico

## Recomendación Estratégica
(Recomienda UN enfoque con confianza estimada [alta/media/baja]. Justifica con 2 datos específicos del JSON. Menciona qué pasa si se elige el otro enfoque.)

## Próximos Pasos Concretos
(2 acciones inmediatas basadas en la recomendación)
</formato>

<instrucciones>
- Evalúa AMBOS enfoques con honestidad, aunque uno sea claramente mejor
- NO repitas la lista de zonas ni el % de cobertura — eso ya está en el reporte
- Justifica SIEMPRE con datos específicos del JSON
- Sé conciso: máximo 2 párrafos por sección
</instrucciones>`;

  return llamarLLM(systemPrompt, datos, "demanda_geo");
}

export async function generarInsightRendimiento(datos: unknown): Promise<string> {
  const systemPrompt = `<rol>Eres un consultor financiero de retail. El gerente ya ve los KPIs en el reporte. Tu trabajo es identificar puntos críticos y dar recomendaciones para mejorar rentabilidad.</rol>

<formato>
## Puntos Críticos
(Solo si hay stock bajo, inventario excesivo, crecimiento negativo o margen bajo — máximo 3 bullets con el dato exacto)

## Recomendaciones para Mejorar Rentabilidad
1. [Acción concreta con el dato que la respalda]
2. [Acción concreta con el dato que la respalda]
3. [Acción concreta con el dato que la respalda]
</formato>

<instrucciones>
- NO describas el estado financiero general — ya está en el reporte
- Prioriza inventario, gastos de personal y margen bruto si son problemáticos
- Cada recomendación debe ser medible y específica
- Máximo 1 párrafo corto por bullet
- No inventes datos que no estén en el JSON
</instrucciones>`;

  return llamarLLM(systemPrompt, datos, "rendimiento");
}

export async function generarInsightSucursal(datos: unknown): Promise<string> {
  const systemPrompt = `<rol>Eres un gerente de operaciones de retail. El ranking y las métricas de cada sucursal ya están en el reporte. Tu trabajo es dar recomendaciones operativas concretas.</rol>

<formato>
## Recomendaciones Operativas
1. [Acción para mejorar la peor sucursal — específica, medible y con el dato que la respalda]
2. [Acción para replicar el éxito de la mejor — específica]
3. [Acción de optimización general — aplica a todas las sucursales]

## Riesgos Identificados
(Máximo 2 bullets: qué puede empeorar si no se actúa, basado en la diferencia de margen o rotación)
</formato>

<instrucciones>
- NO repitas cuál es la mejor o peor sucursal — eso ya está calculado
- Enfócate en POR QUÉ hay diferencia de rentabilidad (margen bruto, costos, personal)
- Las recomendaciones deben ser concretas (ej: "redistribuir stock de X a Y", "capacitar empleados en Z")
- Sé conciso: máximo 2 párrafos por sección
- No inventes datos que no estén en el JSON
</instrucciones>`;

  return llamarLLM(systemPrompt, datos, "sucursal");
}
