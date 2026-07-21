import {
  LayoutDashboard,
  CheckSquare,
  FolderOpen,
  Target,
  DollarSign,
  Heart,
  BookOpen,
  Users,
  Settings,
  BarChart2,
} from 'lucide-react'
import { RiseLogo } from '@/components/brand/rise-logo'

export const navItems = [
  { href: '/',            label: 'Home',        icon: LayoutDashboard, mobile: true  },
  { href: '/productivity',label: 'Tasks',       icon: CheckSquare,     mobile: true  },
  { href: '/projects',    label: 'Projects',    icon: FolderOpen,      mobile: false },
  { href: '/finance',     label: 'Finance',     icon: DollarSign,      mobile: true  },
  { href: '/wellness',    label: 'Wellness',    icon: Heart,           mobile: true  },
  { href: '/goals',       label: 'Goals',       icon: Target,          mobile: false },
  { href: '/analytics',   label: 'Analytics',   icon: BarChart2,       mobile: false },
  { href: '/knowledge',   label: 'Knowledge',   icon: BookOpen,        mobile: false },
  { href: '/crm',         label: 'CRM',         icon: Users,           mobile: false },
  { href: '/assistant',   label: 'AI Assistant',icon: RiseLogo,        mobile: false },
  { href: '/settings',    label: 'Settings',    icon: Settings,        mobile: false },
] as const
