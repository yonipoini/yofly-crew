const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function testSignIn() {
  const email = 'reviewdemo2@yoflycrew.com';
  const password = 'YoFlyTestPass2026!';

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('Sign in error:', error.message);
    return;
  }

  console.log('Successfully signed in as:', data.user.email);

  // Now as authenticated user, create profile
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: data.user.id,
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
    console.error('Profile upsert error:', profileError.message);
  } else {
    console.log('Profile created and verified successfully!');
  }
}

testSignIn();
