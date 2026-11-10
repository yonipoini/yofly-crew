const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/yoni/.gemini/antigravity-ide/scratch/yoflycrew_antigravity/.env' });

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

// Mirror the logic implemented in CrewVerificationService.ts
const normalizeEmail = (email) => email.trim().toLowerCase();
const extractDomain = (email) => (normalizeEmail(email).split('@')[1] || '').trim();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));

const normalizeRole = (roleLabel) => {
  const normalized = roleLabel.trim().toUpperCase();
  if (normalized === 'FLIGHT ATTENDANT' || normalized === 'CABIN CREW') return 'FA';
  if (normalized === 'PILOT' || normalized === 'CAPTAIN' || normalized === 'FIRST OFFICER') return 'PILOT';
  return normalized;
};

const normalizeAirlineForComparison = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(airlines|airline|airways|air|inc|llc|corp|group|is)$/g, '');
};

const areAirlineNamesCompatible = (selectedAirline, domainAirline) => {
  if (!selectedAirline || !domainAirline) return true;
  const s = normalizeAirlineForComparison(selectedAirline);
  const d = normalizeAirlineForComparison(domainAirline);
  if (!s || !d) return true;
  if (s === 'yoflycrew' || d === 'yoflycrew') return true;
  return s.includes(d) || d.includes(s);
};

async function checkAirlineEmail(email, roleLabel, selectedAirline) {
  const normalizedEmail = normalizeEmail(email);
  const domain = extractDomain(normalizedEmail);

  if (!isValidEmail(normalizedEmail)) {
    return {
      matched: false,
      reason: 'Enter a valid airline work email address.',
    };
  }

  const { data: domains, error } = await supabase
    .from('airline_domains')
    .select('airline_name, domain, accepted_roles, is_active')
    .order('airline_name', { ascending: true });

  if (error) {
    throw new Error('Failed to load airline domains: ' + error.message);
  }

  const match = domains.find((item) => item.domain.toLowerCase() === domain);

  if (!match) {
    return {
      matched: false,
      reason: `Registration requires an approved airline work email address. The domain "@${domain}" is not recognized as an eligible airline domain.`,
    };
  }

  if (!match.is_active) {
    return {
      matched: false,
      reason: `The domain "@${domain}" (${match.airline_name}) is currently inactive for crew verification.`,
    };
  }

  const normalizedRole = normalizeRole(roleLabel);
  const acceptedRoles = match.accepted_roles || ['PILOT', 'FA'];
  if (!acceptedRoles.includes(normalizedRole)) {
    return {
      matched: false,
      reason: `The role "${roleLabel}" is not supported for domain "@${domain}" (${match.airline_name}).`,
    };
  }

  if (selectedAirline && !areAirlineNamesCompatible(selectedAirline, match.airline_name)) {
    return {
      matched: false,
      reason: `Your email domain "@${domain}" belongs to ${match.airline_name}, but you selected "${selectedAirline}". Please select ${match.airline_name} or use your ${selectedAirline} corporate email.`,
    };
  }

  return {
    matched: true,
    airlineName: match.airline_name,
    domain: match.domain,
  };
}

async function runTestSuite() {
  console.log('=== YOFLY CREW VERIFICATION TEST SUITE ===\n');

  const tests = [
    {
      name: 'Test 1: Valid Airline Email & Matching Airline (Delta)',
      email: 'john.smith@delta.com',
      role: 'PILOT',
      airline: 'Delta Air Lines',
      expectSuccess: true,
    },
    {
      name: 'Test 2: Valid Airline Email & Matching Airline (Southwest - wnco.com)',
      email: 'sarah.j@wnco.com',
      role: 'FLIGHT ATTENDANT',
      airline: 'Southwest Airlines',
      expectSuccess: true,
    },
    {
      name: 'Test 3: Personal Email (Gmail) - MUST BE REJECTED',
      email: 'pilot123@gmail.com',
      role: 'PILOT',
      airline: 'Delta Air Lines',
      expectSuccess: false,
    },
    {
      name: 'Test 4: Personal Email (Yahoo) - MUST BE REJECTED',
      email: 'crew_member@yahoo.com',
      role: 'FA',
      airline: 'United Airlines',
      expectSuccess: false,
    },
    {
      name: 'Test 5: Mismatched Airline (United email with Delta selected)',
      email: 'pilot@united.com',
      role: 'PILOT',
      airline: 'Delta Air Lines',
      expectSuccess: false,
    },
    {
      name: 'Test 6: Inactive or Fake Domain',
      email: 'pilot@fakeairline.com',
      role: 'PILOT',
      airline: 'Fake Airlines',
      expectSuccess: false,
    },
  ];

  let passedCount = 0;

  for (const t of tests) {
    try {
      const res = await checkAirlineEmail(t.email, t.role, t.airline);
      const passed = res.matched === t.expectSuccess;

      if (passed) {
        passedCount++;
        console.log(`[PASS] ${t.name}`);
        if (res.matched) {
          console.log(`       Matched Airline: "${res.airlineName}" (${res.domain})`);
        } else {
          console.log(`       Correctly Blocked Reason: "${res.reason}"`);
        }
      } else {
        console.error(`[FAIL] ${t.name}`);
        console.error(`       Expected: matched=${t.expectSuccess}, Got: matched=${res.matched}`);
        console.error(`       Result:`, res);
      }
    } catch (err) {
      console.error(`[ERROR] ${t.name}:`, err.message);
    }
    console.log('');
  }

  console.log(`\nResults: ${passedCount}/${tests.length} tests passed successfully.`);
}

runTestSuite();

