import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gnjmnxvzeqscuatjtuua.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imduam1ueHZ6ZXFzY3VhdGp0dXVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQ3NjAwOCwiZXhwIjoyMDc3MDUyMDA4fQ.pqpA7RoyRZrYasiQYSy0cQdAk7SFSV5Dq8wm9FlDQoE';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkDepartments() {
    console.log('Fetching departments...');
    const { data, error } = await supabase
        .from('departments')
        .select('*')
        .limit(5);

    if (error) {
        console.error('Error fetching departments:', error);
    } else {
        console.log('Departments:', JSON.stringify(data, null, 2));
    }
}

checkDepartments();
