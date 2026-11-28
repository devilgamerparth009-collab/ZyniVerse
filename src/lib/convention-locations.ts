/**
 * Complete India location list for the conventions browser.
 *
 * The event catalogue only contains organiser-verified conventions, so most of
 * these locations legitimately have zero events. They are still listed so a
 * visitor can select their state/UT and see an explicit "no verified events
 * yet" state instead of wondering whether the filter forgot it.
 */
export const INDIAN_STATES_AND_UTS = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

/** Keep any future organiser-listed location that is not in the canonical list. */
export function allBrowseStates(eventStates: string[]): string[] {
  return [...new Set([...INDIAN_STATES_AND_UTS, ...eventStates])].sort((a, b) => a.localeCompare(b));
}
