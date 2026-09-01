// Unified Data Service Layer: Firestore with Local Storage / Memory sync fallback
import { db, isLiveFirebaseConfigured } from "./firebase";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { INITIAL_BOOKS } from "./mockData";
import { SHIPPING_ZONES } from "./zones";

const CATALOG_CACHE_DB = "concierge_catalog_cache";
const CATALOG_CACHE_STORE = "catalog";
const CATALOG_CHECK_INTERVAL = 3 * 24 * 60 * 60 * 1000;
const LOCAL_STORAGE_ORDERS_KEY = "concierge_orders_db";
const LOCAL_STORAGE_ZONES_KEY = "concierge_zones_db";

let memoryCatalogCache = null;
let catalogFetchPromise = null;

const openCatalogCache = () => new Promise((resolve, reject) => {
  if (typeof window === "undefined" || !window.indexedDB) {
    resolve(null);
    return;
  }

  const request = window.indexedDB.open(CATALOG_CACHE_DB, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(CATALOG_CACHE_STORE);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const getCatalogCache = async () => {
  if (memoryCatalogCache) return memoryCatalogCache;
  try {
    const database = await openCatalogCache();
    if (!database) return null;
    return await new Promise((resolve, reject) => {
      const request = database.transaction(CATALOG_CACHE_STORE, "readonly")
        .objectStore(CATALOG_CACHE_STORE).get("current");
      request.onsuccess = () => {
        memoryCatalogCache = request.result || null;
        resolve(memoryCatalogCache);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Catalog cache read error:", error);
    return null;
  }
};

const setCatalogCache = async (books, version) => {
  const cache = { books, version, checkedAt: Date.now() };
  memoryCatalogCache = cache;
  try {
    const database = await openCatalogCache();
    if (!database) return;
    await new Promise((resolve, reject) => {
      const request = database.transaction(CATALOG_CACHE_STORE, "readwrite")
        .objectStore(CATALOG_CACHE_STORE).put(cache, "current");
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Catalog cache write error:", error);
  }
};

// Helper for local storage initialization
const getLocalData = (key, fallback) => {
  if (typeof window === "undefined") return fallback;
  try {
    const item = localStorage.getItem(key);
    if (!item) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(item);
  } catch (e) {
    return fallback;
  }
};

const setLocalData = (key, data) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("Local storage error:", e);
  }
};

// ==================== BOOKS ====================

export const fetchBooks = async () => {
  if (catalogFetchPromise) return catalogFetchPromise;

  catalogFetchPromise = fetchBooksInternal();
  try {
    return await catalogFetchPromise;
  } finally {
    catalogFetchPromise = null;
  }
};

const fetchBooksInternal = async () => {
  const cachedCatalog = await getCatalogCache();
  const cachedBooks = cachedCatalog?.books || null;
  const cachedVersion = cachedCatalog;
  const hasCache = Array.isArray(cachedBooks) && cachedBooks.length > 0;

  const cacheIsFresh = hasCache && cachedVersion?.checkedAt &&
    Date.now() - cachedVersion.checkedAt < CATALOG_CHECK_INTERVAL;

  if (cacheIsFresh) return cachedBooks;

  if (typeof window !== "undefined" && isLiveFirebaseConfigured) {
    try {
      let remoteVersion = null;
      const versionResponse = await fetch("/api/catalog-version", { cache: "default" });
      if (versionResponse.ok) {
        remoteVersion = await versionResponse.json();
        if (hasCache && remoteVersion.version && remoteVersion.version === cachedVersion?.version) {
          await setCatalogCache(cachedBooks, remoteVersion.version);
          return cachedBooks;
        }
      }

      const versionQuery = remoteVersion?.version
        ? `?version=${encodeURIComponent(remoteVersion.version)}`
        : "";
      const response = await fetch(`/api/catalog${versionQuery}`, { cache: "default" });
      if (!response.ok) {
        throw new Error(`Books API request failed with status ${response.status}`);
      }
      const books = await response.json();
      await setCatalogCache(books, remoteVersion?.version || null);
      return books;
    } catch (err) {
      console.warn("Books API error, falling back to local dataset:", err);
      if (hasCache) return cachedBooks;
    }
  }

  if (typeof window === "undefined" && isLiveFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, "books"));
      if (!snap.empty) {
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
    } catch (err) {
      console.warn("Firestore fetchBooks error, falling back to local dataset:", err);
    }
  }
  return INITIAL_BOOKS;
};

export const fetchBookById = async (bookId) => {
  const cachedCatalog = await getCatalogCache();
  const cachedBooks = cachedCatalog?.books || [];
  const cachedBook = cachedBooks.find((book) => book.id === bookId);
  if (cachedBook) return cachedBook;

  if (typeof window !== "undefined" && isLiveFirebaseConfigured) {
    try {
      const response = await fetch(`/api/catalog?id=${encodeURIComponent(bookId)}`, { cache: "default" });
      if (response.ok) {
        const book = await response.json();
        await setCatalogCache([...cachedBooks, book], cachedCatalog?.version || null);
        return book;
      }
    } catch (err) {
      console.warn("Books API fetchBookById error:", err);
    }
  }

  if (typeof window === "undefined" && isLiveFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "books", bookId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() };
      }
    } catch (err) {
      console.warn("Firestore fetchBookById error:", err);
    }
  }
  return INITIAL_BOOKS.find((book) => book.id === bookId) || null;
};

export const saveBook = async (bookData) => {
  const id = bookData.id || `bk-${Date.now()}`;
  const record = { ...bookData, id, updatedAt: new Date().toISOString() };

  if (isLiveFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "books", id), record, { merge: true });
    } catch (err) {
      console.warn("Firestore saveBook error:", err);
    }
  }

  const cachedCatalog = await getCatalogCache();
  const books = cachedCatalog?.books || INITIAL_BOOKS;
  const index = books.findIndex((b) => b.id === id);
  if (index >= 0) {
    books[index] = record;
  } else {
    books.unshift(record);
  }
  await setCatalogCache(books, cachedCatalog?.version || null);
  return record;
};

