import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Lock,
  LogOut,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import {
  auth,
  formatSupervisorIdentifier,
  googleProvider,
  resolveSupervisorAuthEmail,
} from '../firebase';
import {
  EmployeeScheduleRecord,
  ParsedMonthBlock,
  SCHEDULE_CODE_CYCLE,
  SCHEDULE_DAY_META,
  ScheduleDayCode,
} from '../types/schedule';
import {
  addSupervisorAdmin,
  checkIsSupervisor,
  deleteEmployeeSchedule,
  isBootstrappedSupervisor,
  publishMultiMonthSchedules,
  removeSupervisorAdmin,
  saveEmployeeSchedule,
  subscribeAdmins,
  SupervisorAdminRecord,
} from '../utils/scheduleService';
import {
  buildScheduleDocId,
  downloadStandardCsvTemplate,
  downloadStandardExcelTemplate,
  getDaysInMonth,
  normalizeEmployeeName,
  parseScheduleSpreadsheet,
  rebuildMonthBlockForYear,
  sanitizeField,
} from '../utils/scheduleSpreadsheet';

const WEEKDAY_LETTERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

interface SupervisorSchedulePanelProps {
  year: number;
  month: number; // 0-based
  monthKey: string;
  monthTitle: string;
  schedules: EmployeeScheduleRecord[];
  loadingSchedules: boolean;
  onSelectEmployeePreview: (normalizedName: string) => void;
  onSelectMonth?: (year: number, monthZeroBased: number) => void;
}

