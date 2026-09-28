import PropTypes from 'prop-types';
import {
  Home,
  LayoutDashboard,
  Target,
  Users,
  ShoppingCart,
  CreditCard,
  Package,
  Ticket,
  LifeBuoy,
  BarChart2,
  Calendar,
  Clock,
  PhoneCall,
  Key,
  Activity,
  Settings,
  User,
  Folder,
  FileText,
  Type,
  Palette,
  Feather as FeatherIconLucide,
  ShieldCheck,
  UserPlus,
  List,
  HelpCircle,
  Layers,
  Circle,
  Contact,
  ClipboardCheck,
  Boxes,
  BookOpenCheck,
  Database,
  SlidersHorizontal,
  Waypoints
} from 'lucide-react';

// -----------------------|| NAV ICON ||-----------------------//

const LUCIDE_ICON_MAP = {
  // CRM Core Menu Icons
  dashboard: LayoutDashboard,
  'layout-dashboard': LayoutDashboard,
  leads: Target,
  target: Target,
  customers: Users,
  users: Users,
  orders: ShoppingCart,
  'shopping-cart': ShoppingCart,
  payments: CreditCard,
  'credit-card': CreditCard,
  products: Package,
  package: Package,
  tickets: Ticket,
  ticket: Ticket,
  'life-buoy': LifeBuoy,
  reports: BarChart2,
  'bar-chart-2': BarChart2,
  'lead-scheduler': Calendar,
  calendar: Calendar,
  attendance: ClipboardCheck,
  clock: Clock,
  'bk-leads': PhoneCall,
  'phone-call': PhoneCall,
  'lead-access': Key,
  key: Key,
  settings: Settings,
  'system-logs': Activity,
  activity: Activity,
  'my-profile': User,
  user: User,
  folder: Folder,
  file: FileText,

  // DashboardKit legacy/ui icons
  home: Home,
  text_fields: Type,
  color_lens: Palette,
  history_edu: FeatherIconLucide,
  verified_user: ShieldCheck,
  person_add_alt_1: UserPlus,
  list_alt: List,
  help_outline: HelpCircle,
  sample: FileText,
  layers: Layers,
  contact: Contact,
  inventory: Boxes,
  permissions: BookOpenCheck,
  database: Database,
  gateway: Waypoints,
  configuration: SlidersHorizontal
};

const ICON_COLOR_MAP = {
  dashboard: '#38bdf8',
  'layout-dashboard': '#38bdf8',
  tickets: '#fb7185',
  ticket: '#fb7185',
  customers: '#34d399',
  users: '#34d399',
  reports: '#818cf8',
  'bar-chart-2': '#818cf8',
  orders: '#34d399',
  'shopping-cart': '#34d399',
  payments: '#84cc16',
  'credit-card': '#84cc16',
  products: '#f59e0b',
  package: '#f59e0b',
  leads: '#fbbf24',
  target: '#fbbf24',
  'bk-leads': '#fbbf24',
  'phone-call': '#fbbf24',
  'lead-access': '#fbbf24',
  key: '#fbbf24',
  attendance: '#8b5cf6',
  clock: '#8b5cf6',
  settings: '#64748b',
  configuration: '#64748b',
  'system-logs': '#06b6d4',
  activity: '#06b6d4',
  inventory: '#f59e0b',
  gateway: '#0ea5e9',
  database: '#0ea5e9',
  'my-profile': '#60a5fa',
  user: '#60a5fa'
};

export default function NavIcon({ items }) {
  if (!items) {
    return null;
  }

  const iconKey = (items.iconname || items.icon || '').toLowerCase();
  const IconComponent = LUCIDE_ICON_MAP[iconKey] || Folder;
  const iconColor = ICON_COLOR_MAP[iconKey] || '#64748b';

  return (
    <span
      className="pc-micon"
      style={{ '--nav-icon-color': iconColor }}
      aria-hidden="true"
    >
      {items.iconname || items.icon ? <IconComponent /> : <Circle className="pc-submenu-dot" />}
    </span>
  );
}

NavIcon.propTypes = { items: PropTypes.any };
