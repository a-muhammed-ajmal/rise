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

// `tone` colours each icon with its module's identity colour; the active page
// turns white on the navy pill instead (.nav-active in app/globals.css).
export const navItems = [
  { href: '/',            label: 'Home',        icon: LayoutDashboard, mobile: true,  tone: 'var(--brand-text)' },
  { href: '/productivity',label: 'Tasks',       icon: CheckSquare,     mobile: true,  tone: 'var(--mod-tasks)' },
  { href: '/projects',    label: 'Projects',    icon: FolderOpen,      mobile: false, tone: 'var(--mod-tasks)' },
  { href: '/finance',     label: 'Finance',     icon: DollarSign,      mobile: true,  tone: 'var(--mod-finance)' },
  { href: '/wellness',    label: 'Wellness',    icon: Heart,           mobile: true,  tone: 'var(--mod-wellness)' },
  { href: '/goals',       label: 'Goals',       icon: Target,          mobile: false, tone: 'var(--mod-goals)' },
  { href: '/analytics',   label: 'Analytics',   icon: BarChart2,       mobile: false, tone: 'var(--color-info)' },
  { href: '/knowledge',   label: 'Knowledge',   icon: BookOpen,        mobile: false, tone: 'var(--mod-knowledge)' },
  { href: '/crm',         label: 'CRM',         icon: Users,           mobile: false, tone: 'var(--mod-crm)' },
  { href: '/assistant',   label: 'AI Assistant',icon: RiseLogo,        mobile: false, tone: 'var(--brand-text)' },
  { href: '/settings',    label: 'Settings',    icon: Settings,        mobile: false, tone: 'var(--text-muted)' },
] as const
