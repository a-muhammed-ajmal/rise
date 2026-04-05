'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCollection, addDocument, updateDocument, deleteDocument } from '@/lib/firestore';
import { Review } from '@/lib/types';
import dynamic from 'next/dynamic';
const Modal = dynamic(() => import('@/components/ui/Modal'), { ssr: false });
import Button from '@/components/ui/Button';
import { Input, TextArea } from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';
import { cn, formatDate } from '@/lib/utils';
import { Plus, BookOpen, Trash2, Star, Edit2, Compass, ArrowRight } from 'lucide-react';
import { format, startOfWeek } from 'date-fns';

function getCurrentMonday(): string {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

export default function ReviewsPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: reviews, loading } = useCollection<Review>('reviews', uid);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [weekStartDate, setWeekStartDate] = useState(getCurrentMonday());
  const [rating, setRating] = useState(3);
  const [wins, setWins] = useState('');
  const [challenges, setChallenges] = useState('');
  const [lessons, setLessons] = useState('');
  const [gps, setGps] = useState('');
  const [next, setNext] = useState('');

  const sortedReviews = useMemo(
    () => [...reviews].sort((a, b) => (b.weekStartDate || '').localeCompare(a.weekStartDate || '')),
    [reviews],
  );

  const resetForm = () => {
    setWeekStartDate(getCurrentMonday());
    setRating(3);
    setWins('');
    setChallenges('');
    setLessons('');
    setGps('');
    setNext('');
    setEditingReview(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (r: Review) => {
    setEditingReview(r);
    setWeekStartDate(r.weekStartDate || '');
    setRating(r.rating);
    setWins(r.wins);
    setChallenges(r.challenges || '');
    setLessons(r.lessons || '');
    setGps(r.gps || '');
    setNext(r.next || '');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!wins.trim() || !user) return;
    const data = { weekStartDate, rating, wins, challenges, lessons, gps, next } as Partial<Review>;

    if (editingReview) {
      await updateDocument('reviews', editingReview.id, data);
    } else {
      await addDocument('reviews', data, user.uid);
    }

    resetForm();
    setModalOpen(false);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingReview(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteDocument('reviews', deleteConfirmId);
    setDeleteConfirmId(null);
  };

  return (
    <div className="px-4 py-6 lg:px-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-text">Weekly Reviews</h1>
        <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2.5 bg-rise text-[#0A0A0F] rounded-xl text-sm font-semibold shadow-sm">
          <Plus size={18} /> New Review
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-32 rounded-2xl bg-surface-2 animate-pulse" />)}</div>
      ) : reviews.length === 0 ? (
        <EmptyState icon={BookOpen} title="No reviews" description="Start your weekly reflection practice" />
      ) : (
        <div className="space-y-4">
          {sortedReviews.map(r => (
            <div key={r.id} className="bg-surface-2 rounded-2xl p-5 border border-border group cursor-pointer" onClick={() => openEditModal(r)}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-text-3 mb-1">Week of {r.weekStartDate ? formatDate(r.weekStartDate) : 'Unknown'}</p>
                  <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} size={16} className={i <= r.rating ? 'text-amber-500 fill-amber-500' : 'text-border'} />
                  ))}</div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditModal(r); }}
                    className="text-text-3 hover:text-rise"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(r.id); }}
                    className="text-text-3 hover:text-red-500"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              {r.wins && <div className="mb-2"><p className="text-xs font-bold text-green-600 mb-0.5">Wins</p><p className="text-sm text-text-2">{r.wins}</p></div>}
              {r.challenges && <div className="mb-2"><p className="text-xs font-bold text-orange-500 mb-0.5">Challenges</p><p className="text-sm text-text-2">{r.challenges}</p></div>}
              {r.lessons && <div className="mb-2"><p className="text-xs font-bold text-blue-500 mb-0.5">Lessons</p><p className="text-sm text-text-2">{r.lessons}</p></div>}
              {r.gps && (
                <div className="mb-2">
                  <p className="text-xs font-bold text-purple-500 mb-0.5 flex items-center gap-1"><Compass size={12} /> GPS</p>
                  <p className="text-sm text-text-2">{r.gps}</p>
                </div>
              )}
              {r.next && (
                <div>
                  <p className="text-xs font-bold text-teal-500 mb-0.5 flex items-center gap-1"><ArrowRight size={12} /> Next Week</p>
                  <p className="text-sm text-text-2">{r.next}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={handleCloseModal} title={editingReview ? 'Edit Review (GPS)' : 'Weekly Review (GPS)'} size="lg">
        <div className="space-y-4">
          <Input label="Week Start Date" type="date" value={weekStartDate} onChange={e => setWeekStartDate(e.target.value)} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-2">Rating</label>
            <div className="flex gap-1">{[1, 2, 3, 4, 5].map(i => (
              <button key={i} onClick={() => setRating(i)}>
                <Star size={28} className={cn('transition-colors', i <= rating ? 'text-amber-500 fill-amber-500' : 'text-border hover:text-amber-300')} />
              </button>
            ))}</div>
          </div>
          <TextArea label="Wins — What went well?" value={wins} onChange={e => setWins(e.target.value)} placeholder="Celebrate your achievements..." />
          <TextArea label="Challenges — What was hard?" value={challenges} onChange={e => setChallenges(e.target.value)} placeholder="What didn't go as planned..." />
          <TextArea label="Lessons — What did you learn?" value={lessons} onChange={e => setLessons(e.target.value)} placeholder="Key takeaways..." />
          <TextArea label="GPS — Goal-Plan-System reflection" value={gps} onChange={e => setGps(e.target.value)} placeholder="Are your goals, plans, and systems aligned?" />
          <TextArea label="Next — What's next?" value={next} onChange={e => setNext(e.target.value)} placeholder="Actions for next week..." />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={handleCloseModal} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={!wins.trim()} className="flex-1">
              {editingReview ? 'Update Review' : 'Save Review'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Delete Review" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-text-2">Are you sure you want to delete this review? This action cannot be undone.</p>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDeleteConfirmId(null)} className="flex-1">Cancel</Button>
            <Button onClick={handleConfirmDelete} className="flex-1 !bg-red-600 hover:!bg-red-700">Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
