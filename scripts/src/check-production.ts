import { performance } from "node:perf_hooks";

type CheckResult = {
  label: string;
  status: number;
  milliseconds: number;
};

const USER_URL = (process.env.VIXUS_USER_URL ?? "https://vixus.trade").replace(/\/+$/, "");
const ADMIN_URL = (process.env.VIXUS_ADMIN_URL ?? "https://cryptohuckerbots-admin-app-three.vercel.app").replace(/\/+$/, "");
const API_URL = (process.env.VIXUS_API_URL ?? "https://api.vixus.trade").replace(/\/+$/, "");
const MAX_PAGE_MS = Number(process.env.VIXUS_MAX_PAGE_MS ?? 3000);
const MAX_API_MS = Number(process.env.VIXUS_MAX_API_MS ?? 3000);
const MAX_READY_MS = Number(process.env.VIXUS_MAX_READY_MS ?? 15000);

const results: CheckResult[] = [];

function fail(message: string): never {
  throw new Error(message);
}

async function request(label: string, url: string, init?: RequestInit): Promise<{ response: Response; body: string }> {
  const started = performance.now();
  const response = await fetch(url, {
    redirect: "follow",
    ...init,
  });
  const body = await response.text();
  const milliseconds = Math.round(performance.now() - started);
  results.push({ label, status: response.status, milliseconds });
  return { response, body };
}

async function expectStatus(
  label: string,
  url: string,
  status: number,
  maxMilliseconds: number,
  init?: RequestInit,
): Promise<{ response: Response; body: string }> {
  const result = await request(label, url, init);
  if (result.response.status !== status) {
    fail(`${label}: expected HTTP ${status}, got ${result.response.status}: ${result.body.slice(0, 240)}`);
  }
  const timing = results.at(-1)!;
  if (timing.milliseconds > maxMilliseconds) {
    fail(`${label}: took ${timing.milliseconds}ms, limit is ${maxMilliseconds}ms`);
  }
  return result;
}

async function checkFrontend(label: string, baseUrl: string, routes: string[]): Promise<void> {
  const routePages: Array<{ path: string; body: string }> = [];
  for (const route of routes) {
    const result = await expectStatus(`${label}${route}`, `${baseUrl}${route}`, 200, MAX_PAGE_MS);
    const contentType = result.response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      fail(`${label}${route}: expected HTML, got ${contentType || "unknown content type"}`);
    }
    if (!result.body.includes('id="root"')) {
      fail(`${label}${route}: HTML shell is missing the application root`);
    }
    routePages.push({ path: route, body: result.body });
  }

  const assetRefs = new Set<string>();
  for (const page of routePages) {
    for (const match of page.body.matchAll(/(?:src|href)="([^"]+)"/g)) {
      if (match[1].startsWith("/assets/") || match[1].startsWith("/manifest")) {
        assetRefs.add(match[1]);
      }
    }
  }

  const initialAssets = [...assetRefs];
  for (const asset of initialAssets) {
    const result = await expectStatus(`${label}${asset}`, new URL(asset, `${baseUrl}/`).toString(), 200, MAX_PAGE_MS);
    const contentType = result.response.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      fail(`${label}${asset}: returned HTML instead of a static asset`);
    }
    if (asset.endsWith(".js")) {
      for (const match of result.body.matchAll(/(?:["'`])((?:\/)?assets\/[^"'` ]+\.(?:js|css))(?:["'`])/g)) {
        assetRefs.add(match[1].startsWith("/") ? match[1] : `/${match[1]}`);
      }
    }
  }

  // Check dynamically imported route assets referenced by the initial shell,
  // including the login and authenticated page bundles.
  for (const asset of [...assetRefs].filter((ref) => !initialAssets.includes(ref))) {
    await expectStatus(`${label}${asset}`, new URL(asset, `${baseUrl}/`).toString(), 200, MAX_PAGE_MS);
  }
}

async function main(): Promise<void> {
  await checkFrontend("user ", USER_URL, ["/", "/login", "/register", "/markets", "/trade/BTC-USD", "/news"]);
  await checkFrontend("admin ", ADMIN_URL, ["/", "/login"]);

  const health = await expectStatus("api health", `${API_URL}/api/healthz`, 200, MAX_API_MS);
  if (!health.body.includes('"status":"ok"')) fail("api health: unexpected response body");

  const ready = await expectStatus("api readiness", `${API_URL}/api/readyz`, 200, MAX_READY_MS);
  if (!ready.body.includes('"status":"ready"')) fail("api readiness: unexpected response body");

  const paymentMethods = await expectStatus("cashier payment methods", `${API_URL}/api/cashier/payment-methods`, 200, MAX_API_MS);
  let methods: unknown;
  try {
    methods = JSON.parse(paymentMethods.body);
  } catch {
    fail("cashier payment methods: response was not valid JSON");
  }
  if (!Array.isArray(methods) || methods.length !== 1) {
    fail("cashier payment methods: expected exactly one supported method");
  }
  const [method] = methods as Array<Record<string, unknown>>;
  if (
    method.id !== "usdt_bep20" ||
    method.name !== "USDT (BEP-20)" ||
    method.network !== "BEP-20" ||
    method.depositAddress !== "0x50Ef0c6963Bf42Fd7f9E0Ba7003e036d2E994C6B"
  ) {
    fail("cashier payment methods: canonical BSC/BEP-20 method was not returned");
  }

  for (const route of ["/api/auth/me", "/api/dashboard/summary", "/api/trade/vip-packages"]) {
    await expectStatus(`protected ${route}`, `${API_URL}${route}`, 401, MAX_API_MS);
  }

  const cors = await expectStatus("login CORS preflight", `${API_URL}/api/auth/login`, 204, MAX_API_MS, {
    method: "OPTIONS",
    headers: {
      Origin: USER_URL,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  if (cors.response.headers.get("access-control-allow-origin") !== USER_URL) {
    fail("login CORS preflight: user origin was not allowed");
  }

  const invalidLogin = await expectStatus("login latency probe", `${API_URL}/api/auth/login`, 401, MAX_API_MS, {
    method: "POST",
    headers: {
      Origin: USER_URL,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: `release-probe-${Date.now()}@example.invalid`,
      password: "not-a-real-password",
    }),
  });
  if (!invalidLogin.body.includes("Invalid email or password")) {
    fail("login latency probe: unexpected authentication response");
  }

  for (const result of results) {
    console.log(`${result.label}: HTTP ${result.status} in ${result.milliseconds}ms`);
  }
  console.log(`Production smoke check passed for ${USER_URL}, ${ADMIN_URL}, and ${API_URL}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});