export const SupervisorSchedulePanel: React.FC<SupervisorSchedulePanelProps> = ({
  year,
  month,
  monthKey,
  monthTitle,
  schedules,
  loadingSchedules,
  onSelectEmployeePreview,
  onSelectMonth,
}) => {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [authReady, setAuthReady] = useState(false);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signingInGoogle, setSigningInGoogle] = useState(false);

  // Username + Password login form state
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  // Delegated supervisors management (only for bootstrapped admin)
  const [admins, setAdmins] = useState<SupervisorAdminRecord[]>([]);
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [removingAdminUid, setRemovingAdminUid] = useState<string | null>(null);

  // Import state (supports multiple months detected from the spreadsheet)
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importFileName, setImportFileName] = useState<string>('');
  const [parsedMonths, setParsedMonths] = useState<ParsedMonthBlock[] | null>(null);
  const [selectedImportIndexes, setSelectedImportIndexes] = useState<number[]>([]);
  const [activePreviewIdx, setActivePreviewIdx] = useState<number>(0);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [publishingImport, setPublishingImport] = useState(false);

  // Manual add form state
  const [newName, setNewName] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [newShift, setNewShift] = useState('');
  const [addingEmployee, setAddingEmployee] = useState(false);

  // Edit employee modal state
  const [editingEmployee, setEditingEmployee] = useState<{
    id: string;
    monthKey: string;
    employeeName: string;
    department: string;
    shift: string;
    days: Record<string, ScheduleDayCode>;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Inline edits map: scheduleId -> updated days map
  const [draftDaysMap, setDraftDaysMap] = useState<
    Record<string, Record<string, ScheduleDayCode>>
  >({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Feedback toast/banner
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const isMainAdmin = isBootstrappedSupervisor(user);
  const totalDays = useMemo(() => getDaysInMonth(year, month), [year, month]);

  const monthDaysInfo = useMemo(() => {
    return Array.from({ length: totalDays }, (_, idx) => {
      const day = idx + 1;
      const weekday = new Date(year, month, day).getDay();
      return {
        day,
        key: String(day),
        label: String(day).padStart(2, '0'),
        weekday,
        weekdayLetter: WEEKDAY_LETTERS[weekday],
        isSunday: weekday === 0,
      };
    });
  }, [year, month, totalDays]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      setCheckingRole(true);
      if (currentUser) {
        const allowed = await checkIsSupervisor(currentUser);
        setIsSupervisor(allowed);
      } else {
        setIsSupervisor(false);
      }
      setCheckingRole(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!isMainAdmin) {
      setAdmins([]);
      return;
    }
    const unsub = subscribeAdmins(
      (list) => setAdmins(list),
      () => {
        // Non-blocking error; admin still has full access to schedules
      }
    );
    return unsub;
  }, [isMainAdmin]);

  // Reset pending manual edits when changing month (keep active spreadsheet preview intact)
  useEffect(() => {
    setDraftDaysMap({});
    setConfirmDeleteId(null);
    setEditingEmployee(null);
  }, [monthKey]);

  const existingIdsSet = useMemo(
    () => new Set(schedules.map((item) => item.id)),
    [schedules]
  );

  const dirtyIds = useMemo(() => Object.keys(draftDaysMap), [draftDaysMap]);

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const email = resolveSupervisorAuthEmail(usernameInput);
    if (!email || !passwordInput) {
      setAuthError('Informe o usuário e a senha para entrar.');
      return;
    }

    setSigningIn(true);
    try {
      await signInWithEmailAndPassword(auth, email, passwordInput);
      setPasswordInput('');
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code === 'auth/operation-not-allowed') {
        setAuthError(
          'O acesso por usuário e senha precisa ser ativado no Firebase Console (Authentication → Sign-in method → E-mail/senha).'
        );
      } else if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found' ||
        code === 'auth/invalid-email'
      ) {
        setAuthError(
          'Usuário ou senha incorretos. Confira os dados ou verifique se a conta foi cadastrada no Firebase Console.'
        );
      } else if (code === 'auth/too-many-requests') {
        setAuthError('Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.');
      } else {
        setAuthError('Não foi possível entrar agora. Tente novamente.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setSigningInGoogle(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError('O login foi cancelado antes de concluir.');
      } else if (code === 'auth/popup-blocked') {
        setAuthError('O navegador bloqueou a janela de login. Permita pop-ups e tente novamente.');
      } else {
        setAuthError('Não foi possível entrar com o Google. Tente novamente.');
      }
    } finally {
      setSigningInGoogle(false);
    }
  };

  const handleSignOut = async () => {
    setFeedback(null);
    setAuthError(null);
    await signOut(auth);
  };

  const handleCopyUid = async (uid: string) => {
    try {
      await navigator.clipboard.writeText(uid);
      setCopiedUid(true);
      window.setTimeout(() => setCopiedUid(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  };

  const handleAddSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isMainAdmin) return;
    setFeedback(null);
    setSavingAdmin(true);
    try {
      await addSupervisorAdmin(newAdminUid, newAdminName, user.uid);
      setNewAdminUid('');
      setNewAdminName('');
      setFeedback({
        type: 'success',
        message: 'Encarregado autorizado com sucesso.',
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error && err.message && !err.message.startsWith('{')
            ? err.message
            : 'Não foi possível autorizar este UID. Verifique os dados informados.',
      });
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleRemoveSupervisor = async (admin: SupervisorAdminRecord) => {
    setRemovingAdminUid(admin.id);
    setFeedback(null);
    try {
      await removeSupervisorAdmin(admin.id);
      setFeedback({
        type: 'success',
        message: `Acesso de ${admin.displayName} revogado.`,
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Não foi possível revogar o acesso deste encarregado.',
      });
    } finally {
      setRemovingAdminUid(null);
    }
  };

  const handleFileSelected = async (file: File | null) => {
    if (!file) return;
    setFeedback(null);
    setParseError(null);
    setParseWarnings([]);
    setParsedMonths(null);
    setSelectedImportIndexes([]);
    setActivePreviewIdx(0);
    setImportFileName(file.name);

    const result = await parseScheduleSpreadsheet(file, year, month);
    if (result.error) {
      setParseError(result.error);
      setParseWarnings(result.warnings);
      return;
    }

    setParsedMonths(result.months);
    setSelectedImportIndexes(result.months.map((_, idx) => idx));
    setActivePreviewIdx(0);
    setParseWarnings(result.warnings);
  };

  const handleToggleImportMonth = (idx: number) => {
    setSelectedImportIndexes((prev) =>
      prev.includes(idx) ? prev.filter((item) => item !== idx) : [...prev, idx]
    );
  };

  const handleChangeImportMonthYear = (idx: number, newYear: number) => {
    setParsedMonths((prev) => {
      if (!prev) return prev;
      return prev.map((block, i) =>
        i === idx ? rebuildMonthBlockForYear(block, newYear) : block
      );
    });
  };

  const handleCancelImport = () => {
    setParsedMonths(null);
    setSelectedImportIndexes([]);
    setActivePreviewIdx(0);
    setParseWarnings([]);
    setParseError(null);
    setImportFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePublishImport = async () => {
    if (!user || !parsedMonths || selectedImportIndexes.length === 0) return;

    const blocksToPublish = parsedMonths.filter((_, idx) =>
      selectedImportIndexes.includes(idx)
    );
    if (blocksToPublish.length === 0) return;

    setPublishingImport(true);
    setFeedback(null);
    try {
      const { monthCount, totalRecords } = await publishMultiMonthSchedules(
        blocksToPublish,
        user.uid
      );
      const publishedLabels = blocksToPublish.map(
        (b) => `${b.monthLabel}/${b.year}`
      );
      setFeedback({
        type: 'success',
        message: `Escala publicada para ${publishedLabels.join(', ')} (${monthCount} ${
          monthCount === 1 ? 'mês' : 'meses'
        } · ${totalRecords} ${totalRecords === 1 ? 'registro' : 'registros'}).`,
      });

      // If the currently displayed month wasn't part of the upload, jump straight to the first published month
      const includesCurrentMonth = blocksToPublish.some((b) => b.monthKey === monthKey);
      if (!includesCurrentMonth && onSelectMonth) {
        onSelectMonth(blocksToPublish[0].year, blocksToPublish[0].monthIndex);
      }

      handleCancelImport();
    } catch {
      setFeedback({
        type: 'error',
        message: 'Não foi possível salvar a planilha. Verifique sua conexão e permissões.',
      });
    } finally {
      setPublishingImport(false);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFeedback(null);

    const cleanName = sanitizeField(newName, 80);
    const normalized = normalizeEmployeeName(cleanName);
    if (normalized.length < 2) {
      setFeedback({
        type: 'error',
        message: 'Informe o nome do funcionário com pelo menos 2 letras.',
      });
      return;
    }

    const docId = buildScheduleDocId(monthKey, cleanName);
    const isExisting = existingIdsSet.has(docId);

    const days: Record<string, ScheduleDayCode> = Object.fromEntries(
      Array.from({ length: totalDays }, (_, i) => [String(i + 1), 'T' as ScheduleDayCode])
    );

    setAddingEmployee(true);
    try {
      await saveEmployeeSchedule(
        {
          id: docId,
          monthKey,
          employeeName: cleanName,
          department: sanitizeField(newDepartment, 60),
          shift: sanitizeField(newShift, 40),
          days,
        },
        user.uid,
        isExisting
      );
      setNewName('');
      setNewDepartment('');
      setNewShift('');
      setFeedback({
        type: 'success',
        message: isExisting
          ? `Escala de ${cleanName} atualizada em ${monthTitle}.`
          : `${cleanName} adicionado(a) à escala de ${monthTitle}.`,
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Erro ao salvar funcionário. Tente novamente.',
      });
    } finally {
      setAddingEmployee(false);
    }
  };

  const handleCycleDay = (schedule: EmployeeScheduleRecord, dayKey: string) => {
    const currentDays = draftDaysMap[schedule.id] ?? schedule.days;
    const currentCode = currentDays[dayKey] || 'T';
    const nextIdx = (SCHEDULE_CODE_CYCLE.indexOf(currentCode) + 1) % SCHEDULE_CODE_CYCLE.length;
    const nextCode = SCHEDULE_CODE_CYCLE[nextIdx];

    setDraftDaysMap((prev) => ({
      ...prev,
      [schedule.id]: {
        ...currentDays,
        [dayKey]: nextCode,
      },
    }));
  };

  const handleOpenEditEmployee = (schedule: EmployeeScheduleRecord) => {
    const currentDays = draftDaysMap[schedule.id] ?? schedule.days;
    setEditingEmployee({
      id: schedule.id,
      monthKey: schedule.monthKey,
      employeeName: schedule.employeeName,
      department: schedule.department,
      shift: schedule.shift,
      days: { ...currentDays },
    });
  };

  const handleToggleEditModalDay = (dayKey: string) => {
    setEditingEmployee((prev) => {
      if (!prev) return prev;
      const currentCode = prev.days[dayKey] || 'T';
      const nextIdx =
        (SCHEDULE_CODE_CYCLE.indexOf(currentCode) + 1) % SCHEDULE_CODE_CYCLE.length;
      return {
        ...prev,
        days: {
          ...prev.days,
          [dayKey]: SCHEDULE_CODE_CYCLE[nextIdx],
        },
      };
    });
  };

  const handleSaveEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingEmployee) return;
    setFeedback(null);

    const cleanName = sanitizeField(editingEmployee.employeeName, 80);
    const normalized = normalizeEmployeeName(cleanName);
    if (normalized.length < 2) {
      setFeedback({
        type: 'error',
        message: 'Informe o nome do funcionário com pelo menos 2 letras.',
      });
      return;
    }

    setSavingEdit(true);
    try {
      await saveEmployeeSchedule(
        {
          id: editingEmployee.id,
          monthKey: editingEmployee.monthKey,
          employeeName: cleanName,
          department: sanitizeField(editingEmployee.department, 60),
          shift: sanitizeField(editingEmployee.shift, 40),
          days: editingEmployee.days,
        },
        user.uid,
        true
      );
      setDraftDaysMap((prev) => {
        const next = { ...prev };
        delete next[editingEmployee.id];
        return next;
      });
      setEditingEmployee(null);
      setFeedback({
        type: 'success',
        message: `Dados e escala de ${cleanName} atualizados.`,
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Não foi possível salvar as alterações deste funcionário.',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSaveRow = async (schedule: EmployeeScheduleRecord) => {
    if (!user) return;
    const editedDays = draftDaysMap[schedule.id];
    if (!editedDays) return;

    setSavingIds((prev) => ({ ...prev, [schedule.id]: true }));
    setFeedback(null);
    try {
      await saveEmployeeSchedule(
        {
          id: schedule.id,
          monthKey: schedule.monthKey,
          employeeName: schedule.employeeName,
          department: schedule.department,
          shift: schedule.shift,
          days: editedDays,
        },
        user.uid,
        true
      );
      setDraftDaysMap((prev) => {
        const next = { ...prev };
        delete next[schedule.id];
        return next;
      });
      setFeedback({
        type: 'success',
        message: `Alterações de ${schedule.employeeName} salvas.`,
      });
    } catch {
      setFeedback({
        type: 'error',
        message: `Não foi possível salvar a escala de ${schedule.employeeName}.`,
      });
    } finally {
      setSavingIds((prev) => ({ ...prev, [schedule.id]: false }));
    }
  };

  const handleSaveAllDirty = async () => {
    if (!user || dirtyIds.length === 0) return;
    setFeedback(null);
    const targets = schedules.filter((item) => draftDaysMap[item.id]);
    if (targets.length === 0) return;

    const savingFlags: Record<string, boolean> = {};
    targets.forEach((t) => {
      savingFlags[t.id] = true;
    });
    setSavingIds((prev) => ({ ...prev, ...savingFlags }));

    try {
      await Promise.all(
        targets.map((schedule) =>
          saveEmployeeSchedule(
            {
              id: schedule.id,
              monthKey: schedule.monthKey,
              employeeName: schedule.employeeName,
              department: schedule.department,
              shift: schedule.shift,
              days: draftDaysMap[schedule.id],
            },
            user.uid,
            true
          )
        )
      );
      setDraftDaysMap({});
      setFeedback({
        type: 'success',
        message: `${targets.length} escala(s) atualizada(s) com sucesso.`,
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Erro ao salvar alterações pendentes. Tente novamente.',
      });
    } finally {
      setSavingIds({});
    }
  };

  const handleDeleteRow = async (schedule: EmployeeScheduleRecord) => {
    setDeletingId(schedule.id);
    setFeedback(null);
    try {
      await deleteEmployeeSchedule(schedule.id);
      setConfirmDeleteId(null);
      setDraftDaysMap((prev) => {
        const next = { ...prev };
        delete next[schedule.id];
        return next;
      });
      setFeedback({
        type: 'success',
        message: `${schedule.employeeName} removido(a) da escala de ${monthTitle}.`,
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Não foi possível remover este funcionário.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Loading auth state
  if (!authReady || checkingRole) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">Verificando acesso do encarregado...</p>
      </section>
    );
  }

  // Not signed in: Username + Password form (primary) & Google Sign-In (secondary)
  if (!user) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 max-w-md mx-auto space-y-5">
        <div className="flex items-start gap-3.5">
          <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#143B63]/10 text-[#143B63]">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Acesso do Encarregado
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Informe seu usuário e senha de encarregado para gerenciar as escalas.
            </p>
          </div>
        </div>

        {authError && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handlePasswordSignIn} className="space-y-3.5">
          <div>
            <label
              htmlFor="admin-username"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Usuário
            </label>
            <input
              id="admin-username"
              type="text"
              autoComplete="username"
              required
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Ex.: denilson.gom"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#143B63] focus:outline-none focus:ring-2 focus:ring-[#143B63]/15"
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Senha
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Digite sua senha"
                className="w-full rounded-lg border border-slate-300 bg-white pl-3.5 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#143B63] focus:outline-none focus:ring-2 focus:ring-[#143B63]/15"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={signingIn || signingInGoogle}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#143B63] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0F2F50] disabled:opacity-60 transition-colors"
          >
            <Lock className="h-4 w-4" />
            {signingIn ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-slate-200" />
          <span className="mx-3 shrink text-[11px] font-medium text-slate-400">ou</span>
          <div className="flex-grow border-t border-slate-200" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={signingIn || signingInGoogle}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
        >
          <ShieldCheck className="h-4 w-4 text-[#143B63]" />
          {signingInGoogle ? 'Abrindo login Google...' : 'Entrar com Google (Administrador)'}
        </button>
      </section>
    );
  }

  // Signed in, but not yet authorized as supervisor
  if (!isSupervisor) {
    const displayId = formatSupervisorIdentifier(user.email);
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 max-w-lg mx-auto space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              Usuário aguardando liberação
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Você entrou como <span className="font-semibold text-slate-900">{displayId}</span>, mas este usuário ainda precisa ser autorizado pelo administrador para editar escalas.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Seu identificador (UID) para liberação
          </p>
          <div className="flex items-center justify-between gap-2">
            <code className="font-mono text-xs text-slate-800 break-all">{user.uid}</code>
            <button
              type="button"
              onClick={() => void handleCopyUid(user.uid)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 shrink-0"
            >
              {copiedUid ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copiar UID
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair e trocar conta
          </button>
        </div>
      </section>
    );
  }

  const sessionIdentifier = formatSupervisorIdentifier(user.email);

  // Authorized supervisor workspace
  return (
    <div className="space-y-6">
      {/* Supervisor Session Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white px-5 py-3.5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sessão de Encarregado
          </p>
          <p className="mt-0.5 text-sm font-medium text-slate-900 truncate">
            {user.displayName || sessionIdentifier || 'Encarregado'}
            {user.displayName && sessionIdentifier ? (
              <span className="font-normal text-slate-500"> · {sessionIdentifier}</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {schedules.length > 0 && (
            <button
              type="button"
              onClick={() => void downloadStandardExcelTemplate(year, month, schedules)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-[#143B63]" />
              Exportar escala atual (.xlsx)
            </button>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-700" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Fechar aviso"
            className="text-current opacity-60 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Section 1: Standard Spreadsheet & Automatic Import */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-[#143B63]" />
              Planilha Padrão e Importação Automática
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Baixe o modelo pronto de {monthTitle}, preencha no Excel ou Google Planilhas e anexe abaixo para preencher tudo automaticamente.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void downloadStandardExcelTemplate(year, month)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#143B63] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#0F2F50] transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Baixar Planilha Padrão (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => downloadStandardCsvTemplate(year, month)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Modelo (.csv)
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Code Reference Strip */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Códigos aceitos na planilha:</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-xs bg-slate-300" />
              <strong className="font-mono text-slate-900">vazio / T</strong>
              <span>Trabalho</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-xs bg-emerald-600" />
              <strong className="font-mono text-slate-900">DS / F</strong>
              <span>Folga</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-xs bg-amber-500" />
              <strong className="font-mono text-slate-900">FR</strong>
              <span>Feriado</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-xs bg-sky-600" />
              <strong className="font-mono text-slate-900">FE</strong>
              <span>Férias</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-xs bg-rose-600" />
              <strong className="font-mono text-slate-900">A</strong>
              <span>Afastamento</span>
            </span>
          </div>

          {/* File Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0] || null;
              void handleFileSelected(file);
            }}
            className={`rounded-lg border border-dashed px-5 py-6 text-center transition-colors ${
              isDragging
                ? 'border-[#143B63] bg-slate-50'
                : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              id="schedule-spreadsheet-upload"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                void handleFileSelected(file);
              }}
            />
            <Upload className="mx-auto h-6 w-6 text-[#143B63]" />
            <p className="mt-2 text-sm font-medium text-slate-900">
              Arraste a planilha preenchida aqui ou selecione do computador
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Compatível com a planilha atual da empresa (ESCALA MENSAL com DS/FR e vários meses lado a lado) em .xlsx, .xls ou .csv
            </p>
            <label
              htmlFor="schedule-spreadsheet-upload"
              className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              Anexar Planilha
            </label>
          </div>

          {/* Parse Error */}
          {parseError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Não foi possível ler "{importFileName}"</p>
                <p className="mt-0.5">{parseError}</p>
              </div>
            </div>
          )}

          {/* Multi-Month Parsed Preview */}
          {parsedMonths && parsedMonths.length > 0 && (() => {
            const activeBlock = parsedMonths[activePreviewIdx] || parsedMonths[0];
            const selectedBlocks = parsedMonths.filter((_, idx) =>
              selectedImportIndexes.includes(idx)
            );
            const totalSelectedRecords = selectedBlocks.reduce(
              (acc, b) => acc + b.rows.length,
              0
            );
            const yearOptions = Array.from({ length: 7 }, (_, i) => year - 1 + i);

            return (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Pré-visualização: {parsedMonths.length}{' '}
                      {parsedMonths.length === 1 ? 'mês detectado' : 'meses detectados'} em "
                      {importFileName}"
                    </p>
                    <p className="text-xs text-slate-600">
                      Todos os meses encontrados na planilha serão registrados automaticamente nos respectivos calendários.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleCancelImport}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={publishingImport || selectedBlocks.length === 0}
                      onClick={handlePublishImport}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {publishingImport
                        ? 'Publicando...'
                        : `Publicar ${selectedBlocks.length} ${
                            selectedBlocks.length === 1 ? 'mês' : 'meses'
                          } (${totalSelectedRecords})`}
                    </button>
                  </div>
                </div>

                {/* Detected Months Selector Strip */}
                <div className="border-b border-slate-200 bg-white px-4 py-3 flex flex-wrap gap-2">
                  {parsedMonths.map((block, idx) => {
                    const isChecked = selectedImportIndexes.includes(idx);
                    const isActiveTab = idx === activePreviewIdx;
                    const blockYears = yearOptions.includes(block.year)
                      ? yearOptions
                      : [...yearOptions, block.year].sort((a, b) => a - b);

                    return (
                      <div
                        key={`${block.monthKey}-${idx}`}
                        className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                          isActiveTab
                            ? 'border-[#143B63] bg-slate-50'
                            : 'border-slate-200 bg-white hover:bg-slate-50/70'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleImportMonth(idx)}
                          aria-label={`Incluir ${block.monthLabel} de ${block.year}`}
                          className="rounded border-slate-300 text-[#143B63] focus:ring-[#143B63]"
                        />
                        <button
                          type="button"
                          onClick={() => setActivePreviewIdx(idx)}
                          className={`font-semibold ${
                            isChecked ? 'text-slate-900' : 'text-slate-400 line-through'
                          }`}
                        >
                          {block.monthLabel}
                        </button>
                        <select
                          aria-label={`Ano de ${block.monthLabel}`}
                          value={block.year}
                          onChange={(e) =>
                            handleChangeImportMonthYear(idx, Number(e.target.value))
                          }
                          className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700 focus:border-[#143B63] focus:outline-none"
                        >
                          {blockYears.map((yr) => (
                            <option key={yr} value={yr}>
                              {yr}
                            </option>
                          ))}
                        </select>
                        <span className="text-[11px] text-slate-500">
                          · {block.rows.length} colab.
                        </span>
                      </div>
                    );
                  })}
                </div>

                {parseWarnings.length > 0 && (
                  <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 space-y-1">
                    {parseWarnings.map((warn, idx) => (
                      <p key={idx}>• {warn}</p>
                    ))}
                  </div>
                )}

                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="px-4 py-2 font-semibold">
                          Colaborador ({activeBlock.monthLabel}/{activeBlock.year})
                        </th>
                        <th className="px-4 py-2 font-semibold">Setor · Turno</th>
                        <th className="px-4 py-2 font-semibold text-right">Folgas (DS)</th>
                        <th className="px-4 py-2 font-semibold text-right">Feriados/Outros</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {activeBlock.rows.map((row) => (
                        <tr key={row.docId}>
                          <td className="px-4 py-2 font-medium text-slate-900">
                            {row.employeeName}
                          </td>
                          <td className="px-4 py-2 text-slate-600">
                            {[row.department, row.shift].filter(Boolean).join(' · ') || '—'}
                          </td>
                          <td className="px-4 py-2 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                            {row.offCount}
                          </td>
                          <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-600">
                            {row.specialCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* Section 2: Manual Schedule Builder & Matrix Editor */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              Equipe e Editor da Escala — {monthTitle}
            </h2>
          </div>
          {dirtyIds.length > 0 && (
            <button
              type="button"
              onClick={handleSaveAllDirty}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#143B63] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0F2F50] transition-colors shrink-0 self-start sm:self-auto"
            >
              <Save className="h-3.5 w-3.5" />
              Salvar alterações ({dirtyIds.length})
            </button>
          )}
        </div>

        {/* Add Employee Form */}
        <form
          onSubmit={handleAddEmployee}
          className="border-b border-slate-200 bg-slate-50/70 px-5 py-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 items-end">
            <div className="sm:col-span-4">
              <label
                htmlFor="new-emp-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nome do funcionário
              </label>
              <input
                id="new-emp-name"
                type="text"
                required
                maxLength={80}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex.: Ana Paula Souza"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#143B63] focus:outline-none focus:ring-2 focus:ring-[#143B63]/15"
              />
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="new-emp-dept"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Setor (opcional)
              </label>
              <input
                id="new-emp-dept"
                type="text"
                maxLength={60}
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                placeholder="Ex.: Operações"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#143B63] focus:outline-none focus:ring-2 focus:ring-[#143B63]/15"
              />
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="new-emp-shift"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Turno (opcional)
              </label>
              <input
                id="new-emp-shift"
                type="text"
                maxLength={40}
                value={newShift}
                onChange={(e) => setNewShift(e.target.value)}
                placeholder="Ex.: 08:00 - 17:00"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#143B63] focus:outline-none focus:ring-2 focus:ring-[#143B63]/15"
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={addingEmployee}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#143B63] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#0F2F50] disabled:opacity-60 transition-colors"
              >
                <Plus className="h-4 w-4" />
                {addingEmployee ? 'Salvando...' : 'Adicionar'}
              </button>
            </div>
          </div>
        </form>

        {/* Interactive Matrix */}
        {loadingSchedules ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            Carregando equipe de {monthTitle}...
          </div>
        ) : schedules.length === 0 ? (
          <div className="px-5 py-10 text-center space-y-1">
            <p className="text-sm font-medium text-slate-800">
              Nenhum funcionário cadastrado em {monthTitle}.
            </p>
            <p className="text-xs text-slate-500">
              Anexe a planilha padrão acima ou adicione o primeiro funcionário no formulário.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-600">
                  <th className="sticky left-0 z-10 min-w-52 bg-slate-50 px-4 py-2.5 text-left font-semibold border-r border-slate-200">
                    Funcionário ({schedules.length})
                  </th>
                  {monthDaysInfo.map((d) => (
                    <th
                      key={d.key}
                      className={`min-w-9 px-1 py-2 text-center font-medium ${
                        d.isSunday ? 'bg-slate-100/80 text-slate-900' : ''
                      }`}
                    >
                      <div className="text-[10px] text-slate-400 leading-none">
                        {d.weekdayLetter}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] font-semibold tabular-nums">
                        {d.label}
                      </div>
                    </th>
                  ))}
                  <th className="min-w-24 px-3 py-2.5 text-right font-semibold border-l border-slate-200">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {schedules.map((schedule) => {
                  const activeDays = draftDaysMap[schedule.id] ?? schedule.days;
                  const isDirty = Boolean(draftDaysMap[schedule.id]);
                  const isSaving = Boolean(savingIds[schedule.id]);
                  const isConfirmingDelete = confirmDeleteId === schedule.id;

                  return (
                    <tr
                      key={schedule.id}
                      className={isDirty ? 'bg-amber-50/30' : 'bg-white hover:bg-slate-50/40'}
                    >
                      <td className="sticky left-0 z-10 bg-white px-4 py-2.5 border-r border-slate-200 align-middle">
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => onSelectEmployeePreview(schedule.normalizedName)}
                            className="text-left font-semibold text-slate-900 hover:text-[#143B63] hover:underline truncate block max-w-44"
                            title="Ver calendário individual deste funcionário"
                          >
                            {schedule.employeeName}
                          </button>
                          {(schedule.department || schedule.shift) && (
                            <p className="text-[11px] text-slate-500 truncate max-w-44">
                              {[schedule.department, schedule.shift].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      </td>

                      {monthDaysInfo.map((d) => {
                        const code: ScheduleDayCode = activeDays[d.key] || 'T';
                        const meta = SCHEDULE_DAY_META[code];
                        return (
                          <td
                            key={d.key}
                            className={`px-0.5 py-1.5 text-center ${
                              d.isSunday ? 'bg-slate-50/70' : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleCycleDay(schedule, d.key)}
                              title={`Dia ${d.label}: ${meta.label} (clique para alternar)`}
                              className={`h-7 w-7 rounded border font-mono text-[11px] font-semibold transition-colors ${meta.matrixBtnClass}`}
                            >
                              {code}
                            </button>
                          </td>
                        );
                      })}

                      <td className="px-3 py-2 text-right border-l border-slate-200 whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {isDirty && (
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleSaveRow(schedule)}
                              className="inline-flex items-center gap-1 rounded bg-[#143B63] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#0F2F50] disabled:opacity-60"
                            >
                              <Save className="h-3 w-3" />
                              {isSaving ? '...' : 'Salvar'}
                            </button>
                          )}

                          {!isConfirmingDelete && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditEmployee(schedule)}
                              aria-label={`Editar ${schedule.employeeName}`}
                              title="Editar nome, setor, turno e dias"
                              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 hover:text-[#143B63] transition-colors"
                            >
                              <Pencil className="h-3 w-3" />
                              Editar
                            </button>
                          )}

                          {isConfirmingDelete ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                disabled={deletingId === schedule.id}
                                onClick={() => handleDeleteRow(schedule)}
                                className="rounded bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
                              >
                                {deletingId === schedule.id ? '...' : 'Confirmar'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                              >
                                Não
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(schedule.id)}
                              aria-label={`Remover ${schedule.employeeName}`}
                              title="Remover funcionário deste mês"
                              className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 3: Authorized Supervisors Management (Bootstrapped Admin only) */}
      {isMainAdmin && (
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-[#143B63]" />
              Encarregados Autorizados
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Autorize outros encarregados (como <span className="font-mono text-slate-800">denilson.gom</span>) informando o UID criado no Firebase Console ou exibido no primeiro acesso dele.
            </p>
          </div>

          <form
            onSubmit={handleAddSupervisor}
            className="border-b border-slate-200 bg-slate-50/70 px-5 py-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 items-end">
              <div className="sm:col-span-4">
                <label
                  htmlFor="new-admin-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nome do encarregado
                </label>
                <input
                  id="new-admin-name"
                  type="text"
                  required
                  maxLength={80}
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="Ex.: Denilson"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#143B63] focus:outline-none focus:ring-2 focus:ring-[#143B63]/15"
                />
              </div>

              <div className="sm:col-span-6">
                <label
                  htmlFor="new-admin-uid"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  UID do usuário no Firebase Auth
                </label>
                <input
                  id="new-admin-uid"
                  type="text"
                  required
                  maxLength={128}
                  value={newAdminUid}
                  onChange={(e) => setNewAdminUid(e.target.value)}
                  placeholder="Cole o UID do encarregado"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-[#143B63] focus:outline-none focus:ring-2 focus:ring-[#143B63]/15"
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={savingAdmin}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#143B63] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#0F2F50] disabled:opacity-60 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  {savingAdmin ? 'Salvando...' : 'Autorizar'}
                </button>
              </div>
            </div>
          </form>

          {admins.length === 0 ? (
            <div className="px-5 py-5 text-xs text-slate-500">
              Nenhum encarregado adicional autorizado além da conta principal.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {admins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{admin.displayName}</p>
                    <p className="font-mono text-[11px] text-slate-500 truncate">{admin.id}</p>
                  </div>
                  <button
                    type="button"
                    disabled={removingAdminUid === admin.id}
                    onClick={() => void handleRemoveSupervisor(admin)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 shrink-0"
                  >
                    {removingAdminUid === admin.id ? 'Removendo...' : 'Revogar'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {/* Edit Employee Modal */}
      {editingEmployee && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-employee-modal-title"
        >
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h3
                  id="edit-employee-modal-title"
                  className="font-display text-base font-bold text-slate-900"
                >
                  Editar Funcionário — {monthTitle}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Atualize os dados cadastrais ou clique nos dias abaixo para ajustar a escala.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingEmployee(null)}
                aria-label="Fechar janela de edição"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveEditEmployee}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="p-5 space-y-5 overflow-y-auto">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="edit-emp-name"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Nome do funcionário
                    </label>
                    <input
                      id="edit-emp-name"
                      type="text"
                      required
                      maxLength={80}
                      value={editingEmployee.employeeName}
                      onChange={(e) =>
                        setEditingEmployee((prev) =>
                          prev ? { ...prev, employeeName: e.target.value } : prev
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#143B63] focus:outline-none focus:ring-2 focus:ring-[#143B63]/15"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="edit-emp-dept"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Setor
                    </label>
                    <input
                      id="edit-emp-dept"
                      type="text"
                      maxLength={60}
                      value={editingEmployee.department}
                      onChange={(e) =>
                        setEditingEmployee((prev) =>
                          prev ? { ...prev, department: e.target.value } : prev
                        )
                      }
                      placeholder="Ex.: Sala do transporte"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#143B63] focus:outline-none focus:ring-2 focus:ring-[#143B63]/15"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="edit-emp-shift"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Turno
                    </label>
                    <input
                      id="edit-emp-shift"
                      type="text"
                      maxLength={40}
                      value={editingEmployee.shift}
                      onChange={(e) =>
                        setEditingEmployee((prev) =>
                          prev ? { ...prev, shift: e.target.value } : prev
                        )
                      }
                      placeholder="Ex.: 08:00 - 17:00"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#143B63] focus:outline-none focus:ring-2 focus:ring-[#143B63]/15"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      Dias do mês (clique para alternar)
                    </span>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                      {SCHEDULE_CODE_CYCLE.map((code) => {
                        const meta = SCHEDULE_DAY_META[code];
                        return (
                          <span key={code} className="inline-flex items-center gap-1">
                            <span className={`h-2 w-2 rounded-xs ${meta.legendDotClass}`} />
                            <strong className="font-mono text-slate-900">{code}</strong>
                            <span>{meta.label}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {monthDaysInfo.map((d) => {
                      const code: ScheduleDayCode = editingEmployee.days[d.key] || 'T';
                      const meta = SCHEDULE_DAY_META[code];
                      return (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => handleToggleEditModalDay(d.key)}
                          title={`Dia ${d.label}: ${meta.label}`}
                          className={`rounded-lg border px-1.5 py-2 text-center transition-colors ${meta.matrixBtnClass}`}
                        >
                          <div className="text-[10px] opacity-75 leading-none">
                            {d.weekdayLetter} · {d.label}
                          </div>
                          <div className="mt-1 font-mono text-xs font-bold leading-none">
                            {code}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#143B63] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0F2F50] disabled:opacity-60 transition-colors"
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingEdit ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
