#!/usr/bin/env bun
/**
 * Seed script for UTA Notify
 *
 * Cleans out test data and seeds the database with realistic
 * UTA transit incidents, subscribers, messages, and audit logs.
 *
 * Usage:
 *   bun scripts/seed.ts                    # Generate SQL to stdout
 *   bun scripts/seed.ts --file seed.sql    # Write to file
 *   bun scripts/seed.ts --execute          # Execute against remote D1
 *   bun scripts/seed.ts --execute --local  # Execute against local D1
 */

const args = process.argv.slice(2);
const writeToFile = args.includes("--file");
const execute = args.includes("--execute");
const local = args.includes("--local");
const fileName = writeToFile ? (args[args.indexOf("--file") + 1] || "seed.sql") : null;

// ============================================
// ID GENERATION
// ============================================

let counter = 0;
function generateId(prefix: string): string {
  counter++;
  const ts = Date.now().toString(36);
  const seq = counter.toString(36).padStart(4, "0");
  return `${prefix}_${ts}${seq}`;
}

// ============================================
// DATE HELPERS
// ============================================

function daysAgo(days: number, hoursOffset = 0, minutesOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - hoursOffset, d.getMinutes() - minutesOffset);
  return d.toISOString().replace("T", " ").replace("Z", "").split(".")[0];
}

function addMinutes(dateStr: string, minutes: number): string {
  const d = new Date(dateStr.replace(" ", "T") + "Z");
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString().replace("T", " ").replace("Z", "").split(".")[0];
}

function addHours(dateStr: string, hours: number): string {
  return addMinutes(dateStr, hours * 60);
}

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

function json(obj: unknown): string {
  return esc(JSON.stringify(obj));
}

// ============================================
// USERS
// ============================================

const users = {
  admin: { id: "usr_admin", name: "System Administrator" },
  editor: { id: "usr_editor", name: "Sarah Mitchell" },
  operator: { id: "usr_operator", name: "James Rivera" },
  viewer: { id: "usr_viewer", name: "Emily Chen" },
};

// ============================================
// INCIDENT DEFINITIONS
// ============================================

interface IncidentDef {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "draft" | "active" | "updated" | "resolved" | "archived";
  title: string;
  modes: string[];
  routes: string[];
  startDaysAgo: number;
  startHour: number;
  durationMinutes: number;
  publicMessage: string;
  internalNotes: string;
  tags: string[];
  createdBy: string;
  updates?: { content: string; byUser: string; minutesAfterStart: number }[];
}

