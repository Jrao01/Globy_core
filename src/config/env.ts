const requiredEnvVars = [
  "DATABASE_URL",
  "JWT_SECRET",
] as const;

const optionalEnvVars = [
  "APIFY_TOKEN",
  "LLM_BASE_URL",
  "LLM_MODEL",
  "CORS_ORIGIN",
] as const;

export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of requiredEnvVars) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.error(`\n❌ FALTAN VARIABLES DE ENTorno CRÍTICAS: ${missing.join(", ")}`);
    console.error("   Defina estas variables en el archivo .env antes de iniciar el servidor.\n");
    process.exit(1);
  }

  if (!process.env.APIFY_TOKEN) {
    console.warn("⚠️  APIFY_TOKEN no definido — el scraping de competidores no funcionará.");
  }

  if (process.env.JWT_SECRET === "fallback_secret") {
    console.warn("⚠️  JWT_SECRET usa el valor por defecto — cambie esto en producción.");
  }

  console.log("✅ Variables de entorno validadas.");
}
