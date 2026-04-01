import {
  collection, doc,
  addDoc as firestoreAddDoc,
  updateDoc as firestoreUpdateDoc,
  deleteDoc as firestoreDeleteDoc,
  query, where, limit, orderBy, startAfter, onSnapshot,
  DocumentData, QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';
import { useState, useEffect } from 'react';
import { validateDocument, CollectionSchemas } from './validations';

/**
 * Strip undefined values before every Firestore write.
 * Firestore throws "Unsupported field value: undefined" otherwise.
 */
function clean(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
}

// ─── Write helpers ────────────────────────────────────────────────────────────

export async function addDocument<T extends DocumentData>(
  collectionName: string,
  data: Omit<T, 'id'>,
  userId: string,
): Promise<string> {
  // Validate data before write
  const validation = validateDocument(collectionName, data);
  if (!validation.valid) {
    const errorsArray = validation.error as Array<{ path: (string | number)[]; message: string }>;
    const errors = errorsArray
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    throw new Error(`Validation failed for ${collectionName}: ${errors}`);
  }

  const payload = clean({
    ...(validation.data as Record<string, unknown>),
    userId,
    createdAt: new Date().toISOString(),
  });
  const docRef = await firestoreAddDoc(collection(db, collectionName), payload);
  return docRef.id;
}

export async function updateDocument(
  collectionName: string,
  docId: string,
  data: Partial<DocumentData>,
): Promise<void> {
  // Validate data before write (only validate provided fields)
  if (Object.keys(data).length > 0) {
    const validation = validateDocument(collectionName, data, true);
    if (!validation.valid) {
      const errorsArray = validation.error as Array<{ path: (string | number)[]; message: string }>;
      const errors = errorsArray
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new Error(`Validation failed for ${collectionName}: ${errors}`);
    }
  }

  const docRef = doc(db, collectionName, docId);
  await firestoreUpdateDoc(docRef, clean(data as Record<string, unknown>));
}

export async function deleteDocument(
  collectionName: string,
  docId: string,
): Promise<void> {
  await firestoreDeleteDoc(doc(db, collectionName, docId));
}

// ─── Real-time collection hook ────────────────────────────────────────────────

/**
 * Subscribe to a Firestore collection in real-time with optional pagination.
 *
 * DEFAULT BEHAVIOR (serverOrder: false):
 *   - Queries by userId only (single-field index - always free)
 *   - Sorting performed client-side (no composite index required)
 *   - Works out-of-the-box without any Firebase index setup
 *
 * OPTIONAL SERVER-SIDE ORDERING (serverOrder: true):
 *   - Uses Firestore orderBy() for server-side sorting
 *   - REQUIRES a composite index: collectionName + userId + orderField
 *   - Must create index manually in Firebase Console when first error occurs
 *   - Enables efficient cursor-based pagination via startAfterValue
 *
 * Pagination:
 *   - Use limitCount to cap documents received from server
 *   - Use startAfterValue with serverOrder to implement "load more" (cursor pagination)
 *   - Cursor value should be the orderField value of the last document in current page
 *
 * @param collectionName - Firestore collection name
 * @param userId - User ID filter (required for data isolation)
 * @param orderField - Field to sort by (default 'createdAt'). For client-side sort when serverOrder=false, for server orderBy when serverOrder=true.
 * @param limitCount - Optional max documents to receive from server
 * @param serverOrder - Set true to enable server-side ordering (requires composite index)
 * @param startAfterValue - Cursor value (orderField value of last doc) for pagination (only works with serverOrder)
 * @param orderDirection - 'asc' or 'desc' (default: 'desc' for newest first)
 */
export function useCollection<T extends { id: string }>(
  collectionName: string,
  userId: string | undefined,
  orderField: string = 'createdAt',
  limitCount?: number,
  serverOrder?: boolean,
  startAfterValue?: any,
  orderDirection: 'asc' | 'desc' = 'desc',
): { data: T[]; loading: boolean; error: string | null } {
  const [data, setData]       = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Build query constraints in proper order: where -> orderBy (if serverOrder) -> startAfter (if any) -> limit
    const constraints: QueryConstraint[] = [where('userId', '==', userId)];

    if (serverOrder) {
      // Server-side ordering: requires composite index (userId + orderField)
      constraints.push(orderBy(orderField, orderDirection));
      if (startAfterValue !== undefined) {
        constraints.push(startAfter(startAfterValue));
      }
    }
    // If not using serverOrder, we'll sort client-side after fetching

    if (limitCount) {
      constraints.push(limit(limitCount));
    }

    const q = query(collection(db, collectionName), ...constraints);

    let unsub: (() => void) = () => {};

    unsub = onSnapshot(
      q,
      (snap) => {
        let items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));

        // Client-side sorting fallback when serverOrder is not enabled
        if (!serverOrder) {
          items.sort((a, b) => {
            const av = (a as Record<string, unknown>)[orderField];
            const bv = (b as Record<string, unknown>)[orderField];
            if (typeof av === 'number' && typeof bv === 'number') {
              return orderDirection === 'desc' ? bv - av : av - bv;
            }
            // Handle timestamps and strings
            const strA = String(av ?? '');
            const strB = String(bv ?? '');
            return orderDirection === 'desc' ? strB.localeCompare(strA) : strA.localeCompare(strB);
          });
        }

        setData(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`[Firestore] ${collectionName} listener:`, err);
        setError(err.message);
        setLoading(false);
        unsub(); // Unsubscribe immediately on error
      },
    );

    return () => unsub();
  }, [collectionName, userId, orderField, limitCount, serverOrder, startAfterValue, orderDirection]);

  return { data, loading, error };
}
