'use client';

import { useState } from 'react';
import { Plus, Compass } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { createDoc, updateDocById } from '@/lib/firestore';
import { COLLECTIONS, REVIEW_TYPES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Review, ReviewType } from '@/lib/types';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from '@/lib/toast';
import { sanitize } from '@/lib/sanitizer';

function ReviewModal({ open, onClose, review, reviewType, userId }: { open: boolean; onClose: () => void; review: Review | null; reviewType: ReviewType; userId: string; }) {
  const [form, setForm] = useState({ rating: review?.rating ?? 7, wins: review?.wins ?? '', challenges: review?.challenges ?? '', lessons: review?.lessons ?? '', gps: review?.gps ?? '', next: review?.next ?? '', weekStart: review?.weekStartDate ?? new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.wins.trim()) { toast.error('Wins field is required.'); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const data = { userId, reviewType, rating: form.rating, wins: sanitize(form.wins), challenges: sanitize(form.challenges), lessons: sanitize(form.lessons), gps: sanitize(form.gps), next: sanitize(form.next), answers: {}, weekStartDate: reviewType === 'weekly' ? form.weekStart : undefined, updatedAt: now };
      if (review) await updateDocById(COLLECTIONS.REVIEWS, review.id, data);
      else await createDoc(COLLECTIONS.REVIEWS, data);
      toast.success('Review saved.');
      onClose();
    } catch { toast.error('Failed to save review.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`${reviewType.charAt(0).toUpperCase() + reviewType.slice(1)} Review`} footer={<div className="flex gap-3"><Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button><Button fullWidth loading={saving} onClick={handleSave}>Save</Button></div>}>
      <div className="flex flex-col gap-4">
        {reviewType === 'weekly' && <Input label="Week Start" type="date" value={form.weekStart} onChange={(e) => set('weekStart', e.target.value)} />}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-[#F0F0F0]">Rating: {form.rating}/10</label>
          <input type="range" min={1} max={10} value={form.rating} onChange={(e) => set('rating', parseInt(e.target.value))} className="w-full accent-[#FF6B35]" />
        </div>
        <Textarea label="Wins *" value={form.wins} onChange={(e) => set('wins', e.target.value)} rows={3} placeholder="What went well this week?" required />
        <Textarea label="Challenges" value={form.challenges} onChange={(e) => set('challenges', e.target.value)} rows={2} placeholder="What was difficult?" />
        <Textarea label="Lessons" value={form.lessons} onChange={(e) => set('lessons', e.target.value)} rows={2} placeholder="What did you learn?" />
        <Textarea label="GPS (Goal · Plan · System)" value={form.gps} onChange={(e) => set('gps', e.target.value)} rows={3} placeholder="Did you move toward your vision? Follow your plan? Hold your rhythms?" />
        <Textarea label="Next Week Intentions" value={form.next} onChange={(e) => set('next', e.target.value)} rows={2} placeholder="What will you focus on next?" />
      </div>
    </Modal>
  );
}

export default function ReviewsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<ReviewType>('weekly');
  const [modalOpen, setModalOpen] = useState(false);
  const [editReview, setEditReview] = useState<Review | null>(null);

  const { data: reviews, loading } = useCollection<Review>({ userId: user?.uid ?? '', collectionName: COLLECTIONS.REVIEWS, enabled: !!user });
  const filtered = reviews.filter((r) => r.reviewType === tab).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex flex-col min-h-dvh">
      <div className="px-4 pt-4 pb-3 border-b border-[#2A2A2A]">
        <h1 className="text-xl font-bold text-[#F0F0F0] mb-3">Reviews</h1>
        <div className="flex gap-1">
          {REVIEW_TYPES.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn('flex-1 h-8 text-xs font-medium capitalize rounded-chip transition-colors', tab === t ? 'bg-[#FFD700] text-[#0A0A0A]' : 'bg-[#141414] text-[#8A8A8A] border border-[#2A2A2A]')}>{t}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 px-4 py-4 pb-6 flex flex-col gap-3">
        {loading ? <>{[1,2].map((i) => <SkeletonCard key={i} />)}</> :
         filtered.length === 0 ? <EmptyState icon={Compass} title="No reviews yet" subtitle="Start your first review to build self-awareness." actionLabel={`Start ${tab} review`} onAction={() => { setEditReview(null); setModalOpen(true); }} /> :
         filtered.map((r) => (
          <div key={r.id} onClick={() => { setEditReview(r); setModalOpen(true); }} className="bg-[#141414] rounded-card border border-[#2A2A2A] p-4 active:bg-[#1C1C1C] transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-[#F0F0F0]">{r.weekStartDate ?? r.monthYear ?? r.quarter ?? r.year ?? r.createdAt.split('T')[0]}</span>
              <div className="flex">
                {Array.from({ length: 10 }).map((_, i) => (
                  <span key={i} className={cn('text-xs', i < r.rating ? 'text-[#FFD700]' : 'text-[#2A2A2A]')}>★</span>
                ))}
              </div>
            </div>
            <p className="text-xs text-[#8A8A8A] line-clamp-2">{r.wins}</p>
          </div>
         ))
        }
      </div>
      <button onClick={() => { setEditReview(null); setModalOpen(true); }} className="fixed bottom-[80px] right-4 w-14 h-14 bg-[#FFD700] rounded-full flex items-center justify-center shadow-fab active:scale-95 transition-transform sm:hidden z-30"><Plus size={24} className="text-[#0A0A0A]" /></button>
      <ReviewModal open={modalOpen} onClose={() => setModalOpen(false)} review={editReview} reviewType={tab} userId={user?.uid ?? ''} />
    </div>
  );
}