// ==================== ORDERS ====================

export const fetchOrders = async (userEmail = null) => {
  // Only return orders if user is authenticated with an email
  if (!userEmail) {
    return [];
  }

  if (isLiveFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, "orders"),
        where("buyerEmail", "==", userEmail),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
    } catch (err) {
      console.warn("Firestore fetchOrders error, falling back to local storage:", err);
    }
  }

  // Only use local storage orders if we have a userEmail to filter by
  const orders = getLocalData(LOCAL_STORAGE_ORDERS_KEY, []);
  return orders.filter((o) => o.buyerEmail?.toLowerCase() === userEmail.toLowerCase());
};

export const createOrder = async (orderPayload) => {
  const orderId = orderPayload.id || `ORD-${Math.floor(10000 + Math.random() * 90000)}-NG`;
  const order = {
    ...orderPayload,
    id: orderId,
    status: orderPayload.status || "paid",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (isLiveFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "orders", orderId), order);
    } catch (err) {
      console.warn("Firestore createOrder error:", err);
    }
  }

  const orders = getLocalData(LOCAL_STORAGE_ORDERS_KEY, []);
  const existingIndex = orders.findIndex(
    (existingOrder) =>
      existingOrder.id === order.id ||
      (order.paymentReference && existingOrder.paymentReference === order.paymentReference)
  );
  if (existingIndex >= 0) {
    orders[existingIndex] = { ...orders[existingIndex], ...order };
  } else {
    orders.unshift(order);
  }
  setLocalData(LOCAL_STORAGE_ORDERS_KEY, orders);

  // Dispatch custom event for real-time reactivity in UI
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("order_created", { detail: order }));
  }

  return existingIndex >= 0 ? orders[existingIndex] : order;
};

export const updateOrderStatus = async (orderId, updateFields) => {
  const timestamp = new Date().toISOString();
  const fields = { ...updateFields, updatedAt: timestamp };

  if (isLiveFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "orders", orderId);
      await updateDoc(docRef, fields);
    } catch (err) {
      console.warn("Firestore updateOrderStatus error:", err);
    }
  }

  const orders = getLocalData(LOCAL_STORAGE_ORDERS_KEY, []);
  const index = orders.findIndex((o) => o.id === orderId);
  if (index >= 0) {
    orders[index] = { ...orders[index], ...fields };
    setLocalData(LOCAL_STORAGE_ORDERS_KEY, orders);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("order_updated", { detail: { orderId, ...fields } }));
  }

  return orders[index];
};

// ==================== SHIPPING ZONES ====================

export const fetchShippingZones = async () => {
  if (isLiveFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, "shippingZones"));
      if (!snap.empty) {
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
    } catch (err) {
      console.warn("Firestore fetchShippingZones error:", err);
    }
  }
  return SHIPPING_ZONES;
};
