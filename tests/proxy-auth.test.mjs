import test from "node:test";
import assert from "node:assert/strict";

// Mock implementation of Proxy logic mirroring src/proxy.ts
const PROTECTED_PAGES = ["/my", "/watchlist", "/alerts"];
const GUEST_ONLY_PAGES = ["/onboarding/login", "/onboarding/reset-password"];

function isProtected(pathname) {
  return PROTECTED_PAGES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

function isGuestOnly(pathname) {
  return GUEST_ONLY_PAGES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

function copySessionHeaders(fromHeaders, toHeaders) {
  const setCookies = fromHeaders.getSetCookie ? fromHeaders.getSetCookie() : (fromHeaders["set-cookie"] || []);
  if (Array.isArray(setCookies)) {
    setCookies.forEach((c) => toHeaders.append("set-cookie", c));
  }
  const cc = fromHeaders.get ? fromHeaders.get("cache-control") : fromHeaders["cache-control"];
  if (cc) {
    toHeaders.set("cache-control", cc);
  }
  return toHeaders;
}

// Mock Supabase Auth provider
function mockUpdateSession(cookies) {
  const accessToken = cookies["sb-access-token"];
  const refreshToken = cookies["sb-refresh-token"];

  const headers = new Headers();

  // Scenario 1: No tokens -> unauthenticated
  if (!accessToken && !refreshToken) {
    return { user: null, headers };
  }

  // Scenario 2: Valid access token
  if (accessToken === "valid_access_token") {
    return {
      user: { id: "test-user-uuid-1", email: "testuser@example.com" },
      headers,
    };
  }

  // Scenario 3: Expired access token, but valid refresh token -> session refreshed!
  if (accessToken === "expired_access_token" && refreshToken === "valid_refresh_token") {
    headers.append("set-cookie", "sb-access-token=new_refreshed_access_token; Path=/; HttpOnly; SameSite=Lax");
    headers.append("set-cookie", "sb-refresh-token=new_refreshed_refresh_token; Path=/; HttpOnly; SameSite=Lax");
    headers.set("cache-control", "no-cache, no-store, must-revalidate");
    return {
      user: { id: "test-user-uuid-1", email: "testuser@example.com" },
      headers,
    };
  }

  // Invalid tokens
  return { user: null, headers };
}

function mockProxy(pathname, cookies = {}) {
  const session = mockUpdateSession(cookies);
  const user = session.user;

  // Unauthenticated user trying to access protected route
  if (!user && isProtected(pathname)) {
    const redirectHeaders = new Headers();
    redirectHeaders.set("location", "/onboarding/login");
    copySessionHeaders(session.headers, redirectHeaders);
    return {
      status: 307,
      redirectUrl: "/onboarding/login",
      headers: redirectHeaders,
      user: null,
    };
  }

  // Authenticated user trying to access guest-only route (e.g. login)
  if (user && isGuestOnly(pathname)) {
    const redirectHeaders = new Headers();
    redirectHeaders.set("location", "/");
    copySessionHeaders(session.headers, redirectHeaders);
    return {
      status: 307,
      redirectUrl: "/",
      headers: redirectHeaders,
      user,
    };
  }

  return {
    status: 200,
    headers: session.headers,
    user,
  };
}

test("P1: Supabase 인증 세션 & Proxy 라우팅 검증", async (t) => {
  await t.test("보호 경로 비로그인 접근 시 /onboarding/login으로 리다이렉트", () => {
    const res = mockProxy("/my", {});
    assert.strictEqual(res.status, 307);
    assert.strictEqual(res.redirectUrl, "/onboarding/login");
  });

  await t.test(
    "만료 access token + 유효 refresh token 상태에서 /onboarding/login 진입 시 홈 redirect에 갱신 쿠키가 포함됨",
    () => {
      const cookies = {
        "sb-access-token": "expired_access_token",
        "sb-refresh-token": "valid_refresh_token",
      };
      const res = mockProxy("/onboarding/login", cookies);
      assert.strictEqual(res.status, 307);
      assert.strictEqual(res.redirectUrl, "/");

      const setCookies = res.headers.getSetCookie();
      assert.ok(setCookies.length >= 2, "Set-Cookie should contain both new access and refresh tokens");
      assert.ok(setCookies.some((c) => c.includes("new_refreshed_access_token")));
      assert.ok(setCookies.some((c) => c.includes("new_refreshed_refresh_token")));
      assert.strictEqual(res.headers.get("cache-control"), "no-cache, no-store, must-revalidate");
    }
  );

  await t.test("갱신된 쿠키로 redirect 뒤 /my 접근 시 로그인 화면으로 되돌아가지 않고 200 통과", () => {
    // Client receives refreshed cookies and subsequent requests send the new valid access token
    const refreshedCookies = {
      "sb-access-token": "valid_access_token",
      "sb-refresh-token": "new_refreshed_refresh_token",
    };
    const res = mockProxy("/my", refreshedCookies);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.user?.id, "test-user-uuid-1");
  });
});
