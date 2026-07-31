import { initializeApp } from 'firebase/app';
import { 
  initializeAuth, 
  browserLocalPersistence, 
  browserPopupRedirectResolver 
} from 'firebase/auth';
import { 
  getFirestore as realGetFirestore, 
  doc as realDoc, 
  collection as realCollection, 
  query as realQuery, 
  where as realWhere, 
  orderBy as realOrderBy, 
  limit as realLimit, 
  getDoc as realGetDoc, 
  getDocFromServer as realGetDocFromServer,
  setDoc as realSetDoc, 
  updateDoc as realUpdateDoc, 
  deleteDoc as realDeleteDoc, 
  addDoc as realAddDoc, 
  getDocs as realGetDocs, 
  onSnapshot as realOnSnapshot,
  serverTimestamp as realServerTimestamp,
  Timestamp 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// Initialize Firebase services with explicit persistence and resolver for better iframe compatibility
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});

const realDb = realGetFirestore(app, firebaseConfig.firestoreDatabaseId);
export const db = realDb;

// Track connection offline state
let isOfflineMode = false;

// Convert any potential backend Timestamp formats safely back to Firebase Client Timestamp objects
export function restoreTimestamps(val: any): any {
  if (!val || typeof val !== 'object') return val;
  
  // Admin SDK or serialized Timestamp: { _seconds / seconds: number, _nanoseconds / nanoseconds / nanos: number }
  const sec = typeof val._seconds === 'number' ? val._seconds : (typeof val.seconds === 'number' ? val.seconds : null);
  if (sec !== null) {
    const nano = val._nanoseconds ?? val.nanoseconds ?? val.nanos ?? 0;
    try {
      return Timestamp.fromMillis(sec * 1000 + Math.floor(nano / 1000000));
    } catch {
      // fallback
    }
  }
  
  if (Array.isArray(val)) {
    return val.map(restoreTimestamps);
  }
  
  const res: any = {};
  for (const key of Object.keys(val)) {
    res[key] = restoreTimestamps(val[key]);
  }
  return res;
}

function isOfflineOrPermissionError(err: any): boolean {
  const msg = err?.message || String(err);
  // Only trigger offline fallback for actual network connection failures, NOT auth or permission errors
  return (
    msg.includes('offline') || 
    msg.includes('unavailable') || 
    msg.includes('Could not reach') ||
    msg.includes('Failed to get document because the client is offline')
  );
}

// Custom wrapped References to seamlessly preserve path segments for fallback mode
export class CustomDocRef {
  path: string;
  id: string;
  realRef: any;
  constructor(path: string, realRef: any) {
    this.path = path;
    this.id = path.split('/').pop() || '';
    this.realRef = realRef;
  }
}

export class CustomCollectionRef {
  path: string;
  id: string;
  realRef: any;
  constructor(path: string, realRef: any) {
    this.path = path;
    this.id = path.split('/').pop() || '';
    this.realRef = realRef;
  }
}

export class CustomQuery {
  path: string;
  orderByField?: string;
  orderByDirection?: 'asc' | 'desc';
  limitCount?: number;
  realQuery: any;
  constructor(path: string, realQuery: any) {
    this.path = path;
    this.realQuery = realQuery;
  }
}

export function doc(dbOrRef: any, ...segments: string[]) {
  let pathStr = '';
  if (typeof dbOrRef === 'string') {
    pathStr = [dbOrRef, ...segments].join('/');
  } else if (dbOrRef instanceof CustomDocRef || dbOrRef instanceof CustomCollectionRef) {
    pathStr = [dbOrRef.path, ...segments].join('/');
  } else if (dbOrRef?.path) {
    pathStr = [dbOrRef.path, ...segments].join('/');
  } else {
    pathStr = segments.join('/');
  }

  let realRef = null;
  if (!isOfflineMode) {
    try {
      const base = dbOrRef instanceof CustomDocRef ? dbOrRef.realRef :
                   dbOrRef instanceof CustomCollectionRef ? dbOrRef.realRef :
                   dbOrRef?.realRef || dbOrRef;
      realRef = (realDoc as any)(base, ...segments);
    } catch (e) {
      // ignore
    }
  }
  
  return new CustomDocRef(pathStr, realRef);
}

