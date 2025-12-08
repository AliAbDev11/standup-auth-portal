import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_PROJECT_REF = 'gnjmnxvzeqscuatjtuua';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

async function runMigration() {
    console.log('🚀 Running SQL migration via Supabase Management API...\n');

    if (!SUPABASE_ACCESS_TOKEN) {
        console.log('❌ SUPABASE_ACCESS_TOKEN environment variable not set');
        console.log('\n📋 Manual Migration Required:');
        console.log('---');
        console.log('1. Go to: https://supabase.com/dashboard/project/gnjmnxvzeqscuatjtuua/sql');
        console.log('2. Copy and paste the following SQL:');
        console.log('---\n');

        const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20251202_create_deliverables.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log(sql);
        console.log('\n---');
        console.log('3. Click "Run" to execute the migration');
        console.log('4. Verify the table was created successfully');
        return;
    }

    try {
        const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20251202_create_deliverables.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        const response = await fetch(
            `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: sql })
            }
        );

        if (response.ok) {
            console.log('✅ Migration executed successfully!');
        } else {
            const error = await response.text();
            console.error('❌ Migration failed:', error);
        }
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

runMigration();
