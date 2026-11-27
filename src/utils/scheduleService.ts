import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  EmployeeScheduleRecord,
  ParsedMonthBlock,
  ParsedSpreadsheetRow,
  ScheduleDayCode,
} from '../types/schedule';
import {
  buildScheduleDocId,
  normalizeEmployeeName,
  sanitizeField,
} from './scheduleSpreadsheet';

export interface SupervisorAdminRecord {
  id: string;
  displayName: string;
  role: 'admin';
  createdBy: string;
}

export function isBootstrappedSupervisor(user: User | null): boolean {
  return Boolean(
    user &&
      user.emailVerified &&
      user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
  );
}

export async function checkIsSupervisor(user: User | null): Promise<boolean> {
  if (!user) {
    return false;
  }
  if (isBootstrappedSupervisor(user)) {
    return true;
  }
  try {
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    return adminSnap.exists();
  } catch (error) {
    console.error('Erro ao verificar permissão de encarregado:', error);
    return false;
  }
}

export function subscribeAdmins(
  onData: (admins: SupervisorAdminRecord[]) => void,
  onError: (message: string) => void
): () => void {
  const q = query(collection(db, 'admins'), where('role', '==', 'admin'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: SupervisorAdminRecord[] = snapshot.docs.map((snap) => {
        const data = snap.data();
        return {
          id: snap.id,
          displayName: String(data.displayName ?? ''),
          role: 'admin',
          createdBy: String(data.createdBy ?? ''),
        };
      });
      items.sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'admins');
      } catch {
        onError('Não foi possível carregar a lista de encarregados autorizados.');
      }
    }
  );
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export async function addSupervisorAdmin(
  adminUid: string,
  displayName: string,
  creatorUid: string
): Promise<void> {
  const cleanUid = adminUid.trim();
  const cleanName = sanitizeField(displayName, 80);

  if (!VALID_ID_REGEX.test(cleanUid)) {
    throw new Error('UID inválido. Copie o UID exatamente como aparece no Firebase Console.');
  }
  if (cleanName.length < 2) {
    throw new Error('Informe um nome de exibição com pelo menos 2 caracteres.');
  }

  const ref = doc(db, 'admins', cleanUid);
  try {
    await setDoc(ref, {
      displayName: cleanName,
      role: 'admin',
      createdBy: creatorUid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `admins/${cleanUid}`);
  }
}

export async function removeSupervisorAdmin(adminUid: string): Promise<void> {
  const cleanUid = adminUid.trim();
  if (!VALID_ID_REGEX.test(cleanUid)) {
    throw new Error('UID inválido.');
  }
  const ref = doc(db, 'admins', cleanUid);
  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `admins/${cleanUid}`);
  }
}

export function subscribeMonthSchedules(
  monthKey: string,
  onData: (schedules: EmployeeScheduleRecord[]) => void,
  onError: (message: string) => void
): () => void {
  const q = query(
    collection(db, 'schedules'),
    where('monthKey', '==', monthKey),
    where('isPublished', '==', true)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: EmployeeScheduleRecord[] = snapshot.docs.map((snap) => {
        const data = snap.data();
        return {
          id: snap.id,
          monthKey: String(data.monthKey ?? monthKey),
          employeeName: String(data.employeeName ?? ''),
          normalizedName: String(data.normalizedName ?? ''),
          department: String(data.department ?? ''),
          shift: String(data.shift ?? ''),
          days: (data.days as Record<string, ScheduleDayCode>) || {},
          isPublished: Boolean(data.isPublished),
          updatedBy: String(data.updatedBy ?? ''),
        };
      });

      items.sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'pt-BR'));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, `schedules?monthKey=${monthKey}`);
      } catch {
        onError('Não foi possível carregar as escalas deste mês no momento.');
      }
    }
  );
}

export interface SaveEmployeeInput {
  id?: string;
  monthKey: string;
  employeeName: string;
  department: string;
  shift: string;
  days: Record<string, ScheduleDayCode>;
}