export function collection(dbOrRef: any, ...segments: string[]) {
  let pathStr = '';
  if (typeof dbOrRef === 'string') {
    pathStr = [dbOrRef, ...segments].join('/');
  } else if (dbOrRef instanceof CustomDocRef || dbOrRef instanceof CustomCollectionRef) {
    pathStr = [dbOrRef.path, ...segments].join('/');
  } else if (dbOrRef?.path) {
    pathStr = [dbOrRef.path, ...segments].join('/');
  } else {
    pathStr = segments.join('/');
  }

  let realRef = null;
  if (!isOfflineMode) {
    try {
      const base = dbOrRef instanceof CustomDocRef ? dbOrRef.realRef :
                   dbOrRef instanceof CustomCollectionRef ? dbOrRef.realRef :
                   dbOrRef?.realRef || dbOrRef;
      realRef = (realCollection as any)(base, ...segments);
    } catch (e) {
      // ignore
    }
  }
  
  return new CustomCollectionRef(pathStr, realRef);
}

export function query(baseRef: any, ...constraints: any[]) {
  if (!isOfflineMode) {
    try {
      const realBase = baseRef instanceof CustomCollectionRef ? baseRef.realRef :
                       baseRef instanceof CustomQuery ? baseRef.realQuery :
                       baseRef?.realRef || baseRef?.realQuery || baseRef;
      const realConstraints = constraints.map(c => c?.realConstraint || c).filter(Boolean);
      const q = realQuery(realBase, ...realConstraints);
      const customQ = new CustomQuery(baseRef.path, q);
      for (const c of constraints) {
        if (c?.orderByField) {
          customQ.orderByField = c.orderByField;
          customQ.orderByDirection = c.orderByDirection;
        }
        if (c?.limitCount) {
          customQ.limitCount = c.limitCount;
        }
      }
      return customQ;
    } catch (err: any) {
      // fallback
    }
  }

  const customQ = new CustomQuery(baseRef.path, null);
  for (const c of constraints) {
    if (c?.orderByField) {
      customQ.orderByField = c.orderByField;
      customQ.orderByDirection = c.orderByDirection;
    }
    if (c?.limitCount) {
      customQ.limitCount = c.limitCount;
    }
  }
  return customQ;
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return {
    orderByField: field,
    orderByDirection: direction,
    realConstraint: realOrderBy(field, direction)
  };
}

export function limit(count: number) {
  return {
    limitCount: count,
    realConstraint: realLimit(count)
  };
}

export function where(field: string, op: string, value: any) {
  return {
    realConstraint: realWhere(field, op as any, value)
  };
}

export async function getDoc(docRef: any) {
  if (!isOfflineMode) {
    try {
      const realTarget = docRef instanceof CustomDocRef ? docRef.realRef : docRef?.realRef || docRef;
      const snap = await realGetDoc(realTarget);
      return snap;
    } catch (err: any) {
      if (isOfflineOrPermissionError(err)) {
        isOfflineMode = true;
      } else {
        throw err;
      }
    }
  }
  
  const path = docRef instanceof CustomDocRef ? docRef.path : docRef.path;
  const res = await fetch('/api/firestore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get', path })
  });
  if (!res.ok) {
    throw new Error(`Server Firestore Proxy failed: ${res.statusText}`);
  }
  const body = await res.json();
  const restoredData = restoreTimestamps(body.data);
  return {
    exists: () => body.exists,
    data: () => restoredData,
    id: path.split('/').pop() || ''
  };
}

export async function getDocFromServer(docRef: any) {
  // Directly fall back to getDoc which handles proxy fallback
  return getDoc(docRef);
}

export async function setDoc(docRef: any, data: any, options?: any) {
  if (!isOfflineMode) {
    try {
      const realTarget = docRef instanceof CustomDocRef ? docRef.realRef : docRef?.realRef || docRef;
      await realSetDoc(realTarget, data, options);
      return;
    } catch (err: any) {
      if (isOfflineOrPermissionError(err)) {
        isOfflineMode = true;
      } else {
        throw err;
      }
    }
  }

  const path = docRef instanceof CustomDocRef ? docRef.path : docRef.path;
  const res = await fetch('/api/firestore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'set', path, data })
  });
  if (!res.ok) {
    throw new Error(`Server Firestore Proxy failed: ${res.statusText}`);
  }
}

export async function updateDoc(docRef: any, data: any) {
  if (!isOfflineMode) {
    try {
      const realTarget = docRef instanceof CustomDocRef ? docRef.realRef : docRef?.realRef || docRef;
      await realUpdateDoc(realTarget, data);
      return;
    } catch (err: any) {
      if (isOfflineOrPermissionError(err)) {
        isOfflineMode = true;
      } else {
        throw err;
      }
    }
  }

  const path = docRef instanceof CustomDocRef ? docRef.path : docRef.path;
  const res = await fetch('/api/firestore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update', path, data })
  });
  if (!res.ok) {
    throw new Error(`Server Firestore Proxy failed: ${res.statusText}`);
  }
}

