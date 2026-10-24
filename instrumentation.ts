// Runs once when the Next.js server starts
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { startCollectors } = await import("@/lib/collectors");
  startCollectors();
}
