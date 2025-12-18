/* eslint-disable @typescript-eslint/no-explicit-any */
import { openDB } from 'idb';

const DB_NAME = 'VR_Ecommerce_DB';

export async function initDB(storeName: string) {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    },
  });
}

export async function getFromDB(storeName: string, key: string) {
  const db = await initDB(storeName);
  return db.get(storeName, key);
}

export async function setToDB(storeName: string, key: string, value: any) {
  const db = await initDB(storeName);
  return db.put(storeName, value, key);
}

export async function removeFromDB(storeName: string, key: string) {
  const db = await initDB(storeName);
  return db.delete(storeName, key);
}

export async function clearDB(storeName: string) {
  const db = await initDB(storeName);
  return db.clear(storeName);
}