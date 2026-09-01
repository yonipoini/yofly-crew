const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function createTestAccount() {
  const email = 'reviewdemo2@yoflycrew.com';
  const password = 'YoFlyTestPass2026!';

  console.log(`Creating test account: ${email}...`);

  // Try signing up
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error('Sign up error:', error.message);
    if (error.message.includes('already registered')) {
      console.log('User already exists! You can sign in with:');
      console.log(`Email: ${email}`);
      console.log(`Password: ${password}`);
    }
    return;
  }

  const userId = data?.user?.id;
  console.log('Created auth user ID:', userId);

  if (userId) {
    // Create profile
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      full_name: 'Captain Alex Reed',
      role: 'PILOT',
      airline: 'Delta Air Lines',
      airline_email: email,
      base_airport: 'ATL',
      aircraft: 'A350',
      verification_airline: 'Delta Air Lines',
      verification_status: 'VERIFIED_CREW',
      verified_crew: true,
    });

    if (profileError) {
      console.error('Profile creation error:', profileError.message);
    } else {
      console.log('Profile created and verified successfully!');
    }
  }

  console.log('\n--- Credentials for Video & Review ---');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

createTestAccount();
