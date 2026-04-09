'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { createDoc, setDocById, setUserMeta } from '@/lib/firestore';
import { COLLECTIONS, DEFAULT_REALM_OPTIONS } from '@/lib/constants';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { sanitize } from '@/lib/sanitizer';
import { ToastContainer } from '@/components/ui/ToastContainer';

// ─── STEP INDICATOR ──────────────────────────────────────────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all ${
            i < current ? 'w-8 bg-[#FF6B35]' : i === current ? 'w-8 bg-[#FF6B35]' : 'w-4 bg-[#2A2A2A]'
          }`}
        />
      ))}
    </div>
  );
}

// ─── ONBOARDING PAGE ─────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selectedRealms, setSelectedRealms] = useState<string[]>([]);
  const [customRealm, setCustomRealm] = useState('');
  const [targetTitle, setTargetTitle] = useState('');
  const [targetRealm, setTargetRealm] = useState('');
  const [targetDueDate, setTargetDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Redirect if already onboarded
  useEffect(() => {
    if (!user) router.replace('/login');
  }, [user, router]);

  const toggleRealm = (realm: string) => {
    setSelectedRealms((prev) =>
      prev.includes(realm) ? prev.filter((r) => r !== realm) : [...prev, realm]
    );
  };

  const addCustomRealm = () => {
    const clean = sanitize(customRealm, 50);
    if (!clean) return;
    if (!selectedRealms.includes(clean)) {
      setSelectedRealms((prev) => [...prev, clean]);
    }
    setCustomRealm('');
  };

  const handleStep1 = () => setStep(1);

  const handleStep2 = () => {
    if (selectedRealms.length === 0) {
      toast.error('Select at least one Realm to continue.');
      return;
    }
    if (!targetRealm && selectedRealms.length > 0) {
      setTargetRealm(selectedRealms[0]);
    }
    setStep(2);
  };

  const handleFinish = async () => {
    if (!targetTitle.trim()) {
      toast.error('Please enter a Target title.');
      return;
    }
    if (!user) return;
    setSaving(true);

    try {
      // Save Realms as projects with a special marker
      for (const realm of selectedRealms) {
        await createDoc(COLLECTIONS.PROJECTS, {
          userId: user.uid,
          title: realm,
          realm,
          color: '#FF6B35',
          icon: '🎯',
          order: selectedRealms.indexOf(realm),
          isFavorite: false,
        });
      }

      // Save first Target
      await createDoc(COLLECTIONS.PROJECTS, {
        userId: user.uid,
        title: sanitize(targetTitle, 100),
        realm: targetRealm || selectedRealms[0],
        color: '#FF6B35',
        icon: '🎯',
        order: 0,
        isFavorite: false,
        dueDate: targetDueDate || undefined,
      });

      // Mark onboarding complete
      const now = new Date().toISOString();
      await setUserMeta(user.uid, {
        onboardingComplete: true,
        createdAt: now,
        lastLoginAt: now,
        displayName: user.displayName ?? undefined,
      });

      const firstName = user.displayName?.split(' ')[0] ?? 'there';
      toast.success(`RISE is ready. Let's go, ${firstName}.`);
      router.replace('/');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#0A0A0A] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm flex flex-col gap-6">
        {/* Progress */}
        <div className="flex flex-col gap-3">
          <StepIndicator current={step} total={3} />
          <p className="text-xs text-[#8A8A8A]">Step {step + 1} of 3</p>
        </div>

        {/* ─── STEP 0: WELCOME ─── */}
        {step === 0 && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <div>
              <h1 className="text-2xl font-bold text-[#F0F0F0]">Welcome to RISE</h1>
              <p className="text-sm text-[#8A8A8A] mt-2">
                Your personal operating system starts here.
              </p>
            </div>
            <div className="bg-[#141414] rounded-card p-4 border border-[#2A2A2A]">
              <p className="text-sm text-[#8A8A8A] leading-relaxed">
                We&apos;ll set up three things to get you started — your life areas, your first
                target, and you&apos;ll be ready to track what matters most.
              </p>
            </div>
            <Button onClick={handleStep1} size="lg" fullWidth>
              Let&apos;s Begin →
            </Button>
          </div>
        )}

        {/* ─── STEP 1: REALMS ─── */}
        {step === 1 && (
          <div className="flex flex-col gap-5 animate-fade-in">
            <div>
              <h1 className="text-2xl font-bold text-[#F0F0F0]">Choose Your Life Realms</h1>
              <p className="text-sm text-[#8A8A8A] mt-2">
                Select the areas of life you want to track. You can add more later.
              </p>
            </div>

            {/* Preset options */}
            <div className="flex flex-wrap gap-2">
              {DEFAULT_REALM_OPTIONS.map((realm) => {
                const selected = selectedRealms.includes(realm);
                return (
                  <button
                    key={realm}
                    onClick={() => toggleRealm(realm)}
                    className={`h-10 px-4 rounded-chip text-sm font-medium transition-all border ${
                      selected
                        ? 'bg-[#FF6B35]/15 border-[#FF6B35] text-[#FF6B35]'
                        : 'bg-[#141414] border-[#2A2A2A] text-[#8A8A8A]'
                    }`}
                  >
                    {selected && <Check size={12} className="inline mr-1" />}
                    {realm}
                  </button>
                );
              })}
            </div>

            {/* Custom realm */}
            <div className="flex gap-2">
              <Input
                placeholder="Add custom realm..."
                value={customRealm}
                onChange={(e) => setCustomRealm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomRealm()}
                className="flex-1"
              />
              <button
                onClick={addCustomRealm}
                className="w-10 h-10 rounded-input bg-[#1C1C1C] border border-[#2A2A2A] flex items-center justify-center text-[#8A8A8A] hover:text-[#F0F0F0] mt-0"
              >
                <Plus size={18} />
              </button>
            </div>

            {/* Show custom added */}
            {selectedRealms.filter((r) => !DEFAULT_REALM_OPTIONS.includes(r as typeof DEFAULT_REALM_OPTIONS[number])).map((r) => (
              <div key={r} className="flex items-center gap-2">
                <span className="text-sm text-[#FF6B35]">{r}</span>
                <button onClick={() => setSelectedRealms((prev) => prev.filter((x) => x !== r))}>
                  <X size={12} className="text-[#8A8A8A]" />
                </button>
              </div>
            ))}

            {selectedRealms.length > 0 && (
              <p className="text-xs text-[#8A8A8A]">
                {selectedRealms.length} realm{selectedRealms.length > 1 ? 's' : ''} selected
              </p>
            )}

            <Button
              onClick={handleStep2}
              size="lg"
              fullWidth
              disabled={selectedRealms.length === 0}
            >
              Next →
            </Button>
          </div>
        )}

        {/* ─── STEP 2: FIRST TARGET ─── */}
        {step === 2 && (
          <div className="flex flex-col gap-5 animate-fade-in">
            <div>
              <h1 className="text-2xl font-bold text-[#F0F0F0]">What&apos;s your first big target?</h1>
              <p className="text-sm text-[#8A8A8A] mt-2">
                A Target is an outcome you want to achieve inside a Realm.
              </p>
            </div>

            <Input
              label="Target Title"
              placeholder="e.g. Launch my business by Q3"
              value={targetTitle}
              onChange={(e) => setTargetTitle(e.target.value)}
              required
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#F0F0F0]">
                Realm <span className="text-[#FF4F6D]">*</span>
              </label>
              <select
                value={targetRealm || selectedRealms[0]}
                onChange={(e) => setTargetRealm(e.target.value)}
                className="w-full bg-[#1C1C1C] border border-[#2A2A2A] rounded-input px-3 py-2.5 text-sm text-[#F0F0F0] outline-none focus:border-[#FF6B35]"
              >
                {selectedRealms.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <Input
              label="Due Date (optional)"
              type="date"
              value={targetDueDate}
              onChange={(e) => setTargetDueDate(e.target.value)}
            />

            <Button
              onClick={handleFinish}
              size="lg"
              fullWidth
              loading={saving}
            >
              Set My Target →
            </Button>
          </div>
        )}
      </div>

      <ToastContainer />
    </div>
  );
}
