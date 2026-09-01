const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function createReviewerAccount() {
  const email = 'crewreview@yoflycrew.com';
  const password = 'YoFlyReview2026!';

  console.log(`Creating permanent reviewer account: ${email}...`);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error && !error.message.includes('already registered')) {
    console.error('Sign up error:', error.message);
    return;
  }

  const userId = data?.user?.id;
  console.log('User created/found with ID:', userId);

  // Activate email in database
  console.log(`\nRun this SQL in Supabase SQL editor to confirm the email:`);
  console.log(`UPDATE auth.users SET email_confirmed_at = NOW() WHERE email = '${email}';`);
}

createReviewerAccount();
