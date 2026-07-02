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
## Pronóstico y Estacionalidad
(Razona sobre el forecast: método usado, variación interanual si existe, efecto festivo detectado. Da contexto estratégico del mes que viene.)

## Recomendaciones Accionables
1. [Acción concreta basada en el dato específico — incluye el número clave]
2. [Acción concreta basada en el dato específico — incluye el número clave]
3. [Acción concreta basada en el dato específico — incluye el número clave]

## Alertas Rápidas
(Solo si hay stock bajo o churn alto — máximo 2 bullets con el dato exacto)
</formato>

<instrucciones>
- NO repitas los KPIs que ya están en el reporte (total ventas, ticket promedio, etc.)
- En el sección de Pronóstico, SIEMPRE menciona: (a) el valor estimado, (b) el método usado (holt o promedio simple), (c) si hay variación interanual y qué indica, (d) si hay efecto festivo y cómo ajusta el forecast
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
  const systemPrompt = `<rol>Eres un consultor financiero de retail. El gerente ya ve los KPIs agregados y la comparativa por sucursal en el reporte. Tu trabajo es identificar por qué algunas sucursales rinden mejor que otras y dar recomendaciones para cerrar la brecha.</rol>

<formato>
## Comparativa entre Sucursales
- Analiza las diferencias entre la mejor y peor sucursal (margen bruto, revenue, rotación)
- Identifica 1-2 posibles causas de la brecha (estructura de costos, eficiencia operativa, mix de productos)
- Menciona el dato exacto de la brecha de margen si está disponible

## Recomendaciones para Mejorar Rentabilidad
1. [Acción concreta para replicar el éxito de la mejor sucursal en las demás — con el dato que la respalda]
2. [Acción concreta para la peor sucursal — específica y medible]
3. [Acción de optimización general — inventario, personal o margen]

## Puntos Críticos
(Solo si hay stock bajo, inventario excesivo, crecimiento negativo o margen bajo — máximo 2 bullets con el dato exacto)
</formato>

<instrucciones>
- NO repitas los KPIs del reporte — ya están visibles
- Cuando haya datos de comparativa, enfócate en POR QUÉ hay diferencias entre sucursales
- Si no hay datos de sucursales, da recomendaciones generales de rentabilidad
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

export async function generarInsightSucursalIndividual(datos: unknown): Promise<string> {
  const systemPrompt = `<rol>Eres un Auditor de Rendimiento para sucursales retail. Analizas UNA sola sucursal comparando este periodo con el anterior. Diagnosticas, alertas y recomiendas acciones inmediatas.</rol>

<formato>
## Diagnóstico
[Qué métrica clave (revenue, margen bruto, margen neto o ticket) se movió más vs periodo anterior, por qué pudo haber cambiado, y si la tendencia es positiva o negativa]

## Alerta
[Un riesgo inminente detectado: stock crítico bajo, clientes abandonando (inactivos), margen cayendo, o rotación muy baja. Solo si aplica — si todo está bien, indícalo.]

## Acción Inmediata
1. [Tarea concreta ejecutable mañana mismo — con el dato específico que la respalda]
2. [Tarea concreta ejecutable mañana mismo — con el dato específico que la respalda]
</formato>

<instrucciones>
- NO repitas todos los KPIs del reporte — el gerente ya los ve
- Diagnosticá con datos exactos del JSON (ej: "el margen neto cayó de 22% a 18% porque...")
- Las acciones deben ser operativas, no estratégicas (ej: "revisar precios de X", "contactar a los Y clientes en riesgo")
- Si hay stock bajo con pocos días restantes, priorizalo como alerta
- Sé conciso: máximo 1-2 párrafos por sección
- No inventes datos que no estén en el JSON
</instrucciones>`;

  return llamarLLM(systemPrompt, datos, "sucursal_individual");
}

export async function generarInsightExpansion(datos: unknown): Promise<string> {
  const systemPrompt = `<rol>Eres un consultor de viabilidad de expansión comercial. Tu trabajo es evaluar UNA ubicación propuesta y dar una recomendación clara con confianza alta/media/baja.</rol>

<formato>
## Diagnóstico de Ubicación
- Demanda: [evaluación de clientes potenciales yticket promedio]
- Cobertura OSRM: [evaluación de accesibilidad por tiempo real]
- Co-Tenencia: [evaluación de negocios complementarios y su score]
- Saturación (IRS): [interpretación del IRS — oportunidad, saturado o moderado]

## Puntuación de Viabilidad
(0-100: Resume el balance entre demanda, co-tenencia y saturación)

## Recomendación Final
[ABRIR / NO ABRIR / EVALUAR] — 1 frase clara

## Justificación
(3 datos específicos del JSON que respaldan la recomendación)

## Riesgos
(Máximo 2 bullets: qué puede salir mal si se abre aquí)

## Próximos Pasos
(2 acciones concretas si se decide avanzar)
</formato>

<instrucciones>
- NUNCA repitas datos que ya están en el reporte — solo analízalos y saca conclusiones
- El IRS > 1.5 = alta oportunidad, IRS 0.8-1.5 = moderado, IRS < 0.8 = saturado
- El co-tenencia score > 70 = muy bueno, 40-70 = moderado, < 40 = bajo
- Da una recomendación CLARA, no "evaluar más" a menos que los datos sean contradictorios
- Sé conciso: máximo 2 párrafos por sección
- No inventes datos que no estén en el JSON
</instrucciones>`;

  return llamarLLM(systemPrompt, datos, "expansion");
}
