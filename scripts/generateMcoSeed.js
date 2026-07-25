const fs = require('fs');
const { randomUUID } = require('crypto');

const terminalAData = {
  latitude: 28.432,
  longitude: -81.307,
  levels: {
    '3': [
      { name: 'Airline Check-In', type: 'SERVICE', kind: 'TERMINAL' },
      { name: 'Ride Share (9pm-2am)', type: 'SERVICE', kind: 'GROUND' },
      { name: 'Currency Exchange', type: 'SERVICE', kind: 'SERVICE' },
    ],
    '2': [
      { name: 'Bag Claim Carousels 1-16', type: 'SERVICE', kind: 'BAGGAGE' },
      { name: 'Ride Share', type: 'SERVICE', kind: 'GROUND' },
      { name: 'Service Animal Relief Area', type: 'SAFE_AREA', kind: 'TERMINAL' },
      { name: 'Starbucks', type: 'COFFEE', kind: 'COFFEE' },
    ],
    '1': [
      { name: 'Bag Claim 8A - Virgin Atlantic', type: 'SERVICE', kind: 'BAGGAGE' },
      { name: 'Bag Wrapping & Stroller Rental', type: 'SERVICE', kind: 'SERVICE' },
      { name: 'Buses - Lynx', type: 'SERVICE', kind: 'GROUND' },
      { name: 'Lost & Found', type: 'SERVICE', kind: 'SERVICE' },
      { name: 'On Airport Rental Car Agencies', type: 'SERVICE', kind: 'GROUND' },
      { name: 'Out of Town Shuttles', type: 'SERVICE', kind: 'SHUTTLE' },
      { name: 'Parking Shuttles', type: 'SERVICE', kind: 'SHUTTLE' },
      { name: 'Resort Transportation', type: 'SERVICE', kind: 'SHUTTLE' },
      { name: 'Taxi, Towncar, Shuttles', type: 'SERVICE', kind: 'GROUND' },
      { name: 'USO Welcome Center', type: 'LOUNGE', kind: 'LOUNGE' },
      { name: 'Off-Airport Rental Car Agencies', type: 'SERVICE', kind: 'GROUND' },
    ]
  }
};

const terminalBData = {
  latitude: 28.429,
  longitude: -81.307,
  levels: {
    '3': [
      { name: 'Airline Check-In', type: 'SERVICE', kind: 'TERMINAL' },
      { name: 'Ride Share (9pm-2am)', type: 'SERVICE', kind: 'GROUND' },
    ],
    '2': [
      { name: 'Bag Claim Carousels 20-32', type: 'SERVICE', kind: 'BAGGAGE' },
      { name: 'Nursing Pod', type: 'SAFE_AREA', kind: 'TERMINAL' },
      { name: 'Ride Share', type: 'SERVICE', kind: 'GROUND' },
      { name: 'Service Animal Relief Area', type: 'SAFE_AREA', kind: 'TERMINAL' },
      { name: 'TSA PreCheck Enrollment', type: 'SERVICE', kind: 'SECURITY' },
    ],
    '1': [
      { name: 'Bag Check - Southwest', type: 'SERVICE', kind: 'BAGGAGE' },
      { name: 'Bag Claim 28B', type: 'SERVICE', kind: 'BAGGAGE' },
      { name: 'Bag Storage & Strollers', type: 'SERVICE', kind: 'SERVICE' },
      { name: 'Buses', type: 'SERVICE', kind: 'GROUND' },
      { name: 'On Airport Rental Car Agencies', type: 'SERVICE', kind: 'GROUND' },
      { name: 'Out of Town Shuttles', type: 'SERVICE', kind: 'SHUTTLE' },
      { name: 'Parking Shuttles', type: 'SERVICE', kind: 'SHUTTLE' },
      { name: 'Universal SuperStar Shuttle', type: 'SERVICE', kind: 'SHUTTLE' },
      { name: 'Taxi, Towncar, Shuttles', type: 'SERVICE', kind: 'GROUND' },
      { name: 'Starbucks', type: 'COFFEE', kind: 'COFFEE' },
      { name: 'Off-Airport Rental Car Agencies', type: 'SERVICE', kind: 'GROUND' },
    ]
  }
};

