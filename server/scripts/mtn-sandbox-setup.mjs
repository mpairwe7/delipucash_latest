#!/usr/bin/env node

/**
 * MTN MoMo Sandbox Provisioning Script
 *
 * Creates API User + generates API Key for the MTN MoMo sandbox.
 * Run once per subscription key to set up sandbox credentials.
 *
 * Usage:
 *   node scripts/mtn-sandbox-setup.mjs <COLLECTION_PRIMARY_KEY> [DISBURSEMENT_PRIMARY_KEY]
 *
 * What it does:
 *   1. Generates a UUID v4 → API User ID
 *   2. POST /v1_0/apiuser  — registers the user against the subscription key
 *   3. POST /v1_0/apiuser/{uuid}/apikey — generates an API key
 *   4. Prints the env vars to add to your .env file
 *
 * If a DISBURSEMENT_PRIMARY_KEY is provided, the process repeats for disbursement.
 */

import crypto from 'crypto';

const SANDBOX_BASE = 'https://sandbox.momodeveloper.mtn.com';
const CALLBACK_HOST = 'https://webhook.site'; // Sandbox doesn't actually call back

async function provisionApiUser(subscriptionKey, label) {
  const apiUserId = crypto.randomUUID();
  console.log(`\n--- ${label} ---`);
  console.log(`Generated API User ID: ${apiUserId}`);

  // Step 1: Create API User
  console.log('Creating API user...');
  const createRes = await fetch(`${SANDBOX_BASE}/v1_0/apiuser`, {
    method: 'POST',
    headers: {
      'X-Reference-Id': apiUserId,
      'Ocp-Apim-Subscription-Key': subscriptionKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      providerCallbackHost: CALLBACK_HOST,
    }),
  });

  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Failed to create API user (${createRes.status}): ${body}`);
  }
  console.log('API user created successfully.');

  // Step 2: Generate API Key
  console.log('Generating API key...');
  const keyRes = await fetch(`${SANDBOX_BASE}/v1_0/apiuser/${apiUserId}/apikey`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': subscriptionKey,
    },
  });

  if (!keyRes.ok) {
    const body = await keyRes.text();
    throw new Error(`Failed to generate API key (${keyRes.status}): ${body}`);
  }

  const { apiKey } = await keyRes.json();
  console.log('API key generated successfully.');

  return { apiUserId, apiKey };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: node scripts/mtn-sandbox-setup.mjs <COLLECTION_KEY> [DISBURSEMENT_KEY]');
    console.error('');
    console.error('  COLLECTION_KEY      Your MTN Collection subscription primary key');
    console.error('  DISBURSEMENT_KEY    (Optional) Your MTN Disbursement subscription primary key');
    process.exit(1);
  }

  const [collectionKey, disbursementKey] = args;
  const envLines = [];

  try {
    // Provision Collection
    const collection = await provisionApiUser(collectionKey, 'Collection');
    envLines.push(`MTN_USER_ID="${collection.apiUserId}"`);
    envLines.push(`MTN_API_KEY="${collection.apiKey}"`);
    envLines.push(`MTN_PRIMARY_KEY="${collectionKey}"`);

    // Provision Disbursement (if key provided)
    if (disbursementKey) {
      const disbursement = await provisionApiUser(disbursementKey, 'Disbursement');
      envLines.push(`MTN_DISBURSEMENT_KEY="${disbursementKey}"`);
      // Note: sandbox uses the same apiUser for both, but if you have separate keys
      // you may want separate users. The collection user ID is used as the primary.
      console.log(`\nDisbursement API User ID: ${disbursement.apiUserId}`);
      console.log(`Disbursement API Key: ${disbursement.apiKey}`);
      console.log('(If your setup uses a single API user for both products, use the Collection credentials above.)');
    }

    console.log('\n========================================');
    console.log('Add these to your .env file:');
    console.log('========================================\n');
    envLines.forEach(line => console.log(line));
    console.log('X_TARGET_ENVIRONMENT="sandbox"');
    console.log('');
  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  }
}

main();
