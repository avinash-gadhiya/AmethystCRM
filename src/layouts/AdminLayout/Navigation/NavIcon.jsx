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
  Circle
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
  attendance: Clock,
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
  layers: Layers
};

export default function NavIcon({ items }) {
  if (!items) {
    return null;
  }

  const iconKey = (items.iconname || items.icon || '').toLowerCase();
  const IconComponent = LUCIDE_ICON_MAP[iconKey] || LUCIDE_ICON_MAP[items.iconname] || null;

  return (
    <span className="pc-micon d-inline-flex align-items-center justify-content-center me-2">
      {IconComponent ? (
        <IconComponent size={18} />
      ) : items.iconname ? (
        <Folder size={18} />
      ) : (
        <Circle size={6} />
      )}
    </span>
  );
}

NavIcon.propTypes = { items: PropTypes.any };
