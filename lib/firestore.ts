import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  type QueryConstraint,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { COLLECTIONS } from './constants';

// ─── GENERIC HELPERS ─────────────────────────────────────────────────────────

export function colRef(collectionName: string) {
  return collection(db, collectionName);
}

export function docRef(collectionName: string, id: string) {
  return doc(db, collectionName, id);
}

/** Strip undefined values so Firestore never receives them. */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

export async function createDoc<T extends object>(
  collectionName: string,
  data: T
): Promise<string> {
  const ref = await addDoc(colRef(collectionName), {
    ...stripUndefined(data),
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}

export async function setDocById<T extends object>(
  collectionName: string,
  id: string,
  data: T
): Promise<void> {
  await setDoc(docRef(collectionName, id), stripUndefined(data), { merge: true });
}

export async function updateDocById<T extends Partial<DocumentData>>(
  collectionName: string,
  id: string,
  data: T
): Promise<void> {
  await updateDoc(docRef(collectionName, id), stripUndefined(data) as DocumentData);
}

export async function deleteDocById(
  collectionName: string,
  id: string
): Promise<void> {
  await deleteDoc(docRef(collectionName, id));
}

export async function getDocById<T>(
  collectionName: string,
  id: string
): Promise<T | null> {
  const snap = await getDoc(docRef(collectionName, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as T;
}

export async function queryDocs<T>(
  collectionName: string,
  constraints: QueryConstraint[]
): Promise<T[]> {
  const q = query(colRef(collectionName), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

// ─── REAL-TIME LISTENER ───────────────────────────────────────────────────────
export function subscribeToCollection<T>(
  collectionName: string,
  userId: string,
  callback: (data: T[]) => void,
  extraConstraints: QueryConstraint[] = []
): Unsubscribe {
  const q = query(
    colRef(collectionName),
    where('userId', '==', userId),
    ...extraConstraints
  );
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
    callback(docs);
  });
}

// ─── USER META ───────────────────────────────────────────────────────────────
export async function getUserMeta(userId: string) {
  return getDocById<{
    onboardingComplete: boolean;
    displayName?: string;
    photoURL?: string;
    createdAt: string;
    lastLoginAt: string;
  }>(COLLECTIONS.USERS, userId);
}

export async function setUserMeta(
  userId: string,
  data: Partial<{
    onboardingComplete: boolean;
    displayName: string;
    photoURL: string;
    createdAt: string;
    lastLoginAt: string;
  }>
) {
  await setDocById(COLLECTIONS.USERS, userId, data);
}

// ─── RE-EXPORT QUERY BUILDERS ────────────────────────────────────────────────
export { where, orderBy, limit, serverTimestamp };
