import { useEffect, useRef } from "react";
import { API_BASE } from "@/lib/api-base";

const VAPID_PUBLIC_KEY =
  "BP0GfphLn7MwshBgX-xLQn7Qd0r5ZtoW0PyiBL93eyLCAJYLYC0nzuxcpcEShaSi88zlK0paSmmnK-_b59e2ZTI";

// import.meta.env.BASE_URL is "/admin-app/" in production (set by Vite base config)
// and "/" in local dev. Using it ensures sw.js is found at the correct path.
const SW_PATH = `${import.meta.env.BASE_URL}sw.js`;
const SW_SCOPE = import.meta.env.BASE_URL;

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function registerAndSubscribe(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  // Unregister any stale service workers that don't match the correct scope.
  // This cleans up old registrations from when admin-app had its own domain.
  try {
    const existing = await navigator.serviceWorker.getRegistrations();
    for (const reg of existing) {
      if (!reg.scope.endsWith(SW_SCOPE.replace(/^\//, ""))) {
        await reg.unregister();
      }
    }
  } catch { /* ignore cleanup errors */ }

  // Register the service worker at the correct scope for this app
  const reg = await navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE });
  await navigator.serviceWorker.ready;

  // Ask for notification permission
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  // Subscribe to Web Push
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  // Send subscription to server
  const subJson = sub.toJSON();
  await fetch(`${API_BASE}/api/admin/push/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      endpoint: subJson.endpoint,
      keys: subJson.keys,
    }),
  });
}

export function usePushSubscription(adminSession: boolean) {
  const attempted = useRef(false);

  useEffect(() => {
    if (!adminSession || attempted.current) return;
    attempted.current = true;

    registerAndSubscribe().catch(() => {
      // Non-critical — alarm still works when browser is open
      attempted.current = false;
    });
  }, [adminSession]);
}
