const {
  parseCookies,
  createRandomToken,
  createTokenHash,
} = require('../utils/security');
const { getClientIp, getUserAgent } = require('./audit-service');

function buildCookie(env, name, value, { maxAge = 0, httpOnly = true } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    httpOnly ? 'HttpOnly' : '',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
    'Priority=High',
  ].filter(Boolean);

  if (env.secureCookies) parts.push('Secure');
  return parts.join('; ');
}

function setSessionCookies(res, env, sessionToken, csrfToken) {
  const maxAge = env.sessionHours * 60 * 60;
  res.setHeader('Set-Cookie', [
    buildCookie(env, env.sessionCookieName, sessionToken, { maxAge, httpOnly: true }),
    buildCookie(env, env.csrfCookieName, csrfToken, { maxAge, httpOnly: false }),
  ]);
}

function clearSessionCookies(res, env) {
  res.setHeader('Set-Cookie', [
    buildCookie(env, env.sessionCookieName, '', { maxAge: 0, httpOnly: true }),
    buildCookie(env, env.csrfCookieName, '', { maxAge: 0, httpOnly: false }),
  ]);
}

function getSessionTokenFromRequest(req, env) {
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies[env.sessionCookieName] || cookies.admin_session || '';
}

function getCsrfCookieFromRequest(req, env) {
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies[env.csrfCookieName] || cookies.admin_csrf || '';
}

async function createAdminSession(pool, env, admin, req, res) {
  const sessionToken = createRandomToken(48);
  const csrfToken = createRandomToken(24);
  const expiresAt = new Date(Date.now() + env.sessionHours * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO admin_sessions (admin_id, token_hash, csrf_token_hash, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      admin.id,
      createTokenHash(sessionToken),
      createTokenHash(csrfToken),
      getClientIp(req),
      getUserAgent(req),
      expiresAt,
    ]
  );

  setSessionCookies(res, env, sessionToken, csrfToken);
}

async function deleteCurrentSession(pool, env, req) {
  const token = getSessionTokenFromRequest(req, env);
  if (!token) return;
  await pool.query('DELETE FROM admin_sessions WHERE token_hash = $1', [createTokenHash(token)]);
}

async function getAdminSession(pool, env, req) {
  const sessionToken = getSessionTokenFromRequest(req, env);
  if (!sessionToken) return null;

  const result = await pool.query(
    `SELECT
        s.id AS session_id,
        s.admin_id,
        s.csrf_token_hash,
        s.expires_at,
        a.name,
        a.email
       FROM admin_sessions s
       JOIN admins a ON a.id = s.admin_id
      WHERE s.token_hash = $1
        AND s.expires_at > NOW()
      LIMIT 1`,
    [createTokenHash(sessionToken)]
  );

  if (!result.rows[0]) return null;

  return {
    sessionId: result.rows[0].session_id,
    id: result.rows[0].admin_id,
    name: result.rows[0].name,
    email: result.rows[0].email,
    csrfTokenHash: result.rows[0].csrf_token_hash,
    sessionToken,
  };
}

module.exports = {
  createAdminSession,
  deleteCurrentSession,
  getAdminSession,
  setSessionCookies,
  clearSessionCookies,
  getSessionTokenFromRequest,
  getCsrfCookieFromRequest,
};
