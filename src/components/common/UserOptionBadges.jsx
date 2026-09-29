// Role + location pills for a user option in a dropdown.
//
// `/User/UserDropDown` returns `roleName` and `locationName` on every user, so
// every user picker in the app can show who the person is without the caller
// building its own label string.
//
// Pass this through `SelectItem`'s `meta` prop, never as its children: children
// go inside Radix's `ItemText`, which is what the closed trigger renders, and
// triggers here are 170-260px wide. `meta` sits outside `ItemText` and on its
// own line under the name, so the list row carries the badges and the trigger
// keeps showing the plain name.

import { normalizeRoleName } from '@/lib/salesRoles';

export const getUserRoleName = (user) =>
  String(user?.roleName ?? user?.RoleName ?? user?.role ?? user?.Role ?? '').trim();

export const getUserLocationName = (user) =>
  String(user?.locationName ?? user?.LocationName ?? user?.location ?? user?.Location ?? '').trim();

// One tint per role family rather than per role: an admin should stand out from
// the people work is normally assigned to, and sales/service read as two lists.
const ROLE_TINTS = [
  {
    match: (role) => role.includes('admin'),
    className:
      'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
  },
  {
    match: (role) => role.startsWith('sales'),
    className:
      'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30',
  },
  {
    match: (role) => role.startsWith('service'),
    className:
      'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30',
  },
];

const FALLBACK_ROLE_TINT =
  'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/30';

// One color per location, from the supplied brand palette, so a list of people
// from mixed offices can be read at a glance.
//
// Solid fills rather than the soft tints the role badge uses: these are brand
// colors, and at 9px a filled chip is what separates KOL from HYD from DEL
// across a scrolling list. The foreground is set per color rather than always
// white - #FFCE1B is far too light to carry it.
//
// Applied as inline styles, not classes: the palette is outside the Tailwind
// scale, and the same values then hold in dark mode without a second set.
const LOCATION_COLORS = {
  hyd: { backgroundColor: '#7c3aed', color: '#FFFFFF' },
  del: { backgroundColor: '#8B5CF6', color: '#FFFFFF' },
  kol: { backgroundColor: '#10B981', color: '#ffffff' },
  // '#7c3aed', '#10B981', '#8B5CF6'
};

// A location that is not in the map above still gets a color rather than a
// shared grey, picked by hashing the name so it stays the same everywhere in the
// app and survives a page reload. Opening a new office needs no code change -
// add it to the map only to pin a specific color.
const FALLBACK_LOCATION_COLORS = [
  { backgroundColor: '#B7410E', color: '#FFFFFF' },
  { backgroundColor: '#069494', color: '#FFFFFF' },
  { backgroundColor: '#BE5103', color: '#FFFFFF' },
  { backgroundColor: '#FFCE1B', color: '#3B2A00' },
];

const hashLocationName = (value) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
};

const getLocationColors = (locationName) => {
  const key = String(locationName || '').trim().toLowerCase();
  if (!key) return FALLBACK_LOCATION_COLORS[0];

  return (
    LOCATION_COLORS[key]
    || FALLBACK_LOCATION_COLORS[hashLocationName(key) % FALLBACK_LOCATION_COLORS.length]
  );
};

const getRoleTint = (roleName) => {
  const role = normalizeRoleName(roleName);
  return ROLE_TINTS.find((tint) => tint.match(role))?.className || FALLBACK_ROLE_TINT;
};

// Deliberately smaller than the option label - this is the second line under the
// name, so it has to read as secondary rather than compete with it.
// Layout only. The role badge adds a ring on top of its tint; the location badge
// is a solid fill and needs none - leaving `ring-1` in here would paint the
// default ring color around it.
const BADGE_BASE =
  'inline-flex shrink-0 items-center rounded px-1 text-[9px] font-semibold uppercase leading-[14px] tracking-wide';

export const UserRoleBadge = ({ user, roleName }) => {
  const role = roleName ?? getUserRoleName(user);
  if (!role) return null;

  return <span className={`${BADGE_BASE} ring-1 ring-inset ${getRoleTint(role)}`}>{role}</span>;
};

export const UserLocationBadge = ({ user, locationName }) => {
  const location = locationName ?? getUserLocationName(user);
  if (!location) return null;

  return (
    <span className={BADGE_BASE} style={getLocationColors(location)}>
      {location}
    </span>
  );
};

// Renders nothing when the user carries neither field, so a payload that has
// not been enriched yet (or a non-user option) leaves the row exactly as it was.
const UserOptionBadges = ({ user, roleName, locationName, className = '' }) => {
  const role = roleName ?? getUserRoleName(user);
  const location = locationName ?? getUserLocationName(user);

  if (!role && !location) return null;

  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      <UserRoleBadge roleName={role} />
      <UserLocationBadge locationName={location} />
    </span>
  );
};

// Extra haystack for a dropdown's search box, so typing "HYD" or "manager"
// narrows the list the same way typing a name does.
export const getUserBadgeSearchText = (user) =>
  `${getUserRoleName(user)} ${getUserLocationName(user)}`.toLowerCase();

export default UserOptionBadges;
