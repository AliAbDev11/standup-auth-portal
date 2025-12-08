import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gnjmnxvzeqscuatjtuua.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imduam1ueHZ6ZXFzY3VhdGp0dXVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQ3NjAwOCwiZXhwIjoyMDc3MDUyMDA4fQ.pqpA7RoyRZrYasiQYSy0cQdAk7SFSV5Dq8wm9FlDQoE';

const supabase = createClient(supabaseUrl, serviceRoleKey);

const departmentId = 'd2cbca36-8cb1-47ec-b291-4f5a0eca1f7d'; // AI Engineer

const users = [
    {
        email: 'manager@test.com',
        password: 'manager123',
        full_name: 'Test Manager',
        role: 'manager'
    },
    {
        email: 'member@test.com',
        password: 'member123',
        full_name: 'Test Member',
        role: 'member'
    }
];

async function createUsers() {
    console.log('Creating test accounts...\n');

    for (const user of users) {
        console.log(`Creating ${user.role}: ${user.email}...`);

        // 1. Create Auth User
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: user.email,
            password: user.password,
            email_confirm: true,
            user_metadata: { full_name: user.full_name }
        });

        let userId;

        if (authError) {
            if (authError.message.includes('already registered')) {
                console.log('  ⚠️  User already exists, finding ID...');
                const { data: users } = await supabase.auth.admin.listUsers();
                const existingUser = users.users.find(u => u.email === user.email);
                if (existingUser) {
                    userId = existingUser.id;
                    console.log(`  ✓ Found existing user ID: ${userId}`);

                    // Update password
                    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
                        password: user.password
                    });
                    if (updateError) {
                        console.error('  ✗ Error updating password:', updateError.message);
                    } else {
                        console.log('  ✓ Password updated');
                    }
                }
            } else {
                console.error('  ✗ Error creating auth user:', authError.message);
                continue;
            }
        } else if (authData.user) {
            console.log(`  ✓ Auth user created with ID: ${authData.user.id}`);
            userId = authData.user.id;
        }

        if (userId) {
            // 2. Create/Update profile
            const profileData = {
                id: userId,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                is_active: true,
                department_id: departmentId
            };

            const { error: profileError } = await supabase
                .from('profiles')
                .upsert(profileData);

            if (profileError) {
                console.error('  ✗ Error creating profile:', profileError.message);
            } else {
                console.log('  ✓ Profile created successfully');
            }
        }
        console.log('');
    }

    console.log('✅ All accounts created!\n');
    console.log('📋 Account Details:');
    console.log('---');
    console.log('Manager Account:');
    console.log('  Email: manager@test.com');
    console.log('  Password: manager123');
    console.log('  Dashboard: http://localhost:8080/manager/dashboard');
    console.log('');
    console.log('Member Account:');
    console.log('  Email: member@test.com');
    console.log('  Password: member123');
    console.log('  Dashboard: http://localhost:8080/member/dashboard');
    console.log('---');
}

createUsers();
