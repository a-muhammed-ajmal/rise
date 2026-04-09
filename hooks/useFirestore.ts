'use client';

import { useState, useEffect, useCallback } from 'react';
import { type QueryConstraint } from 'firebase/firestore';
import {
  subscribeToCollection,
  createDoc,
  updateDocById,
  deleteDocById,
} from '@/lib/firestore';
import { toast } from '@/lib/toast';

interface UseCollectionOptions {
  userId: string;
  collectionName: string;
  constraints?: QueryConstraint[];
  enabled?: boolean;
}

export function useCollection<T extends { id: string }>(
  options: UseCollectionOptions
) {
  const { userId, collectionName, constraints = [], enabled = true } = options;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToCollection<T>(
      collectionName,
      userId,
      (docs) => {
        setData(docs);
        setLoading(false);
      },
      constraints
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, collectionName, enabled]);

  const add = useCallback(
    async (item: Omit<T, 'id' | 'createdAt'>): Promise<string | null> => {
      try {
        const id = await createDoc(collectionName, { ...item, userId });
        return id;
      } catch {
        toast.error('Failed to save. Please try again.');
        return null;
      }
    },
    [collectionName, userId]
  );

  const update = useCallback(
    async (id: string, changes: Partial<T>): Promise<void> => {
      try {
        await updateDocById(collectionName, id, changes);
      } catch {
        toast.error('Failed to update. Please try again.');
      }
    },
    [collectionName]
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      try {
        await deleteDocById(collectionName, id);
      } catch {
        toast.error('Failed to delete. Please try again.');
      }
    },
    [collectionName]
  );

  return { data, loading, error, add, update, remove };
}
