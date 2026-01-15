/**
 * UTA (Utah Transit Authority) Route Data
 * Source: rideuta.com, transit.wiki
 * Last updated: January 2025
 */

export interface Route {
  id: string;
  name: string;
  type: "bus" | "trax" | "frontrunner" | "streetcar" | "flex" | "express" | "ski";
  region?: string;
}

export const TRANSIT_MODES = [
  { value: "bus", label: "Bus" },
  { value: "trax", label: "TRAX" },
  { value: "frontrunner", label: "FrontRunner" },
  { value: "streetcar", label: "S-Line Streetcar" },
  { value: "flex", label: "Flex Routes" },
  { value: "express", label: "Express/BRT" },
  { value: "paratransit", label: "Paratransit" },
  { value: "ski", label: "Ski Service" },
] as const;

export const UTA_ROUTES: Route[] = [
  // Rail Lines
  { id: "701", name: "TRAX Blue Line", type: "trax" },
  { id: "703", name: "TRAX Red Line", type: "trax" },
  { id: "704", name: "TRAX Green Line", type: "trax" },
  { id: "720", name: "S-Line Streetcar", type: "streetcar" },
  { id: "750", name: "FrontRunner", type: "frontrunner" },

  // Express/BRT Routes
  { id: "603X", name: "Ogden Express (OGX)", type: "express", region: "Weber" },
  { id: "830X", name: "Utah Valley Express (UVX)", type: "express", region: "Utah" },

  // Salt Lake County Bus Routes
  { id: "1", name: "Rose Park / South Temple", type: "bus", region: "Salt Lake" },
  { id: "2", name: "200 South", type: "bus", region: "Salt Lake" },
  { id: "4", name: "400 South / Foothill Dr", type: "bus", region: "Salt Lake" },
  { id: "9", name: "900 South", type: "bus", region: "Salt Lake" },
  { id: "17", name: "1700 South", type: "bus", region: "Salt Lake" },
  { id: "21", name: "2100 South / 2100 East", type: "bus", region: "Salt Lake" },
  { id: "33", name: "3300 South", type: "bus", region: "Salt Lake" },
  { id: "35", name: "3500 South", type: "bus", region: "Salt Lake" },
  { id: "39", name: "3900 South", type: "bus", region: "Salt Lake" },
  { id: "45", name: "4500 South", type: "bus", region: "Salt Lake" },
  { id: "47", name: "4700 South", type: "bus", region: "Salt Lake" },
  { id: "54", name: "5400 South", type: "bus", region: "Salt Lake" },
  { id: "62", name: "6200 South", type: "bus", region: "Salt Lake" },
  { id: "72", name: "7200 South", type: "bus", region: "Salt Lake" },
  { id: "126", name: "12600 South", type: "bus", region: "Salt Lake" },
  { id: "200", name: "State Street North", type: "bus", region: "Salt Lake" },
  { id: "201", name: "State Street South", type: "bus", region: "Salt Lake" },
  { id: "205", name: "500 East", type: "bus", region: "Salt Lake" },
  { id: "209", name: "900 East", type: "bus", region: "Salt Lake" },
  { id: "213", name: "1300 East", type: "bus", region: "Salt Lake" },
  { id: "217", name: "Redwood Road", type: "bus", region: "Salt Lake" },
  { id: "218", name: "South Jordan", type: "bus", region: "Salt Lake" },
  { id: "219", name: "South Redwood Road", type: "bus", region: "Salt Lake" },
  { id: "220", name: "Highland Drive / 1300 East", type: "bus", region: "Salt Lake" },
  { id: "223", name: "2300 East / Holladay Blvd", type: "bus", region: "Salt Lake" },
  { id: "227", name: "2700 West", type: "bus", region: "Salt Lake" },
  { id: "240", name: "4000 West / Dixie Valley", type: "bus", region: "Salt Lake" },
  { id: "248", name: "4800 West", type: "bus", region: "Salt Lake" },
  { id: "509", name: "900 W Shuttle", type: "bus", region: "Salt Lake" },
  { id: "513", name: "Industrial Business Park Shuttle", type: "bus", region: "Salt Lake" },
  { id: "551", name: "International Center", type: "bus", region: "Salt Lake" },

  // Intercounty Routes
  { id: "417", name: "Salt Lake - Tooele", type: "bus", region: "Intercounty" },
  { id: "451", name: "Tooele Fast Bus", type: "bus", region: "Tooele" },
  { id: "455", name: "U of U / Davis County / WSU", type: "bus", region: "Intercounty" },
  { id: "470", name: "Ogden - Salt Lake Intercity", type: "bus", region: "Intercounty" },
  { id: "472", name: "Riverdale - Salt Lake Express", type: "bus", region: "Intercounty" },
  { id: "473", name: "SLC - Ogden Hwy 89 Express", type: "bus", region: "Intercounty" },

  // Weber County Routes
  { id: "601", name: "Ogden Trolley", type: "bus", region: "Weber" },
  { id: "602", name: "Wildcat Shuttle", type: "bus", region: "Weber" },
  { id: "604", name: "West Ogden", type: "bus", region: "Weber" },
  { id: "612", name: "Washington Blvd", type: "bus", region: "Weber" },
  { id: "613", name: "Weber Industrial Park", type: "bus", region: "Weber" },
  { id: "625", name: "ATC / Harrison Blvd / WSU", type: "bus", region: "Weber" },
  { id: "626", name: "West Roy - Clearfield Station", type: "bus", region: "Weber" },
  { id: "627", name: "Clearfield Station / Kaysville / DTC", type: "bus", region: "Davis" },
  { id: "628", name: "Layton Westside", type: "bus", region: "Davis" },
  { id: "630", name: "Brigham City / Ogden Commuter", type: "bus", region: "Box Elder" },
  { id: "640", name: "Layton Hills Mall / WSU Ogden Camp", type: "bus", region: "Davis" },
  { id: "645", name: "Monroe Blvd", type: "bus", region: "Davis" },
  { id: "667", name: "Lagoon / Station Park Shuttle", type: "bus", region: "Davis" },

  // Utah County Routes
  { id: "805", name: "Orem 800 North", type: "bus", region: "Utah" },
  { id: "806", name: "State Street Orem", type: "bus", region: "Utah" },
  { id: "807", name: "Geneva Road", type: "bus", region: "Utah" },
  { id: "821", name: "Provo / Orem BRT", type: "bus", region: "Utah" },
  { id: "822", name: "800 North / State Street", type: "bus", region: "Utah" },
  { id: "823", name: "University Ave / Orem Center St", type: "bus", region: "Utah" },
  { id: "831", name: "Spanish Fork / Provo", type: "bus", region: "Utah" },
  { id: "833", name: "Lehi / American Fork", type: "bus", region: "Utah" },
  { id: "834", name: "Eagle Mountain / Lehi", type: "bus", region: "Utah" },
  { id: "850", name: "American Fork / Pleasant Grove", type: "bus", region: "Utah" },
  { id: "862", name: "Springville / Spanish Fork", type: "bus", region: "Utah" },
  { id: "871", name: "Payson / Salem / Spanish Fork", type: "bus", region: "Utah" },

  // Flex Routes
  { id: "F11", name: "11th Avenue Flex", type: "flex", region: "Salt Lake" },
  { id: "F94", name: "Sandy Flex", type: "flex", region: "Salt Lake" },
  { id: "F202", name: "Bingham Junction Flex", type: "flex", region: "Salt Lake" },
  { id: "F232", name: "3200 West Flex", type: "flex", region: "Salt Lake" },
  { id: "F453", name: "Tooele - SLC Flex", type: "flex", region: "Tooele" },
  { id: "F514", name: "Jordan Gateway Flex", type: "flex", region: "Salt Lake" },
  { id: "F525", name: "Midvale Flex", type: "flex", region: "Salt Lake" },
  { id: "F556", name: "5600 West Flex", type: "flex", region: "Salt Lake" },
  { id: "F570", name: "7000 South Flex", type: "flex", region: "Salt Lake" },
  { id: "F578", name: "7800 South Flex", type: "flex", region: "Salt Lake" },
  { id: "F590", name: "9000 South Flex", type: "flex", region: "Salt Lake" },
  { id: "F618", name: "Ogden BDO Flex", type: "flex", region: "Weber" },
  { id: "F620", name: "West Haven Flex", type: "flex", region: "Weber" },
  { id: "F638", name: "Brigham City Flex", type: "flex", region: "Box Elder" },

  // Ski Service Routes
  { id: "674", name: "Powder Mountain", type: "ski", region: "Weber" },
  { id: "675", name: "Snowbasin / Ogden", type: "ski", region: "Weber" },
  { id: "677", name: "Snowbasin / Layton", type: "ski", region: "Davis" },
  { id: "880", name: "Sundance / Provo", type: "ski", region: "Utah" },
  { id: "953", name: "Park City / SLC", type: "ski", region: "Summit" },
  { id: "972", name: "Brighton / Solitude / Midvale", type: "ski", region: "Salt Lake" },
  { id: "994", name: "Alta / Snowbird / Sandy", type: "ski", region: "Salt Lake" },
];

// Helper functions
export function getRoutesByType(type: Route["type"]): Route[] {
  return UTA_ROUTES.filter((route) => route.type === type);
}

export function getRoutesByRegion(region: string): Route[] {
  return UTA_ROUTES.filter((route) => route.region === region);
}

export function getRouteById(id: string): Route | undefined {
  return UTA_ROUTES.find((route) => route.id === id);
}

export function searchRoutes(query: string): Route[] {
  const lowerQuery = query.toLowerCase();
  return UTA_ROUTES.filter(
    (route) =>
      route.id.toLowerCase().includes(lowerQuery) ||
      route.name.toLowerCase().includes(lowerQuery)
  );
}

// Get unique regions
export const REGIONS = [
  "Salt Lake",
  "Utah",
  "Davis",
  "Weber",
  "Tooele",
  "Box Elder",
  "Summit",
  "Intercounty",
] as const;

// Route type labels for display
export const ROUTE_TYPE_LABELS: Record<Route["type"], string> = {
  bus: "Bus",
  trax: "TRAX Light Rail",
  frontrunner: "FrontRunner Commuter Rail",
  streetcar: "S-Line Streetcar",
  flex: "Flex Route",
  express: "Express / BRT",
  ski: "Ski Service",
};
