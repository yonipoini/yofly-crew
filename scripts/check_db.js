const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data: places, error } = await supabase
    .from('airport_directory_places')
    .select('*')
    .eq('airport_code', 'MCO');
  if (error) {
    console.error(error);
    return;
  }
  
  const securityPlaces = places.filter(p => p.airport_core_kind === "SECURITY");
  console.log('Security places for MCO:', securityPlaces);
}
check();