const incidents: IncidentDef[] = [
  // === ARCHIVED (60-90 days ago) ===
  {
    type: "type_weather",
    severity: "high",
    status: "archived",
    title: "Winter storm causing system-wide delays",
    modes: ["mode_rail", "mode_bus", "mode_ski"],
    routes: ["Red Line", "Blue Line", "Green Line", "FrontRunner", "Route 2", "Route 17", "Route 35"],
    startDaysAgo: 82,
    startHour: 5,
    durationMinutes: 720,
    publicMessage: "Due to heavy snowfall across the Wasatch Front, UTA services are experiencing significant delays. TRAX and FrontRunner services are running 15-30 minutes behind schedule. Several bus routes have been rerouted or suspended. Please allow extra travel time and check rideuta.com for updates.",
    internalNotes: "NWS issued winter storm warning. 8-12 inches expected along the Wasatch Front. Coordinating with UDOT on road conditions. All available snow equipment deployed.",
    tags: '["delay", "weather", "system-wide"]',
    createdBy: users.operator.id,
    updates: [
      { content: "FrontRunner delays increasing to 20-40 minutes due to switch heater issues at Farmington station.", byUser: users.operator.id, minutesAfterStart: 120 },
      { content: "Bus routes 35, 39, and 72 temporarily suspended in Sandy/Draper area due to road conditions.", byUser: users.operator.id, minutesAfterStart: 240 },
      { content: "Storm beginning to clear. Services recovering. FrontRunner back to 10-15 minute delays.", byUser: users.editor.id, minutesAfterStart: 480 },
      { content: "All services returning to normal schedule. Residual delays of 5-10 minutes on some routes.", byUser: users.editor.id, minutesAfterStart: 660 },
    ],
  },
  {
    type: "type_maintenance",
    severity: "low",
    status: "archived",
    title: "Planned weekend track maintenance - Blue Line",
    modes: ["mode_rail"],
    routes: ["Blue Line"],
    startDaysAgo: 75,
    startHour: 22,
    durationMinutes: 1920, // 32 hours (Fri night to Sun morning)
    publicMessage: "Blue Line TRAX service will be suspended between Sandy Civic Center and Draper Town Center stations from Friday 10 PM to Sunday 6 AM for scheduled track maintenance. Free bus bridges will operate between affected stations.",
    internalNotes: "Track replacement between 10200 S and 12300 S. Bus bridge using 3 buses on 15-min headways. Coordinate with Sandy City PD for traffic control.",
    tags: '["maintenance", "planned", "bus-bridge"]',
    createdBy: users.editor.id,
  },
  {
    type: "type_accident",
    severity: "high",
    status: "archived",
    title: "Vehicle collision with TRAX train at 3900 South crossing",
    modes: ["mode_rail"],
    routes: ["Red Line", "Blue Line"],
    startDaysAgo: 68,
    startHour: 16,
    durationMinutes: 180,
    publicMessage: "TRAX Red and Blue Line service is suspended between Millcreek and Murray Central stations due to a vehicle collision at the 3900 South crossing. Bus bridges are being established. No serious injuries reported. Please seek alternate transportation.",
    internalNotes: "Car ran red light at 3900 S crossing. Train 1042 involved. Minor injuries to driver, no passenger injuries. UPD and UTA police on scene. Track inspection required before service can resume.",
    tags: '["accident", "collision", "suspension"]',
    createdBy: users.operator.id,
    updates: [
      { content: "Bus bridge operational between Millcreek and Murray Central. Buses departing every 10 minutes.", byUser: users.operator.id, minutesAfterStart: 35 },
      { content: "Vehicle cleared from tracks. Track inspection underway by maintenance crew.", byUser: users.operator.id, minutesAfterStart: 90 },
      { content: "Track inspection complete. Service resuming with 10-minute delays as trains return to normal positions.", byUser: users.editor.id, minutesAfterStart: 150 },
    ],
  },
  {
    type: "type_delay",
    severity: "medium",
    status: "archived",
    title: "FrontRunner mechanical delay - Ogden to Salt Lake",
    modes: ["mode_rail"],
    routes: ["FrontRunner"],
    startDaysAgo: 63,
    startHour: 7,
    durationMinutes: 90,
    publicMessage: "FrontRunner is experiencing 15-20 minute delays between Ogden and Salt Lake Central due to a mechanical issue with a northbound train. Passengers should expect delays on both northbound and southbound services.",
    internalNotes: "Train 4 reporting brake system warning. Holding at Clearfield for inspection. May need to take out of service. Train 6 can absorb some passengers.",
    tags: '["delay", "mechanical"]',
    createdBy: users.operator.id,
  },

  // === RESOLVED (14-45 days ago) ===
  {
    type: "type_detour",
    severity: "medium",
    status: "resolved",
    title: "Bus routes detoured for State Street construction",
    modes: ["mode_bus"],
    routes: ["Route 200", "Route 209", "Route 213"],
    startDaysAgo: 42,
    startHour: 6,
    durationMinutes: 20160, // 14 days
    publicMessage: "Routes 200, 209, and 213 are detoured between 2100 South and 3300 South on State Street due to road construction. Temporary stops have been placed on Main Street. Please check rideuta.com for updated stop locations.",
    internalNotes: "UDOT State Street Reconstruction Project Phase 2. Expected to last 2 weeks. Temporary stops approved by SLC Transportation. Signage installed at temp stops.",
    tags: '["detour", "construction"]',
    createdBy: users.editor.id,
    updates: [
      { content: "Temporary stop signs installed at all relocated stops. Rider information updated on rideuta.com.", byUser: users.editor.id, minutesAfterStart: 180 },
      { content: "Construction progressing ahead of schedule. Detour may end 2 days early.", byUser: users.operator.id, minutesAfterStart: 14400 },
    ],
  },
  {
    type: "type_security",
    severity: "critical",
    status: "resolved",
    title: "Security incident at Salt Lake Central Station",
    modes: ["mode_rail", "mode_bus"],
    routes: ["Red Line", "Blue Line", "Green Line", "FrontRunner"],
    startDaysAgo: 38,
    startHour: 14,
    durationMinutes: 120,
    publicMessage: "Salt Lake Central Station is temporarily closed due to a police investigation. All TRAX and FrontRunner services are being held or rerouted. Bus routes serving Central Station are using the temporary stop at 200 South. We apologize for the inconvenience.",
    internalNotes: "UTA Police responding to reported suspicious package on platform 2. SLCPD bomb squad en route. Station evacuated. Holding all trains at adjacent stations.",
    tags: '["security", "station-closure", "police"]',
    createdBy: users.operator.id,
    updates: [
      { content: "SLCPD bomb squad on scene. All-clear expected within 1-2 hours. Buses rerouted to 200 S temp stop.", byUser: users.operator.id, minutesAfterStart: 20 },
      { content: "All-clear given by SLCPD. Package determined to be non-threatening. Station reopening.", byUser: users.operator.id, minutesAfterStart: 95 },
      { content: "Station fully reopened. Services resuming normal operations.", byUser: users.editor.id, minutesAfterStart: 110 },
    ],
  },
  {
    type: "type_delay",
    severity: "medium",
    status: "resolved",
    title: "Green Line signal malfunction at West Valley Central",
    modes: ["mode_rail"],
    routes: ["Green Line"],
    startDaysAgo: 31,
    startHour: 9,
    durationMinutes: 150,
    publicMessage: "Green Line TRAX service is experiencing 10-15 minute delays due to a signal malfunction near West Valley Central station. Trains are operating on manual authority through the affected area. Please allow extra travel time.",
    internalNotes: "Signal 42-G showing intermittent failures. Maintainer en route. Trains flagging through on Rule 612. Estimated repair 2 hours.",
    tags: '["delay", "signal", "equipment"]',
    createdBy: users.operator.id,
    updates: [
      { content: "Signal maintainer on site. Identified faulty relay. Replacement part being retrieved from Murray shop.", byUser: users.operator.id, minutesAfterStart: 45 },
      { content: "Relay replaced. Signal testing in progress. Service should resume normal operations within 30 minutes.", byUser: users.operator.id, minutesAfterStart: 120 },
    ],
  },
  {
    type: "type_delay",
    severity: "medium",
    status: "resolved",
    title: "Medical emergency on FrontRunner - Provo Station",
    modes: ["mode_rail"],
    routes: ["FrontRunner"],
    startDaysAgo: 25,
    startHour: 17,
    durationMinutes: 55,
    publicMessage: "FrontRunner service is temporarily delayed at Provo Station due to a medical emergency. Paramedics are on scene. Southbound trains are holding at Orem. Expect 20-30 minute delays.",
    internalNotes: "Passenger medical emergency on Train 8 at Provo. UTA Police and Provo Fire on scene. Patient being transported to Utah Valley Hospital.",
    tags: '["delay", "medical", "emergency"]',
    createdBy: users.operator.id,
    updates: [
      { content: "Patient transported. Train cleared for departure. Residual delays of 15-20 minutes expected for next hour.", byUser: users.operator.id, minutesAfterStart: 40 },
    ],
  },
  {
    type: "type_maintenance",
    severity: "low",
    status: "resolved",
    title: "S-Line Streetcar weekend service adjustment",
    modes: ["mode_streetcar"],
    routes: ["S-Line"],
    startDaysAgo: 21,
    startHour: 21,
    durationMinutes: 2160, // 36 hours
    publicMessage: "S-Line Streetcar service will operate on a modified weekend schedule with 30-minute headways (instead of 20-minute) from Saturday to Sunday evening for overhead wire maintenance.",
    internalNotes: "OCS maintenance on section between Fairmont and 500 East. Running single-track with extended headways. Planned completion by Sunday 9 PM.",
    tags: '["maintenance", "planned", "schedule-change"]',
    createdBy: users.editor.id,
  },
  {
    type: "type_accident",
    severity: "medium",
    status: "resolved",
    title: "Bus Route 17 involved in minor traffic accident",
    modes: ["mode_bus"],
    routes: ["Route 17"],
    startDaysAgo: 18,
    startHour: 11,
    durationMinutes: 75,
    publicMessage: "Route 17 service is temporarily disrupted near 600 North and Redwood Road due to a minor traffic accident involving a UTA bus. No passenger injuries reported. The next bus on the route will be approximately 20 minutes delayed.",
    internalNotes: "Bus 1723 rear-ended at intersection. No passenger injuries. 3 passengers transferred to following bus. SLC PD filing report. Bus driveable but must return to garage for inspection per policy.",
    tags: '["accident", "bus", "minor"]',
    createdBy: users.operator.id,
  },
  {
    type: "type_weather",
    severity: "medium",
    status: "resolved",
    title: "Wind advisory affecting FrontRunner service",
    modes: ["mode_rail"],
    routes: ["FrontRunner"],
    startDaysAgo: 15,
    startHour: 13,
    durationMinutes: 300,
    publicMessage: "FrontRunner service is operating under speed restrictions between Layton and Ogden due to high wind advisory. Expect 10-15 minute delays on all trains. Wind speeds of 50-60 mph reported in Davis and Weber counties.",
    internalNotes: "NWS High Wind Warning for Davis/Weber Co. Wind gusts to 65 mph. Speed restriction of 40 mph between MP 42 and MP 58. Monitor conditions for possible suspension if gusts exceed 70 mph.",
    tags: '["delay", "weather", "wind", "speed-restriction"]',
    createdBy: users.operator.id,
    updates: [
      { content: "Wind gusts peaking at 58 mph. Maintaining speed restrictions. No suspension needed at this time.", byUser: users.operator.id, minutesAfterStart: 120 },
      { content: "Winds subsiding. NWS downgrading to advisory. Speed restrictions being lifted north to south.", byUser: users.operator.id, minutesAfterStart: 240 },
    ],
  },

  // === ACTIVE / RECENT (0-7 days ago) ===
  {
    type: "type_detour",
    severity: "medium",
    status: "active",
    title: "Bus detour on Route 2 for 400 South utility work",
    modes: ["mode_bus"],
    routes: ["Route 2"],
    startDaysAgo: 5,
    startHour: 7,
    durationMinutes: 0, // ongoing
    publicMessage: "Route 2 is detoured between 200 East and 600 East on 400 South due to emergency utility work. Buses are using 500 South as an alternate. Temporary stops are located at 200 East/500 South and 600 East/500 South. Expect 5-10 minute delays.",
    internalNotes: "Dominion Energy emergency gas line repair at 400 S / 400 E. Estimated 5-7 day project. Temp stops approved. Coordinating with SLC for signage.",
    tags: '["detour", "construction", "utility"]',
    createdBy: users.editor.id,
    updates: [
      { content: "Temporary stop signage installed. Route detour information updated on Transit app and rideuta.com.", byUser: users.editor.id, minutesAfterStart: 120 },
      { content: "Dominion Energy reports work is 60% complete. Detour may be lifted in 2-3 days.", byUser: users.operator.id, minutesAfterStart: 4320 },
    ],
  },
  {
    type: "type_delay",
    severity: "medium",
    status: "resolved",
    title: "Red Line delays due to track switch failure at Courthouse",
    modes: ["mode_rail"],
    routes: ["Red Line"],
    startDaysAgo: 3,
    startHour: 8,
    durationMinutes: 95,
    publicMessage: "Red Line TRAX is experiencing 10-15 minute delays due to a track switch issue at Courthouse Station. Trains are single-tracking through the area. Blue and Green Lines are not affected.",
    internalNotes: "Switch 12-R at Courthouse not responding to signals. Trains routed through crossover. Maintainer dispatched from Murray. Issue is likely a frozen switch motor.",
    tags: '["delay", "switch-failure", "single-track"]',
    createdBy: users.operator.id,
    updates: [
      { content: "Switch motor replaced. Testing complete. Resuming normal dual-track operations.", byUser: users.operator.id, minutesAfterStart: 80 },
    ],
  },
  {
    type: "type_delay",
    severity: "low",
    status: "resolved",
    title: "Minor FrontRunner delay due to freight train interference",
    modes: ["mode_rail"],
    routes: ["FrontRunner"],
    startDaysAgo: 2,
    startHour: 6,
    durationMinutes: 35,
    publicMessage: "FrontRunner Train 1 is running approximately 12 minutes late between Ogden and Clearfield due to a freight train ahead on shared trackage. Following trains may experience minor delays.",
    internalNotes: "UP freight 7241 running late through FrontRunner corridor. Dispatching coordinating with UP to clear at Clearfield siding. Should be single occurrence.",
    tags: '["delay", "freight", "minor"]',
    createdBy: users.operator.id,
  },
  {
    type: "type_maintenance",
    severity: "low",
    status: "draft",
    title: "Planned Red Line station platform repairs - March 2026",
    modes: ["mode_rail"],
    routes: ["Red Line"],
    startDaysAgo: -10, // future
    startHour: 22,
    durationMinutes: 2880, // 48 hours
    publicMessage: "Red Line platforms at Ballpark and Central Pointe stations will undergo concrete repairs from March 1-2. Service will not be affected but passengers should exercise caution near work areas. Some platform access points may be restricted.",
    internalNotes: "Annual platform inspection identified spalling concrete at Ballpark and Central Pointe. Weekend repair approved. No service impact - work during overnight/low ridership. Contractor: Staker Parson.",
    tags: '["maintenance", "planned", "station"]',
    createdBy: users.editor.id,
  },
  {
    type: "type_delay",
    severity: "high",
    status: "active",
    title: "Power outage affecting TRAX Blue Line service",
    modes: ["mode_rail"],
    routes: ["Blue Line"],
    startDaysAgo: 0,
    startHour: 2,
    durationMinutes: 0, // ongoing
    publicMessage: "Blue Line TRAX service is suspended between Fashion Place West and Draper Town Center due to a power outage affecting the overhead catenary system. Bus bridges are in operation. Rocky Mountain Power is working to restore power. Updates will be provided as information becomes available.",
    internalNotes: "Substation 7 (Murray) offline. RMP reports transformer failure. ETA for repair unknown. Bus bridge activated with 4 buses. Coordinating with RMP for updates every 30 min.",
    tags: '["delay", "power-outage", "suspension", "bus-bridge"]',
    createdBy: users.operator.id,
    updates: [
      { content: "Bus bridge operational with 4 buses running 10-minute frequency between Fashion Place and Draper.", byUser: users.operator.id, minutesAfterStart: 25 },
      { content: "RMP has identified the issue as a failed transformer at Murray substation. Replacement transformer being transported from depot. Estimated 3-4 hours for repair.", byUser: users.operator.id, minutesAfterStart: 60 },
    ],
  },
];

