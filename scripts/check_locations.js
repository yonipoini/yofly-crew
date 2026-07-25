const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data: locations, error } = await supabase
    .from('locations')
    .select('*');
  if (error) {
    console.error(error);
    return;
  }
  
  console.log(`Total locations: ${locations.length}`);
  if (locations.length > 0) {
    console.log(`First location:`, locations[0]);
  }
}
check();