const terminalCData = {
  latitude: 28.419,
  longitude: -81.308,
  levels: {
    '6': [
      { name: 'Bag Claim', type: 'SERVICE', kind: 'BAGGAGE' },
      { name: 'Barnie\'s Coffee & Tea', type: 'COFFEE', kind: 'COFFEE' },
      { name: 'Customs & Immigration', type: 'SERVICE', kind: 'SECURITY' },
      { name: 'Gatlin Trade (News & Gifts)', type: 'SHOPPING', kind: 'TERMINAL' },
      { name: 'Meet & Greet Area', type: 'SAFE_AREA', kind: 'TERMINAL' },
      { name: 'Ride Share', type: 'SERVICE', kind: 'GROUND' },
      { name: 'Starbucks', type: 'COFFEE', kind: 'COFFEE' },
    ],
    '4': [
      { name: 'Bridge to Garage C', type: 'SERVICE', kind: 'TERMINAL' },
      { name: 'Bridge to Ground Transportation', type: 'SERVICE', kind: 'TERMINAL' },
      { name: 'Eola Market (24hr Vending)', type: 'GROCERY', kind: 'TERMINAL' },
      { name: 'Nursing Room', type: 'SAFE_AREA', kind: 'TERMINAL' },
      { name: 'On-Airport Rental Car Agencies', type: 'SERVICE', kind: 'GROUND' },
    ],
    '2': [
      { name: 'Airline Check-In', type: 'SERVICE', kind: 'TERMINAL' },
    ],
    '1': [
      { name: 'Global Entry Enrollment', type: 'SERVICE', kind: 'SECURITY' },
      { name: 'Lost & Found', type: 'SERVICE', kind: 'SERVICE' },
      { name: 'Nursing Room', type: 'SAFE_AREA', kind: 'TERMINAL' },
      { name: 'Orlando Police Department', type: 'SAFE_AREA', kind: 'SECURITY' },
      { name: 'Out of Town Shuttles', type: 'SERVICE', kind: 'SHUTTLE' },
      { name: 'Parking Shuttles', type: 'SERVICE', kind: 'SHUTTLE' },
      { name: 'Resort Transportation', type: 'SERVICE', kind: 'SHUTTLE' },
    ]
  }
};

const trainStationData = {
  latitude: 28.420,
  longitude: -81.302,
  levels: {
    '5': [
      { name: 'Brightline Train Entrance', type: 'SERVICE', kind: 'GROUND' },
      { name: 'Access to Terminal C', type: 'SERVICE', kind: 'TERMINAL' },
      { name: 'Access to Parking Garage C', type: 'SERVICE', kind: 'TERMINAL' },
      { name: 'On-Airport Rental Car Agencies', type: 'SERVICE', kind: 'GROUND' },
    ],
    '3': [
      { name: 'Terminal Link to Terminal A/B', type: 'SERVICE', kind: 'TERMINAL' },
      { name: 'Access to Parking Garage C', type: 'SERVICE', kind: 'TERMINAL' },
      { name: 'Information Kiosk', type: 'SERVICE', kind: 'SERVICE' },
    ],
    '1': [
      { name: 'Passenger Drop-Off Lane', type: 'SERVICE', kind: 'GROUND' },
      { name: 'Access to Surface Lots (Atlantis, Discovery, Endeavour)', type: 'SERVICE', kind: 'GROUND' },
      { name: 'Taxi Stand', type: 'SERVICE', kind: 'GROUND' },
      { name: 'Ride Share Pickup', type: 'SERVICE', kind: 'GROUND' },
    ]
  }
};

const areas = [
  { prefix: 'TA', name: 'Terminal A', data: terminalAData },
  { prefix: 'TB', name: 'Terminal B', data: terminalBData },
  { prefix: 'TC', name: 'Terminal C', data: terminalCData },
  { prefix: 'TS', name: 'Train Station', data: trainStationData }
];

// Prepend DDL to align DB check constraints with frontend LocationType enum (allowing SERVICE and SHOPPING)
let sql = `-- Align DB check constraints with frontend LocationType enum (adding SERVICE and SHOPPING)
ALTER TABLE airport_directory_places DROP CONSTRAINT IF EXISTS airport_directory_places_type_check;
ALTER TABLE airport_directory_places ADD CONSTRAINT airport_directory_places_type_check 
  CHECK (type IN ('RESTAURANT', 'COFFEE', 'GYM', 'GROCERY', 'NIGHTLIFE', 'SAFE_AREA', 'PHARMACY', 'LOUNGE', 'SHOPPING', 'SERVICE'));

INSERT INTO airport_directory_places (id, airport_code, key, name, type, latitude, longitude, address, rating, review_count, crew_favorite, airport_core, airport_core_kind, short_label, level, zone, crew_note) VALUES\n`;

const rows = [];
for (const area of areas) {
  for (const [level, facilities] of Object.entries(area.data.levels)) {
    facilities.forEach(f => {
      // Small random offset so pins don't overlap completely
      const latOffset = (Math.random() - 0.5) * 0.001;
      const lonOffset = (Math.random() - 0.5) * 0.001;
      
      const id = randomUUID();
      const key = `MCO_${area.prefix}_L${level}_${f.name.replace(/[^a-zA-Z0-9]/g, '')}`;
      
      rows.push(`('${id}', 'MCO', '${key}', '${f.name.replace(/'/g, "''")}', '${f.type}', ${area.data.latitude + latOffset}, ${area.data.longitude + lonOffset}, '${area.name}', 0, 0, false, true, '${f.kind}', '${f.name.substring(0, 15).replace(/'/g, "''")}', 'Level ${level}', '${area.name}', '')`);
    });
  }
}

sql += rows.join(',\n') + `\nON CONFLICT (key) DO UPDATE SET level = EXCLUDED.level, zone = EXCLUDED.zone, type = EXCLUDED.type, airport_core_kind = EXCLUDED.airport_core_kind;`;

fs.writeFileSync('scripts/mco_seed.sql', sql);
console.log('Generated scripts/mco_seed.sql with Train Station data and Check Constraint DDL patches!');