export async function deleteDoc(docRef: any) {
  if (!isOfflineMode) {
    try {
      const realTarget = docRef instanceof CustomDocRef ? docRef.realRef : docRef?.realRef || docRef;
      await realDeleteDoc(realTarget);
      return;
    } catch (err: any) {
      if (isOfflineOrPermissionError(err)) {
        isOfflineMode = true;
      } else {
        throw err;
      }
    }
  }

  const path = docRef instanceof CustomDocRef ? docRef.path : docRef.path;
  const res = await fetch('/api/firestore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', path })
  });
  if (!res.ok) {
    throw new Error(`Server Firestore Proxy failed: ${res.statusText}`);
  }
}

export async function addDoc(collectionRef: any, data: any) {
  if (!isOfflineMode) {
    try {
      const realTarget = collectionRef instanceof CustomCollectionRef ? collectionRef.realRef : collectionRef?.realRef || collectionRef;
      const docRef = await realAddDoc(realTarget, data);
      return docRef;
    } catch (err: any) {
      if (isOfflineOrPermissionError(err)) {
        isOfflineMode = true;
      } else {
        throw err;
      }
    }
  }

  const path = collectionRef instanceof CustomCollectionRef ? collectionRef.path : collectionRef.path;
  const randomId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const docPath = `${path}/${randomId}`;
  
  const res = await fetch('/api/firestore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'set', path: docPath, data })
  });
  if (!res.ok) {
    throw new Error(`Server Firestore Proxy failed: ${res.statusText}`);
  }
  return new CustomDocRef(docPath, null);
}

export async function getDocs(queryObj: any) {
  if (!isOfflineMode) {
    try {
      const realTarget = queryObj instanceof CustomQuery ? queryObj.realQuery :
                         queryObj instanceof CustomCollectionRef ? queryObj.realRef :
                         queryObj?.realQuery || queryObj?.realRef || queryObj;
      const snap = await realGetDocs(realTarget);
      return snap;
    } catch (err: any) {
      if (isOfflineOrPermissionError(err)) {
        isOfflineMode = true;
      } else {
        throw err;
      }
    }
  }

  const path = queryObj.path;
  const res = await fetch('/api/firestore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'list',
      path,
      orderByField: queryObj.orderByField,
      orderByDirection: queryObj.orderByDirection,
      limitCount: queryObj.limitCount
    })
  });
  if (!res.ok) {
    throw new Error(`Server Firestore Proxy failed: ${res.statusText}`);
  }
  const body = await res.json();
  const docs = (body.docs || []).map((d: any) => {
    const restoredData = restoreTimestamps(d.data);
    return {
      id: d.id,
      data: () => restoredData,
      exists: () => true
    };
  });
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (callback: (doc: any) => void) => docs.forEach(callback)
  };
}

export function onSnapshot(ref: any, callback: (snap: any) => void, onError?: (err: any) => void) {
  let active = true;
  let timerId: any = null;

  if (!isOfflineMode) {
    try {
      const realRef = ref instanceof CustomDocRef ? ref.realRef : 
                      ref instanceof CustomCollectionRef ? ref.realRef : 
                      ref instanceof CustomQuery ? ref.realQuery : ref;
                      
      const unsub = realOnSnapshot(realRef, (snap) => {
        if (active) callback(snap);
      }, (err) => {
        if (isOfflineOrPermissionError(err)) {
          isOfflineMode = true;
          startPolling();
        } else if (onError) {
          onError(err);
        }
      });
      
      return () => {
        active = false;
        if (unsub) unsub();
        if (timerId) clearTimeout(timerId);
      };
    } catch (err: any) {
      if (isOfflineOrPermissionError(err)) {
        isOfflineMode = true;
      } else {
        if (onError) onError(err);
        return () => {};
      }
    }
  }

  function startPolling() {
    async function poll() {
      if (!active) return;
      try {
        if (ref instanceof CustomDocRef || (!ref.realQuery && ref.path && !ref.path.includes('/trades') && !ref.path.includes('/rules') && ref.path.split('/').length % 2 === 0)) {
          const snap = await getDoc(ref);
          if (active) callback(snap);
        } else {
          const snap = await getDocs(ref);
          if (active) callback(snap);
        }
      } catch (err) {
        console.warn("[Firestore Proxy Polling Error]:", err);
      }
      if (active) {
        timerId = setTimeout(poll, 4000);
      }
    }
    poll();
  }

  startPolling();

  return () => {
    active = false;
    if (timerId) clearTimeout(timerId);
  };
}

export function serverTimestamp() {
  if (!isOfflineMode) {
    try {
      return realServerTimestamp();
    } catch (e) {}
  }
  return Timestamp.now();
}

export { Timestamp };
export default app;
