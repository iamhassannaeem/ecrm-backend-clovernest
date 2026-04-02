const ipRangeCheck = require('ip-range-check');

function getClientIP(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const first = String(xff).split(',')[0]?.trim();
    if (first) return first;
  }

  if (req.ip) return req.ip;

  const socketAddr = req.socket?.remoteAddress || req.connection?.remoteAddress;
  if (socketAddr) return socketAddr;

  return null;
}

function normalizeIpList(allowedIps) {
  if (!Array.isArray(allowedIps)) return [];
  return allowedIps.map((x) => String(x).trim()).filter(Boolean);
}

function isIPAllowed(ip, allowedIps) {
  const list = normalizeIpList(allowedIps);
  if (!list.length) return true; // no whitelist configured
  if (!ip) return false;
  try {
    return ipRangeCheck(ip, list);
  } catch {
    return false;
  }
}

module.exports = {
  getClientIP,
  isIPAllowed,
};

