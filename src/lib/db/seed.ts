import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Direct connection for seed script (bypasses server-only import in db/index.ts)
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client, { schema });

async function seed() {
  console.log('Seeding database...');

  // Client 1: Omatapalo (active POC)
  const [client1] = await db.insert(schema.clients).values({
    name: 'Omatapalo',
    industry: 'Construction',
    website: 'https://omatapalo.com',
    hqLocation: 'Madrid, Spain',
    status: 'active_poc',
    notes: 'Venture Vanguard arm. Procurement department.',
    aiSummary: 'Omatapalo is a Spanish construction company with a procurement department that handles supplier quote intake, RFQ generation, and purchase order creation.',
  }).returning();
  console.log(`  Created client: ${client1.name}`);

  // Client 1 contacts
  await db.insert(schema.contacts).values([
    { clientId: client1.id, name: 'Jorge Garcia', role: 'Procurement Director', department: 'Procurement', email: 'jorge@omatapalo.com' },
    { clientId: client1.id, name: 'Maria Lopez', role: 'Senior Buyer', department: 'Procurement', email: 'maria@omatapalo.com' },
    { clientId: client1.id, name: 'Carlos Ruiz', role: 'Junior Buyer', department: 'Procurement' },
  ]);
  console.log('  Created 3 contacts');

  // Client 1 process
  const [proc1] = await db.insert(schema.processes).values({
    clientId: client1.id,
    name: 'Supplier Quote Intake',
    departmentTag: 'Procurement',
    description: 'Team receives supplier quotes via email, compares prices in Excel, generates PO.',
    status: 'mapping',
    processTypeL1: 'procurement',
    hypothesisText: 'The procurement team receives supplier quotes via email (Outlook). Maria and Carlos manually copy quote data into an Excel comparison spreadsheet. Once a supplier is selected, Jorge approves and a PO is generated in their ERP system.',
  }).returning();

  await db.insert(schema.processModels).values({
    processId: proc1.id,
    steps: [
      { id: 'step_001', order: 1, name: 'Receive supplier email', description: 'Quote arrives via Outlook', confidence: 'confirmed', systems: ['Email'], nextSteps: ['step_002'], branchCondition: null, relatedEdgeCases: [], notes: '' },
      { id: 'step_002', order: 2, name: 'Open and review quote', description: 'Buyer opens email, checks attachments', confidence: 'confirmed', systems: ['Email'], nextSteps: ['step_003'], branchCondition: null, relatedEdgeCases: ['edge_001'], notes: '' },
      { id: 'step_003', order: 3, name: 'Enter data in comparison map', description: 'Copy price, terms, delivery into Excel', confidence: 'inferred', systems: ['Excel'], nextSteps: ['step_004'], branchCondition: null, relatedEdgeCases: [], notes: '' },
      { id: 'step_004', order: 4, name: 'Compare suppliers', description: 'Review comparison and select best option', confidence: 'inferred', systems: ['Excel'], nextSteps: ['step_005'], branchCondition: null, relatedEdgeCases: [], notes: '' },
      { id: 'step_005', order: 5, name: 'Request approval', description: 'Send selection to director for approval', confidence: 'inferred', systems: ['Email'], nextSteps: ['step_006'], branchCondition: null, relatedEdgeCases: [], notes: '' },
      { id: 'step_006', order: 6, name: 'Generate purchase order', description: 'Create PO in ERP system', confidence: 'missing', systems: ['ERP'], nextSteps: [], branchCondition: null, relatedEdgeCases: [], notes: '' },
    ],
    edgeCases: [
      { id: 'edge_001', description: 'Supplier responds without price in email body (price only in attachment)', frequency: 'occasional', suggestedHandling: 'Open attachment to extract price', status: 'open', relatedStepId: 'step_002' },
    ],
    systems: [
      { name: 'Email', confirmed: true, role: 'Receive supplier quotes', details: 'Outlook', gaps: '', detailNotes: '' },
      { name: 'Excel', confirmed: false, role: 'Price comparison', details: '', gaps: 'Which file? Which sheet? Column structure?', detailNotes: '' },
      { name: 'ERP', confirmed: false, role: 'PO generation', details: '', gaps: 'Which ERP system? SAP? Custom?', detailNotes: '' },
    ],
  });
  console.log(`  Created process: ${proc1.name} with 6 steps`);

  await db.insert(schema.openQuestions).values([
    { processId: proc1.id, text: 'What triggers the PO generation — is it automatic after approval?', priority: 'critical' as const, status: 'open' as const },
    { processId: proc1.id, text: 'Does the manager approve every PO or only above a threshold?', priority: 'critical' as const, status: 'open' as const },
    { processId: proc1.id, text: 'What naming convention does the comparison Excel use?', priority: 'important' as const, status: 'open' as const },
  ]);
  console.log('  Created 3 open questions');

  // Client 2: Empty prospecting client
  await db.insert(schema.clients).values({
    name: 'Logistika Express',
    industry: 'Logistics',
    status: 'prospecting',
    notes: 'First contact at trade show. Interested in freight forwarding automation.',
  });
  console.log('  Created client: Logistika Express (empty)');

  console.log('\nSeed complete!');
  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
