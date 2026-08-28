// Nigerian State Shipping Zones and Rates

const BASE_SHIPPING_ZONES = [
  // Tier 1: Major Hubs (Lagos & FCT Abuja)
  { state: "Lagos", tier: 1, fee: 2000, estimatedDays: "1 - 2 business days" },
  { state: "FCT (Abuja)", tier: 1, fee: 2500, estimatedDays: "1 - 3 business days" },

  // Tier 2: South West, South South & Major South East
  { state: "Ogun", tier: 2, fee: 3500, estimatedDays: "2 - 4 business days" },
  { state: "Oyo", tier: 2, fee: 3500, estimatedDays: "2 - 4 business days" },
  { state: "Osun", tier: 2, fee: 3500, estimatedDays: "2 - 4 business days" },
  { state: "Ondo", tier: 2, fee: 3500, estimatedDays: "2 - 4 business days" },
  { state: "Ekiti", tier: 2, fee: 3500, estimatedDays: "2 - 4 business days" },
  { state: "Rivers", tier: 2, fee: 3800, estimatedDays: "2 - 4 business days" },
  { state: "Edo", tier: 2, fee: 3500, estimatedDays: "2 - 4 business days" },
  { state: "Delta", tier: 2, fee: 3500, estimatedDays: "2 - 4 business days" },
  { state: "Anambra", tier: 2, fee: 3800, estimatedDays: "2 - 4 business days" },
  { state: "Enugu", tier: 2, fee: 3800, estimatedDays: "2 - 4 business days" },
  { state: "Imo", tier: 2, fee: 3800, estimatedDays: "2 - 4 business days" },
  { state: "Abia", tier: 2, fee: 3800, estimatedDays: "2 - 4 business days" },
  { state: "Akwa Ibom", tier: 2, fee: 3800, estimatedDays: "2 - 5 business days" },
  { state: "Cross River", tier: 2, fee: 3800, estimatedDays: "2 - 5 business days" },

  // Tier 3: North Central, North West, North East & Regional
  { state: "Kano", tier: 3, fee: 4500, estimatedDays: "3 - 6 business days" },
  { state: "Kaduna", tier: 3, fee: 4500, estimatedDays: "3 - 5 business days" },
  { state: "Plateau", tier: 3, fee: 4500, estimatedDays: "3 - 5 business days" },
  { state: "Kwara", tier: 3, fee: 4200, estimatedDays: "2 - 4 business days" },
  { state: "Niger", tier: 3, fee: 4500, estimatedDays: "3 - 5 business days" },
  { state: "Benue", tier: 3, fee: 4500, estimatedDays: "3 - 6 business days" },
  { state: "Kogi", tier: 3, fee: 4200, estimatedDays: "3 - 5 business days" },
  { state: "Nasarawa", tier: 3, fee: 4200, estimatedDays: "3 - 5 business days" },
  { state: "Bauchi", tier: 3, fee: 4800, estimatedDays: "4 - 7 business days" },
  { state: "Gombe", tier: 3, fee: 4800, estimatedDays: "4 - 7 business days" },
  { state: "Adamawa", tier: 3, fee: 4800, estimatedDays: "4 - 7 business days" },
  { state: "Taraba", tier: 3, fee: 4800, estimatedDays: "4 - 7 business days" },
  { state: "Borno", tier: 3, fee: 5200, estimatedDays: "4 - 8 business days" },
  { state: "Yobe", tier: 3, fee: 5200, estimatedDays: "4 - 8 business days" },
  { state: "Jigawa", tier: 3, fee: 4800, estimatedDays: "4 - 7 business days" },
  { state: "Katsina", tier: 3, fee: 4800, estimatedDays: "4 - 7 business days" },
  { state: "Kebbi", tier: 3, fee: 4800, estimatedDays: "4 - 7 business days" },
  { state: "Sokoto", tier: 3, fee: 4800, estimatedDays: "4 - 7 business days" },
  { state: "Zamfara", tier: 3, fee: 4800, estimatedDays: "4 - 7 business days" },
  { state: "Bayelsa", tier: 3, fee: 4200, estimatedDays: "3 - 6 business days" },
  { state: "Ebonyi", tier: 3, fee: 4200, estimatedDays: "3 - 5 business days" }
];

export const SHIPPING_ZONES = BASE_SHIPPING_ZONES.map((zone) => ({
  ...zone,
  fee: zone.state === "Lagos" ? 4800 : zone.state === "FCT (Abuja)" ? 4300 : 7300,
  estimatedDays: zone.state === "Lagos"
    ? "2 - 5 business days"
    : zone.state === "FCT (Abuja)"
      ? "1 - 3 business days"
      : "4 - 7 business days"
}));

export function getZoneByState(stateName) {
  if (!stateName) return null;
  const normalized = stateName.trim().toLowerCase();
  const match = SHIPPING_ZONES.find(
    (z) => z.state.toLowerCase() === normalized || normalized.includes(z.state.toLowerCase())
  );
  return match || { state: stateName, tier: 3, fee: 7300, estimatedDays: "4 - 7 business days" };
}

export function formatNGN(amount) {
  if (typeof amount !== "number" || isNaN(amount)) return "₦0";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0
  }).format(amount);
}