export async function saveEmployeeSchedule(
  input: SaveEmployeeInput,
  uid: string,
  isExisting: boolean
): Promise<string> {
  const employeeName = sanitizeField(input.employeeName, 80);
  const normalizedName = normalizeEmployeeName(employeeName);
  const department = sanitizeField(input.department, 60);
  const shift = sanitizeField(input.shift, 40);
  const docId = input.id || buildScheduleDocId(input.monthKey, employeeName);
  const ref = doc(db, 'schedules', docId);

  try {
    if (isExisting) {
      await updateDoc(ref, {
        employeeName,
        normalizedName,
        department,
        shift,
        days: input.days,
        isPublished: true,
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        monthKey: input.monthKey,
        employeeName,
        normalizedName,
        department,
        shift,
        days: input.days,
        isPublished: true,
        updatedBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return docId;
  } catch (error) {
    handleFirestoreError(
      error,
      isExisting ? OperationType.UPDATE : OperationType.CREATE,
      `schedules/${docId}`
    );
  }
}

export async function publishImportedSchedules(
  monthKey: string,
  rows: ParsedSpreadsheetRow[],
  existingIds: Set<string>,
  uid: string
): Promise<void> {
  const CHUNK_SIZE = 400;

  try {
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      for (const row of chunk) {
        const ref = doc(db, 'schedules', row.docId);
        if (existingIds.has(row.docId)) {
          batch.update(ref, {
            employeeName: row.employeeName,
            normalizedName: row.normalizedName,
            department: row.department,
            shift: row.shift,
            days: row.days,
            isPublished: true,
            updatedBy: uid,
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(ref, {
            monthKey,
            employeeName: row.employeeName,
            normalizedName: row.normalizedName,
            department: row.department,
            shift: row.shift,
            days: row.days,
            isPublished: true,
            updatedBy: uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `schedules/${monthKey}_batch`);
  }
}

export async function publishMultiMonthSchedules(
  blocks: ParsedMonthBlock[],
  uid: string
): Promise<{ monthCount: number; totalRecords: number }> {
  const activeBlocks = blocks.filter((b) => b.rows.length > 0);
  if (activeBlocks.length === 0) {
    return { monthCount: 0, totalRecords: 0 };
  }

  // Fetch existing published doc IDs per target monthKey so updates preserve createdAt
  const existingIds = new Set<string>();
  try {
    await Promise.all(
      activeBlocks.map(async (block) => {
        const q = query(
          collection(db, 'schedules'),
          where('monthKey', '==', block.monthKey),
          where('isPublished', '==', true)
        );
        const snap = await getDocs(q);
        snap.forEach((docSnap) => existingIds.add(docSnap.id));
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'schedules/multi_month_lookup');
  }

  const allOperations: Array<{ monthKey: string; row: ParsedSpreadsheetRow }> = [];
  for (const block of activeBlocks) {
    for (const row of block.rows) {
      allOperations.push({ monthKey: block.monthKey, row });
    }
  }

  const CHUNK_SIZE = 400;
  try {
    for (let i = 0; i < allOperations.length; i += CHUNK_SIZE) {
      const chunk = allOperations.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      for (const { monthKey, row } of chunk) {
        const ref = doc(db, 'schedules', row.docId);
        if (existingIds.has(row.docId)) {
          batch.update(ref, {
            employeeName: row.employeeName,
            normalizedName: row.normalizedName,
            department: row.department,
            shift: row.shift,
            days: row.days,
            isPublished: true,
            updatedBy: uid,
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(ref, {
            monthKey,
            employeeName: row.employeeName,
            normalizedName: row.normalizedName,
            department: row.department,
            shift: row.shift,
            days: row.days,
            isPublished: true,
            updatedBy: uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();
    }

    return {
      monthCount: activeBlocks.length,
      totalRecords: allOperations.length,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'schedules/multi_month_batch');
  }
}

export async function deleteEmployeeSchedule(scheduleId: string): Promise<void> {
  const ref = doc(db, 'schedules', scheduleId);
  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `schedules/${scheduleId}`);
  }
}
