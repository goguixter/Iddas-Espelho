import { spawn } from "node:child_process";
import process from "node:process";

const HOST = "127.0.0.1";
const PORT = Number(process.env.AUTH_TEST_PORT ?? "3101");
const BASE_URL = `http://${HOST}:${PORT}`;
const TEST_AUTH_SECRET =
  process.env.AUTH_SECRET ?? "auth-smoke-test-secret-with-at-least-32-characters";
const TEST_AUTH_USERNAME = process.env.AUTH_USERNAME ?? "admin";
const TEST_AUTH_PASSWORD = process.env.AUTH_PASSWORD ?? "admin12345";

async function main() {
  await runCommand("npm", ["run", "build"], {
    env: buildEnv(),
    label: "build",
  });

  const server = spawn(
    "npm",
    ["run", "start", "--", "--hostname", HOST, "--port", String(PORT)],
    {
      cwd: process.cwd(),
      env: buildEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  server.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
  });
  server.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  try {
    await waitForServer();
    await assertUnauthenticatedPagesRedirect();
    await assertUnauthenticatedApisFail();
    await assertPublicRoutesStayPublic();
    await assertLoginFlowWorks();
    process.stdout.write("\nSmoke test de autenticação passou.\n");
  } finally {
    await stopServer(server);
  }
}

function buildEnv() {
  return {
    ...process.env,
    AUTH_SECRET: TEST_AUTH_SECRET,
    AUTH_USERNAME: TEST_AUTH_USERNAME,
    AUTH_PASSWORD: TEST_AUTH_PASSWORD,
  };
}

function runCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${options.label} failed with exit code ${code ?? "unknown"}`));
    });
    child.on("error", reject);
  });
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/login`, { redirect: "manual" });
      if (response.status === 200) {
        return;
      }
    } catch {}

    await sleep(500);
  }

  throw new Error("Timed out waiting for Next.js server to start.");
}

async function assertUnauthenticatedPagesRedirect() {
  const protectedPages = ["/", "/documentos", "/orcamentos/123", "/pessoas/123", "/vendas/123"];

  for (const path of protectedPages) {
    const response = await fetch(`${BASE_URL}${path}`, { redirect: "manual" });
    assert(
      response.status >= 300 && response.status < 400,
      `Expected redirect for ${path}, got ${response.status}`,
    );

    const location = response.headers.get("location") ?? "";
    assert(
      location.startsWith(`/login?next=${encodeURIComponent(path)}`) || location === "/login",
      `Expected login redirect for ${path}, got ${location}`,
    );
  }
}

async function assertUnauthenticatedApisFail() {
  const protectedApis = ["/api/sync", "/api/pessoas", "/api/orcamentos", "/api/documentos"];

  for (const path of protectedApis) {
    const response = await fetch(`${BASE_URL}${path}`, { redirect: "manual" });
    assert(response.status === 401, `Expected 401 for ${path}, got ${response.status}`);
  }
}

async function assertPublicRoutesStayPublic() {
  const loginPage = await fetch(`${BASE_URL}/login`, { redirect: "manual" });
  assert(loginPage.status === 200, `Expected 200 for /login, got ${loginPage.status}`);

  const clicksignWebhook = await fetch(`${BASE_URL}/api/clicksign/webhook`, {
    method: "GET",
    redirect: "manual",
  });
  assert(
    clicksignWebhook.status === 405,
    `Expected 405 for public Clicksign webhook without auth, got ${clicksignWebhook.status}`,
  );

  const iddasWebhook = await fetch(`${BASE_URL}/api/iddas/webhook`, {
    method: "GET",
    redirect: "manual",
  });
  assert(
    iddasWebhook.status === 405,
    `Expected 405 for public IDDAS webhook without auth, got ${iddasWebhook.status}`,
  );
}

async function assertLoginFlowWorks() {
  const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username: TEST_AUTH_USERNAME,
      password: TEST_AUTH_PASSWORD,
    }),
    redirect: "manual",
  });

  assert(loginResponse.status === 200, `Expected 200 from login API, got ${loginResponse.status}`);
  const setCookie = loginResponse.headers.get("set-cookie") ?? "";
  assert(setCookie.includes("iddas_session="), "Expected session cookie to be set on login.");

  const pageResponse = await fetch(`${BASE_URL}/`, {
    headers: {
      cookie: extractCookie(setCookie),
    },
    redirect: "manual",
  });
  assert(pageResponse.status === 200, `Expected authenticated dashboard access, got ${pageResponse.status}`);

  const loginPageResponse = await fetch(`${BASE_URL}/login`, {
    headers: {
      cookie: extractCookie(setCookie),
    },
    redirect: "manual",
  });
  assert(
    loginPageResponse.status >= 300 && loginPageResponse.status < 400,
    `Expected authenticated /login redirect, got ${loginPageResponse.status}`,
  );
  assert(
    loginPageResponse.headers.get("location") === "/",
    `Expected authenticated /login redirect to /, got ${loginPageResponse.headers.get("location")}`,
  );
}

function extractCookie(setCookieHeader) {
  return setCookieHeader.split(";")[0] ?? "";
}

async function stopServer(server) {
  if (server.killed || server.exitCode !== null) {
    return;
  }

  server.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      server.kill("SIGKILL");
      resolve();
    }, 5_000);

    server.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

await main();
