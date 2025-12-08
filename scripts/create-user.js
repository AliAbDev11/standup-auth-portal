import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gnjmnxvzeqscuatjtuua.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imduam1ueHZ6ZXFzY3VhdGp0dXVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQ3NjAwOCwiZXhwIjoyMDc3MDUyMDA4fQ.pqpA7RoyRZrYasiQYSy0cQdAk7SFSV5Dq8wm9FlDQoE';

const supabase = createClient(supabaseUrl, serviceRoleKey);

const email = 'boulfaf2013@gmail.com';
const password = 'sessio';
const departmentId = 'd2cbca36-8cb1-47ec-b291-4f5a0eca1f7d'; // AI Engineer

async function createUser() {
    console.log(`Creating user ${email}...`);

    // 1. Create Auth User
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: 'Test User' }
    });

    let userId;

    if (authError) {
        console.error('Error creating auth user:', authError.message);
        if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
            console.log('User already exists, trying to find ID...');
            const { data: users } = await supabase.auth.admin.listUsers();
            const existingUser = users.users.find(u => u.email === email);
            if (existingUser) {
                console.log('Found existing user ID:', existingUser.id);
                userId = existingUser.id;

                // Update password
                const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { password });
                if (updateError) console.error('Error updating password:', updateError);
                else console.log('Password updated.');
            }
        }
    } else if (authData.user) {
        console.log('Auth user created with ID:', authData.user.id);
        userId = authData.user.id;
    }

    if (userId) {
        await createProfile(userId);
    } else {
        console.log('Could not determine User ID, skipping profile creation.');
    }
}

async function createProfile(userId) {
    console.log('Creating/Updating profile for:', userId);

    const profileData = {
        id: userId,
        email: email,
        full_name: 'Test User',
        role: 'superadmin',
        is_active: true,
        department_id: departmentId
    };

    const { error } = await supabase
        .from('profiles')
        .upsert(profileData);

    if (error) {
        console.error('Error creating profile:', error);
    } else {
        console.log('Profile created successfully.');
    }
}

createUser();
