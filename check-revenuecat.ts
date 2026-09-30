import { ReplitConnectors } from '@replit/connectors-sdk';

// Read-only diagnostics. Never prints SDK keys, tokens, or customer records.
const connectors = new ReplitConnectors();
const projectId = process.env.REVENUECAT_PROJECT_ID;
if (!projectId) throw new Error('REVENUECAT_PROJECT_ID is missing.');

async function read(path: string) {
  const response = await connectors.proxy('revenuecat', `/v2/projects/${projectId}/${path}`, { method: 'GET' });
  if (!response.ok) throw new Error(`RevenueCat ${path}: HTTP ${response.status}`);
  const data = await response.json();
  if (!data || typeof data !== 'object' || !('items' in data) || !Array.isArray(data.items)
    || !data.items.every((item) => item !== null && typeof item === 'object')) {
    throw new Error(`RevenueCat ${path}: unexpected list response`);
  }
  return data as { items: Record<string, unknown>[] };
}

const [apps, products, offerings, entitlements] = await Promise.all(
  ['apps', 'products', 'offerings', 'entitlements'].map(read),
);
console.log(JSON.stringify({
  apps: apps.items.map((item) => ({ id: item.id, name: item.name, type: item.type })),
  products: products.items.map((item) => ({ id: item.id, app_id: item.app_id, store_identifier: item.store_identifier, type: item.type })),
  offerings: offerings.items.map((item) => ({ id: item.id, lookup_key: item.lookup_key, is_current: item.is_current })),
  entitlements: entitlements.items.map((item) => ({ id: item.id, lookup_key: item.lookup_key })),
}, null, 2));

for (const offering of offerings.items) {
  const packages = await read(`offerings/${offering.id}/packages`);
  console.log(JSON.stringify({ offering: offering.lookup_key, packages: packages.items }, null, 2));
  for (const pkg of packages.items) {
    console.log(JSON.stringify({ package: pkg.lookup_key, products: (await read(`packages/${pkg.id}/products`)).items }, null, 2));
  }
}

for (const entitlement of entitlements.items) {
  console.log(JSON.stringify({ entitlement: entitlement.lookup_key, products: (await read(`entitlements/${entitlement.id}/products`)).items }, null, 2));
}