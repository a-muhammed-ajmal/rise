import {
  LayoutDashboard,
  CheckSquare,
  Target,
  DollarSign,
  Heart,
  BookOpen,
  Users,
  Sparkles,
  Settings,
} from 'lucide-react'

export const navItems = [
  { href: '/',            label: 'Home',        icon: LayoutDashboard, mobile: true  },
  { href: '/productivity',label: 'Tasks',       icon: CheckSquare,     mobile: true  },
  { href: '/finance',     label: 'Finance',     icon: DollarSign,      mobile: true  },
  { href: '/wellness',    label: 'Wellness',    icon: Heart,           mobile: true  },
  { href: '/goals',       label: 'Goals',       icon: Target,          mobile: false },
  { href: '/knowledge',   label: 'Knowledge',   icon: BookOpen,        mobile: false },
  { href: '/crm',         label: 'CRM',         icon: Users,           mobile: false },
  { href: '/assistant',   label: 'AI Assistant',icon: Sparkles,        mobile: false },
  { href: '/settings',    label: 'Settings',    icon: Settings,        mobile: false },
] as const