// ============================================
// SUBSCRIBER DEFINITIONS
// ============================================

const subscriberDefs = [
  { email: "m.thompson@gmail.com", phone: "+18015551234", routes: ["Red Line", "Route 2"], modes: ["mode_rail", "mode_bus"], method: "web_form" },
  { email: "jenny.park@outlook.com", phone: null, routes: ["Blue Line"], modes: ["mode_rail"], method: "web_form" },
  { email: "david.wright@gmail.com", phone: "+18015552345", routes: ["FrontRunner"], modes: ["mode_rail"], method: "web_form" },
  { email: "sarah.j.miller@yahoo.com", phone: null, routes: ["Green Line", "Route 200"], modes: ["mode_rail", "mode_bus"], method: "web_form" },
  { email: "carlos.mendez@hotmail.com", phone: "+18015553456", routes: ["Route 17", "Route 35"], modes: ["mode_bus"], method: "sms_keyword" },
  { email: null, phone: "+18015554567", routes: ["FrontRunner"], modes: ["mode_rail"], method: "sms_keyword" },
  { email: "alice.nguyen@gmail.com", phone: null, routes: ["Red Line", "Blue Line"], modes: ["mode_rail"], method: "web_form" },
  { email: "brandon.lee@protonmail.com", phone: "+18015555678", routes: ["Route 39", "Route 47"], modes: ["mode_bus"], method: "web_form" },
  { email: "rachel.stone@gmail.com", phone: null, routes: ["S-Line"], modes: ["mode_streetcar"], method: "web_form" },
  { email: "mike.andersen@utah.edu", phone: "+18015556789", routes: ["Red Line", "Route 2", "Route 213"], modes: ["mode_rail", "mode_bus"], method: "web_form" },
  { email: "patricia.jones@gmail.com", phone: null, routes: ["FrontRunner", "Route 200"], modes: ["mode_rail", "mode_bus"], method: "web_form" },
  { email: null, phone: "+18015557890", routes: ["Route 2"], modes: ["mode_bus"], method: "sms_keyword" },
  { email: "robert.garcia@outlook.com", phone: "+18015558901", routes: ["Blue Line", "Green Line"], modes: ["mode_rail"], method: "web_form" },
  { email: "lisa.campbell@gmail.com", phone: null, routes: ["FrontRunner"], modes: ["mode_rail"], method: "web_form" },
  { email: "james.wilson@byu.edu", phone: "+18015559012", routes: ["FrontRunner", "Route 830"], modes: ["mode_rail", "mode_bus"], method: "web_form" },
  { email: "amanda.davis@gmail.com", phone: null, routes: ["Red Line"], modes: ["mode_rail"], method: "web_form" },
  { email: "kevin.brown@outlook.com", phone: "+18015550123", routes: ["Route 35", "Route 72"], modes: ["mode_bus"], method: "web_form" },
  { email: "jessica.martinez@gmail.com", phone: null, routes: ["Green Line", "S-Line"], modes: ["mode_rail", "mode_streetcar"], method: "web_form" },
  { email: null, phone: "+18015551357", routes: ["Route 17"], modes: ["mode_bus"], method: "sms_keyword" },
  { email: "chris.taylor@utah.gov", phone: "+18015552468", routes: ["Red Line", "Blue Line", "Green Line", "FrontRunner"], modes: ["mode_rail"], method: "web_form" },
  { email: "natalie.clark@gmail.com", phone: null, routes: ["Route 209", "Route 213"], modes: ["mode_bus"], method: "web_form" },
  { email: "andrew.white@hotmail.com", phone: "+18015553579", routes: ["FrontRunner"], modes: ["mode_rail"], method: "web_form" },
  { email: "stephanie.harris@gmail.com", phone: null, routes: ["Blue Line", "Route 39"], modes: ["mode_rail", "mode_bus"], method: "web_form" },
  { email: "daniel.jackson@outlook.com", phone: "+18015554680", routes: ["Route 2", "Route 200"], modes: ["mode_bus"], method: "web_form" },
  { email: "megan.thomas@gmail.com", phone: null, routes: ["Red Line"], modes: ["mode_rail"], method: "web_form" },
  { email: null, phone: "+18015555791", routes: ["Route 47", "Route 54"], modes: ["mode_bus"], method: "sms_keyword" },
  { email: "ryan.robinson@weber.edu", phone: "+18015556802", routes: ["FrontRunner", "Route 603"], modes: ["mode_rail", "mode_bus"], method: "web_form" },
  { email: "emily.lewis@gmail.com", phone: null, routes: ["Green Line"], modes: ["mode_rail"], method: "web_form" },
  { email: "tyler.walker@gmail.com", phone: "+18015557913", routes: ["Blue Line", "FrontRunner"], modes: ["mode_rail"], method: "web_form" },
  { email: "ashley.young@outlook.com", phone: null, routes: ["S-Line", "Route 209"], modes: ["mode_streetcar", "mode_bus"], method: "web_form" },
  { email: "josh.allen@gmail.com", phone: "+18015558024", routes: ["Route 2", "Route 17"], modes: ["mode_bus"], method: "web_form" },
  { email: "lauren.king@uvu.edu", phone: null, routes: ["FrontRunner"], modes: ["mode_rail"], method: "web_form" },
  { email: null, phone: "+18015559135", routes: ["Red Line", "Route 35"], modes: ["mode_rail", "mode_bus"], method: "sms_keyword" },
  { email: "nick.scott@gmail.com", phone: "+18015550246", routes: ["FrontRunner", "Red Line"], modes: ["mode_rail"], method: "web_form" },
  { email: "heather.adams@gmail.com", phone: null, routes: ["Route 72", "Route 41"], modes: ["mode_bus"], method: "web_form" },
];

