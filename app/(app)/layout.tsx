import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Topbar } from '@/components/layout/topbar'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { SWUpdateToast } from '@/components/pwa/sw-update-toast'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const meta = user.user_metadata ?? {}
  const fullName = (meta.full_name as string | undefined) ?? undefined
  const avatarUrl = (meta.avatar_url as string | undefined) ?? undefined

  return (
    <>
      <div className="flex h-dvh overflow-hidden">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar email={user.email} fullName={fullName} avatarUrl={avatarUrl} />

          <main className="flex-1 overflow-y-auto pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0 graph-bg">
            {children}
          </main>

          <BottomNav />
        </div>
      </div>
      <InstallPrompt />
      <SWUpdateToast />
    </>
  )
}
