async function audit(pool, adminId, action, entityType, entityId, req, details = {}) {
  try {
    await pool.query(
      `INSERT INTO admin_audit_logs (admin_id, action, entity_type, entity_id, ip_address, user_agent, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [
        adminId || null,
        action,
        entityType,
        entityId == null ? null : String(entityId),
        getClientIp(req),
        getUserAgent(req),
        JSON.stringify(details || {}),
      ]
    );
  } catch (error) {
    console.error('No se pudo registrar la auditoría.', error);
  }
}

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
}

function getUserAgent(req) {
  return String(req.headers['user-agent'] || '').slice(0, 300);
}

module.exports = {
  audit,
  getClientIp,
  getUserAgent,
};