// ============================================
// SQL GENERATION
// ============================================

const sql: string[] = [];

function emit(s: string) {
  sql.push(s);
}

// --- CLEANUP ---
emit("-- =============================================");
emit("-- CLEANUP: Remove all user-generated data");
emit("-- =============================================");
emit("");
emit("DELETE FROM subscriber_deliveries;");
emit("DELETE FROM deliveries;");
emit("DELETE FROM messages;");
emit("DELETE FROM incident_updates;");
emit("DELETE FROM incident_versions;");
emit("DELETE FROM incident_attachments;");
emit("DELETE FROM incidents;");
emit("DELETE FROM subscribers;");
emit("DELETE FROM automation_executions;");
emit("DELETE FROM audit_log;");
emit("DELETE FROM sessions;");
emit("");

// --- INCIDENTS ---
emit("-- =============================================");
emit("-- SEED: Incidents");
emit("-- =============================================");
emit("");

let incidentNumber = 1000;

for (const inc of incidents) {
  const id = generateId("inc");
  const num = incidentNumber++;
  const startTime = daysAgo(inc.startDaysAgo, inc.startHour);
  const isResolved = inc.status === "resolved" || inc.status === "archived";
  const isArchived = inc.status === "archived";
  const resolvedAt = isResolved ? addMinutes(startTime, inc.durationMinutes) : null;
  const archivedAt = isArchived ? addHours(resolvedAt!, 168) : null; // archived 7 days after resolution
  const estResolution = inc.durationMinutes > 0 ? addMinutes(startTime, Math.round(inc.durationMinutes * 1.2)) : null;
  const createdAt = addMinutes(startTime, -5); // created 5 min before start
  const updatedAt = resolvedAt || addMinutes(startTime, inc.updates?.length ? inc.updates[inc.updates.length - 1].minutesAfterStart : 0);
  const versionCount = 1 + (inc.updates?.length || 0) + (isResolved ? 1 : 0);

  emit(`INSERT INTO incidents (id, incident_number, incident_type, severity, status, title, affected_modes, affected_routes, start_time, estimated_resolution, actual_resolution, internal_notes, public_message, tags, current_version, created_by, created_at, updated_at, resolved_at, archived_at)`);
  emit(`VALUES ('${id}', ${num}, '${inc.type}', '${inc.severity}', '${inc.status}', '${esc(inc.title)}', '${json(inc.modes)}', '${json(inc.routes)}', '${startTime}', ${estResolution ? `'${estResolution}'` : "NULL"}, ${resolvedAt ? `'${resolvedAt}'` : "NULL"}, '${esc(inc.internalNotes)}', '${esc(inc.publicMessage)}', '${inc.tags}', ${versionCount}, '${inc.createdBy}', '${createdAt}', '${updatedAt}', ${resolvedAt ? `'${resolvedAt}'` : "NULL"}, ${archivedAt ? `'${archivedAt}'` : "NULL"});`);
  emit("");

  // Version 1: creation
  const v1Id = generateId("ver");
  emit(`INSERT INTO incident_versions (id, incident_id, version, snapshot, public_message, changed_by, changed_at, change_reason, change_type)`);
  emit(`VALUES ('${v1Id}', '${id}', 1, '${json({ title: inc.title, severity: inc.severity, status: "active" })}', '${esc(inc.publicMessage)}', '${inc.createdBy}', '${createdAt}', 'Initial report', 'create');`);

  // Updates
  if (inc.updates) {
    for (let i = 0; i < inc.updates.length; i++) {
      const upd = inc.updates[i];
      const updTime = addMinutes(startTime, upd.minutesAfterStart);
      const updId = generateId("upd");
      const verId = generateId("ver");
      const updaterName = Object.values(users).find((u) => u.id === upd.byUser)?.name || "Unknown";

      emit(`INSERT INTO incident_updates (id, incident_id, content, created_by, created_by_name, created_at)`);
      emit(`VALUES ('${updId}', '${id}', '${esc(upd.content)}', '${upd.byUser}', '${esc(updaterName)}', '${updTime}');`);

      emit(`INSERT INTO incident_versions (id, incident_id, version, snapshot, public_message, changed_by, changed_at, change_reason, change_type)`);
      emit(`VALUES ('${verId}', '${id}', ${i + 2}, '${json({ title: inc.title, severity: inc.severity, status: inc.status })}', '${esc(upd.content)}', '${upd.byUser}', '${updTime}', '${esc(upd.content.substring(0, 100))}', 'update');`);
    }
  }

  // Resolution version
  if (isResolved && resolvedAt) {
    const resVerId = generateId("ver");
    emit(`INSERT INTO incident_versions (id, incident_id, version, snapshot, public_message, changed_by, changed_at, change_reason, change_type)`);
    emit(`VALUES ('${resVerId}', '${id}', ${versionCount}, '${json({ title: inc.title, severity: inc.severity, status: "resolved" })}', 'Incident resolved', '${inc.createdBy}', '${resolvedAt}', 'Incident resolved', 'resolve');`);
  }

  // Messages for active/resolved incidents
  if (inc.status !== "draft") {
    const msgId = generateId("msg");
    const msgTime = addMinutes(startTime, 2);
    emit(`INSERT INTO messages (id, incident_id, incident_version, content, created_by, created_at)`);
    emit(`VALUES ('${msgId}', '${id}', 1, '${esc(inc.publicMessage)}', '${inc.createdBy}', '${msgTime}');`);
  }

  // Audit log entries
  const auditCreateId = generateId("aud");
  const creatorName = Object.values(users).find((u) => u.id === inc.createdBy)?.name || "Unknown";
  emit(`INSERT INTO audit_log (id, actor_id, actor_type, actor_name, action, resource_type, resource_id, resource_name, details, created_at)`);
  emit(`VALUES ('${auditCreateId}', '${inc.createdBy}', 'user', '${esc(creatorName)}', 'create', 'incident', '${id}', '${esc(inc.title.substring(0, 100))}', '${json({ severity: inc.severity, type: inc.type })}', '${createdAt}');`);

  if (isResolved && resolvedAt) {
    const auditResolveId = generateId("aud");
    emit(`INSERT INTO audit_log (id, actor_id, actor_type, actor_name, action, resource_type, resource_id, resource_name, details, created_at)`);
    emit(`VALUES ('${auditResolveId}', '${inc.createdBy}', 'user', '${esc(creatorName)}', 'resolve', 'incident', '${id}', '${esc(inc.title.substring(0, 100))}', '${json({ duration_minutes: inc.durationMinutes })}', '${resolvedAt}');`);
  }

  emit("");
}

