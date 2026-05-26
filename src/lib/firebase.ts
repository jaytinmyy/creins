import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  getDocFromServer
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Customer, InstallmentPlan, AuditLog } from '../types';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);

// Google Auth Provider setup with Sheets Scopes
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');

// In-memory token caching
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Authenticate Google Sign-in with Sheets
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google access token');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getCachedAccessToken = () => cachedAccessToken;
export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

// Test Connection to Firestore as per directives
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testFirestoreConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Google Sheets Logging function
export async function appendLogToGoogleSheets(log: AuditLog) {
  if (!cachedAccessToken) {
    console.log('No cached Google access token. Skipping GSheets logging.');
    return;
  }
  
  try {
    const spreadsheetId = '1Lk4-23rlanQNaRjkPsDZVPHlDRib8cSkI1Z_zJ71qzM';
    const range = 'Sheet1!A:E';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;
    
    // Attempt appending row
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cachedAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [
          [log.timestamp, log.userEmail, log.userRole, log.action, log.details]
        ]
      })
    });
    
    if (!response.ok) {
      const errorMsg = await response.text();
      console.error('Failed to append to Google Sheets:', errorMsg);
    } else {
      console.log('Log entry successfully synchronized back to Google Sheets spreadsheet!');
    }
  } catch (error) {
    console.error('Error in appendLogToGoogleSheets API invoke:', error);
  }
}

// Global Company Profile Configurations Database Interfaces
interface DBCompanyConfig {
  name: string;
  logoUrl: string;
  phoneNumber?: string;
  terms?: string;
}

export function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item)) as any;
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = obj[key];
        if (val !== undefined) {
          cleaned[key] = cleanUndefined(val);
        }
      }
    }
    return cleaned;
  }
  return obj;
}

export async function fetchCompanyConfigFromDB(): Promise<DBCompanyConfig | null> {
  const path = 'companyProfile/info';
  try {
    const configDoc = await getDoc(doc(db, 'companyProfile', 'info'));
    if (configDoc.exists()) {
      return configDoc.data() as DBCompanyConfig;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function saveCompanyConfigToDB(config: DBCompanyConfig) {
  const path = 'companyProfile/info';
  try {
    await setDoc(doc(db, 'companyProfile', 'info'), cleanUndefined(config));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Core Firestore Database Getters & Setters
export async function fetchCustomersFromDB(): Promise<Customer[]> {
  const path = 'customers';
  try {
    const querySnapshot = await getDocs(collection(db, 'customers'));
    const items: Customer[] = [];
    querySnapshot.forEach((d) => {
      items.push({ id: d.id, ...d.data() } as Customer);
    });
    return items;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function saveCustomerToDB(customer: Customer) {
  const path = `customers/${customer.id}`;
  try {
    await setDoc(doc(db, 'customers', customer.id), cleanUndefined(customer));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function fetchPlansFromDB(): Promise<InstallmentPlan[]> {
  const path = 'plans';
  try {
    const querySnapshot = await getDocs(collection(db, 'plans'));
    const items: InstallmentPlan[] = [];
    querySnapshot.forEach((d) => {
      items.push({ id: d.id, ...d.data() } as InstallmentPlan);
    });
    return items;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function savePlanToDB(plan: InstallmentPlan) {
  const path = `plans/${plan.id}`;
  try {
    await setDoc(doc(db, 'plans', plan.id), cleanUndefined(plan));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function fetchLogsFromDB(): Promise<AuditLog[]> {
  const path = 'logs';
  try {
    const items: AuditLog[] = [];
    const querySnapshot = await getDocs(collection(db, 'logs'));
    querySnapshot.forEach((d) => {
      items.push({ id: d.id, ...d.data() } as AuditLog);
    });
    // Sort descending by timestamp
    return items.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function saveLogToDB(log: AuditLog) {
  const path = `logs/${log.id}`;
  try {
    await setDoc(doc(db, 'logs', log.id), cleanUndefined(log));
    // Sync to Sheets asynchronously
    appendLogToGoogleSheets(log).catch(console.error);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
