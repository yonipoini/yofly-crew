const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('airline_domains').select('*');
  if (error) {
    console.error('Error fetching domains:', error);
  } else {
    console.log('Approved airline domains:', data);
  }
}
run();
