type LogLevel = "info" | "warn" | "error";

export function logSync(level: LogLevel, event: string, data?: Record<string, unknown>) {
  const payload = {
    scope: "iddas-sync",
    event,
    ...(data ?? {}),
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
    return;
  }

  if (level === "warn") {
    console.warn(JSON.stringify(payload));
    return;
  }

  console.info(JSON.stringify(payload));
}
