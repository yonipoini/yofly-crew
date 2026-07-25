-- Seed Data for Airport Directory
-- Flagship: MCO (Orlando International)

INSERT INTO airport_directory_places (airport_code, key, name, type, latitude, longitude, address, rating, review_count, crew_favorite, airport_core, airport_core_kind, short_label, level, zone, crew_note)
VALUES 
-- MCO SECURITY
('MCO', 'mco-security-east', 'East Checkpoint', 'SAFE_AREA', 28.4329391304, -81.3081, 'MCO Main Terminal', 4.4, 19, FALSE, TRUE, 'SECURITY', 'SEC', 'Level 3', 'East Atrium', 'Main screening bank; verify KCM and crew timing before report.'),
('MCO', 'mco-security-west', 'West Checkpoint', 'SAFE_AREA', 28.4325043478, -81.3099, 'MCO Main Terminal', 4.5, 23, FALSE, TRUE, 'SECURITY', 'SEC', 'Level 3', 'West Atrium', 'Alternate screening bank near A/B terminal flow. Usually faster in the morning.'),
('MCO', 'mco-security-terminal-c', 'Terminal C Checkpoint', 'SAFE_AREA', 28.4283, -81.3077, 'Terminal C', 4.7, 36, FALSE, TRUE, 'SECURITY', 'SEC', 'Level 2', 'Terminal C', 'Modern screening for international and JetBlue ops. Separate shuttle from A/B.'),

-- MCO GATES
('MCO', 'mco-gates-pod-1', 'Gates 1-29', 'SAFE_AREA', 28.435, -81.312, 'Airside 1', 4.2, 15, FALSE, TRUE, 'TERMINAL', '1-29', 'Post-security', 'Airside 1', 'Take the APM train from the West Hall.'),
('MCO', 'mco-gates-pod-2', 'Gates 30-59', 'SAFE_AREA', 28.435, -81.304, 'Airside 2', 4.1, 14, FALSE, TRUE, 'TERMINAL', '30-59', 'Post-security', 'Airside 2', 'Take the APM train from the East Hall.'),
('MCO', 'mco-gates-pod-3', 'Gates 70-99', 'SAFE_AREA', 28.428, -81.312, 'Airside 3', 4.3, 17, FALSE, TRUE, 'TERMINAL', '70-99', 'Post-security', 'Airside 3', 'Take the APM train from the West Hall.'),
('MCO', 'mco-gates-pod-4', 'Gates 100-129', 'SAFE_AREA', 28.428, -81.304, 'Airside 4', 4.4, 18, FALSE, TRUE, 'TERMINAL', '100-129', 'Post-security', 'Airside 4', 'Take the APM train from the East Hall.'),

-- MCO FOOD & COFFEE
('MCO', 'mco-starbucks-main', 'Starbucks (Atrium)', 'COFFEE', 28.4316, -81.3081, 'MCO Main Terminal', 4.6, 120, TRUE, FALSE, 'COFFEE', '☕', 'Level 3', 'Atrium', 'Reliable pre-security reset spot. Mobile ordering works well here.'),
('MCO', 'mco-food-court', 'Main Food Court', 'RESTAURANT', 28.4316, -81.309, 'MCO Main Terminal', 4.3, 85, FALSE, FALSE, NULL, '🍴', 'Level 3', 'Food Court', 'Standard options; Chick-fil-A and Chipotle are popular choices.'),
('MCO', 'mco-wine-bar-george', 'Wine Bar George', 'NIGHTLIFE', 28.4332, -81.3097, 'Terminal C', 4.8, 45, TRUE, FALSE, NULL, '🍷', 'Level 2', 'Terminal C', 'Great for a post-trip sit down if you have time in Terminal C.'),

-- MCO BAGGAGE & GROUND
('MCO', 'mco-baggage-a', 'Baggage Claim A', 'SAFE_AREA', 28.4316, -81.309, 'Terminal A', 4.0, 12, FALSE, TRUE, 'BAGGAGE', 'BAG', 'Level 2', 'Side A', 'Check monitors; A-side claims are 1-16.'),
('MCO', 'mco-baggage-b', 'Baggage Claim B', 'SAFE_AREA', 28.4316, -81.307, 'Terminal B', 4.0, 10, FALSE, TRUE, 'BAGGAGE', 'BAG', 'Level 2', 'Side B', 'Check monitors; B-side claims are 20-32.'),
('MCO', 'mco-ground-transport', 'Ground Transport Hub', 'SAFE_AREA', 28.4294, -81.3064, 'Level 1', 4.5, 33, FALSE, TRUE, 'GROUND', 'GT', 'Level 1', 'Terminal A/B', 'Bus, shuttle, and rideshare pickup. Rideshare is at the ends of the curb.'),
('MCO', 'mco-shuttle-parking', 'Parking Shuttle', 'SAFE_AREA', 28.428, -81.305, 'Economy Lot Shuttle', 4.4, 25, FALSE, TRUE, 'SHUTTLE', 'BUS', 'Level 1', 'Side A/B', 'Economy shuttles run every 10-15 minutes.'),

-- JFK (Quick Updates)
('JFK', 'jfk-security-t4', 'T4 Main Security', 'SAFE_AREA', 40.642, -73.777, 'Terminal 4', 4.5, 26, FALSE, TRUE, 'SECURITY', 'SEC', 'Departures', 'T4', 'Main international checkpoint. KCM available on far left.'),
('JFK', 'jfk-coffee-t4', 'Blue Bottle Coffee', 'COFFEE', 40.642, -73.778, 'Terminal 4', 4.7, 44, TRUE, FALSE, 'COFFEE', '☕', 'Departures', 'T4', 'Post-security, high quality coffee.')
ON CONFLICT (key) DO UPDATE SET 
  level = EXCLUDED.level,
  zone = EXCLUDED.zone,
  crew_note = EXCLUDED.crew_note,
  name = EXCLUDED.name,
  type = EXCLUDED.type;