// --- SUBSCRIBERS ---
emit("-- =============================================");
emit("-- SEED: Subscribers");
emit("-- =============================================");
emit("");

for (let i = 0; i < subscriberDefs.length; i++) {
  const sub = subscriberDefs[i];
  const id = generateId("sub");
  const createdDaysAgo = 30 + Math.floor(i * 2.5); // staggered signups
  const createdAt = daysAgo(createdDaysAgo);
  const status = i < 32 ? "active" : (i < 34 ? "unsubscribed" : "active");
  const unsubAt = status === "unsubscribed" ? daysAgo(5) : null;
  const prefs = json({ routes: sub.routes, modes: sub.modes, severity: ["medium", "high", "critical"], channels: sub.email && sub.phone ? ["email", "sms"] : sub.email ? ["email"] : ["sms"] });

  emit(`INSERT INTO subscribers (id, email, phone, preferences, language, consent_given_at, consent_method, status, unsubscribed_at, created_at, updated_at)`);
  emit(`VALUES ('${id}', ${sub.email ? `'${sub.email}'` : "NULL"}, ${sub.phone ? `'${sub.phone}'` : "NULL"}, '${prefs}', 'en', '${createdAt}', '${sub.method}', '${status}', ${unsubAt ? `'${unsubAt}'` : "NULL"}, '${createdAt}', '${createdAt}');`);
}

