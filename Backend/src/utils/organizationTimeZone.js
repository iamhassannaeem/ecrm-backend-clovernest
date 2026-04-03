const { prisma } = require('../config/database');
const { DateTime } = require('luxon');

const DEFAULT_ORG_TIMEZONE = 'America/New_York';

/**
 * Resolves the organization's IANA time zone (defaults to US Eastern).
 */
async function getOrganizationTimeZone(organizationId) {
  if (organizationId == null || organizationId === '') {
    return DEFAULT_ORG_TIMEZONE;
  }
  const org = await prisma.organization.findUnique({
    where: { id: Number(organizationId) },
    select: { timeZone: true }
  });
  const tz = org?.timeZone;
  if (tz && typeof tz === 'string' && tz.trim()) {
    const z = tz.trim();
    if (DateTime.now().setZone(z).isValid) return z;
  }
  return DEFAULT_ORG_TIMEZONE;
}

module.exports = {
  getOrganizationTimeZone,
  DEFAULT_ORG_TIMEZONE
};
