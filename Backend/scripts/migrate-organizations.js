const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateOrganizations() {
  try {
    console.log('Starting organization migration...');

    // Get all organizations without domains
    const organizations = await prisma.organization.findMany({
      where: {
        domain: null
      }
    });

    console.log(`Found ${organizations.length} organizations without domains`);

    for (const org of organizations) {
      // Generate domain from organization name
      let baseDomain = org.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 20);
      
      if (!baseDomain) {
        baseDomain = 'org';
      }

      let domain = `${baseDomain}.example.com`;
      let counter = 1;

      // Ensure domain is unique
      while (await prisma.organization.findUnique({ where: { domain } })) {
        domain = `${baseDomain}${counter}.example.com`;
        counter++;
      }

      // Update organization with domain
      await prisma.organization.update({
        where: { id: org.id },
        data: { domain }
      });

      console.log(`Updated organization "${org.name}" with domain: ${domain}`);
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateOrganizations();