emit("");

// --- AUDIT: User logins ---
emit("-- =============================================");
emit("-- SEED: Audit log - login activity");
emit("-- =============================================");
emit("");

const loginPatterns = [
  { user: users.admin, daysAgo: [0, 1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60] },
  { user: users.editor, daysAgo: [0, 1, 3, 4, 7, 8, 12, 15, 20, 28, 35, 50] },
  { user: users.operator, daysAgo: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 21, 28, 42, 56] },
  { user: users.viewer, daysAgo: [1, 5, 12, 25, 40] },
];

for (const pattern of loginPatterns) {
  for (const d of pattern.daysAgo) {
    const loginId = generateId("aud");
    const loginTime = daysAgo(d, 8); // morning logins
    emit(`INSERT INTO audit_log (id, actor_id, actor_type, actor_name, action, resource_type, resource_id, resource_name, created_at)`);
    emit(`VALUES ('${loginId}', '${pattern.user.id}', 'user', '${esc(pattern.user.name)}', 'login', 'user', '${pattern.user.id}', '${esc(pattern.user.name)}', '${loginTime}');`);
  }
}

emit("");
emit("-- Done! Seeded with realistic UTA transit data.");

// ============================================
// OUTPUT
// ============================================

const output = sql.join("\n");

if (writeToFile && fileName) {
  await Bun.write(fileName, output);
  console.log(`Wrote ${sql.length} lines to ${fileName}`);
} else if (execute) {
  const tmpFile = `/tmp/uta-notify-seed-${Date.now()}.sql`;
  await Bun.write(tmpFile, output);
  console.log(`Generated seed SQL (${sql.length} lines)`);
  console.log(`Executing against D1${local ? " (local)" : " (remote)"}...`);
  const proc = Bun.spawn(
    ["npx", "wrangler", "d1", "execute", "uta-notify-db", `--file=${tmpFile}`, ...(local ? ["--local"] : ["--remote"])],
    { cwd: import.meta.dir + "/..", stdout: "inherit", stderr: "inherit" }
  );
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    console.error(`wrangler exited with code ${exitCode}`);
    process.exit(exitCode);
  }
  console.log("Seed complete!");
} else {
  console.log(output);
}
