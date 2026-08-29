import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Home, Receipt, ChartNoAxesCombined, Settings, Plus, X, CalendarDays,
  Check, Pencil, Trash2, Eye, EyeOff, Moon, Sun, Upload, Download,
  Utensils, Car, Gamepad2, ShoppingBag, HeartPulse, Zap, Briefcase,
  GraduationCap, HomeIcon, MoreHorizontal, RotateCcw, Wifi, WifiOff,
  Share2, Smartphone, ArrowDown
} from 'lucide-react'
import './styles.css'

// ─── Service Worker ─────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env?.BASE_URL || ''}sw.js`).catch(console.error)
  })
}

// ─── Constants ──────────────────────────────────────────────────────
const KEY = 'idarat-ratbi-v4'

const defaults = {
  salary: 15000,
  fixed: 4250,
  cycleDay: 27,
  financeStart: '',
}

const CATEGORIES = [
  { id: 'food', label: 'طعام', icon: Utensils, color: '#e67e22' },
  { id: 'transport', label: 'مواصلات', icon: Car, color: '#3498db' },
  { id: 'entertainment', label: 'ترفيه', icon: Gamepad2, color: '#9b59b6' },
  { id: 'shopping', label: 'تسوق', icon: ShoppingBag, color: '#e74c3c' },
  { id: 'health', label: 'صحة', icon: HeartPulse, color: '#2ecc71' },
  { id: 'bills', label: 'فواتير', icon: Zap, color: '#f1c40f' },
  { id: 'work', label: 'عمل', icon: Briefcase, color: '#1abc9c' },
  { id: 'education', label: 'تعليم', icon: GraduationCap, color: '#34495e' },
  { id: 'home', label: 'منزل', icon: HomeIcon, color: '#d35400' },
  { id: 'other', label: 'أخرى', icon: MoreHorizontal, color: '#95a5a6' },
]

// ─── Helpers ────────────────────────────────────────────────────────
const fmt = n => new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.max(0, Number(n) || 0))

const fmtSigned = n => {
  const num = Number(n) || 0
  const sign = num > 0 ? '+' : ''
  return `${sign}${new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)}`
}

const fmtDate = d => new Intl.DateTimeFormat('ar-SA', { calendar: 'gregory', day: 'numeric', month: 'long', year: 'numeric' }).format(d)
const fmtDay = d => new Intl.DateTimeFormat('ar-SA', { calendar: 'gregory', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d)

const toKey = d => {
  const x = new Date(d)
  x.setHours(12, 0, 0, 0)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

const fromKey = s => new Date(`${s}T12:00:00`)

const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  x.setHours(12, 0, 0, 0)
  return x
}

const dayCount = (a, b) => Math.max(0, Math.round((b - a) / 86400000) + 1)

const genId = () => (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`)

const haptic = (ms = 50) => navigator.vibrate?.(ms)

function getCycle(d, cycleDay = 27) {
  const x = new Date(d)
  x.setHours(12, 0, 0, 0)
  let start = new Date(x.getFullYear(), x.getMonth(), cycleDay, 12)
  if (x < start) start = new Date(x.getFullYear(), x.getMonth() - 1, cycleDay, 12)
  return { start, end: new Date(start.getFullYear(), start.getMonth() + 1, cycleDay - 1, 12) }
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    return {
      settings: { ...defaults, ...(saved?.settings || {}) },
      expenses: Array.isArray(saved?.expenses) ? saved.expenses : [],
      darkMode: saved?.darkMode ?? false,
      privacy: saved?.privacy ?? false,
    }
  } catch {
    return { settings: defaults, expenses: [], darkMode: false, privacy: false }
  }
}

function calculateFinance(startDate) {
  if (!startDate) return { done: 0, left: 60, end: null, progress: 0 }
  const start = new Date(`${startDate}T12:00:00`)
  if (Number.isNaN(start.getTime())) return { done: 0, left: 60, end: null, progress: 0 }
  const end = new Date(start.getFullYear(), start.getMonth() + 60, start.getDate(), 12)
  const now = new Date()
  now.setHours(12, 0, 0, 0)
  let done = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) done -= 1
  done = Math.max(0, Math.min(60, done))
  return { done, left: 60 - done, end, progress: (done / 60) * 100 }
}

// ─── Hooks ──────────────────────────────────────────────────────────
function useNetworkStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

function useStandalone() {
  const [standalone, setStandalone] = useState(false)
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator).standalone === true
    setStandalone(isStandalone)
  }, [])
  return standalone
}

function useInstallPrompt() {
  const [prompt, setPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setInstalled(true))
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = useCallback(async () => {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setPrompt(null)
  }, [prompt])

  return { prompt, installed, install }
}

// ─── Toast System ───────────────────────────────────────────────────
const ToastContext = React.createContext(null)

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const add = useCallback((msg, type = 'info', duration = 3000) => {
    const id = genId()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])
  return (
    <ToastContext.Provider value={add}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ─── Network Banner ─────────────────────────────────────────────────
function NetworkBanner({ online }) {
  if (online) return null
  return (
    <div className="network-banner">
      <WifiOff size={16} />
      <span>أنت غير متصل بالإنترنت</span>
    </div>
  )
}

// ─── Install Banner ─────────────────────────────────────────────────
function InstallBanner({ prompt, installed, onInstall, onDismiss }) {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('install-dismissed') === '1')
  if (!prompt || installed || dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    localStorage.setItem('install-dismissed', '1')
    onDismiss?.()
  }

  return (
    <div className="install-banner">
      <Smartphone size={18} />
      <span>ثبّت التطبيق على شاشتك الرئيسية</span>
      <button className="install-btn" onClick={onInstall}>تثبيت</button>
      <button className="dismiss-btn" onClick={dismiss}><X size={14} /></button>
    </div>
  )
}

// ─── App ────────────────────────────────────────────────────────────
function App() {
  const [state, setState] = useState(() => {
    const loaded = load()
    return { ...loaded, darkMode: true }
  })
  const [tab, setTab] = useState('home')
  const [sheet, setSheet] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ amount: '', desc: '', date: toKey(new Date()), category: 'other' })
  const [undoItem, setUndoItem] = useState(null)
  const [ptrRefreshing, setPtrRefreshing] = useState(false)
  const toast = React.useContext(ToastContext)

  const online = useNetworkStatus()
  const standalone = useStandalone()
  const { prompt, installed, install } = useInstallPrompt()

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.darkMode)
  }, [state.darkMode])

  const cycle = useMemo(() => getCycle(new Date(), Number(state.settings.cycleDay) || 27), [state.settings.cycleDay])
  const expenses = useMemo(() => state.expenses.filter(e => {
    const d = fromKey(e.date)
    return d >= cycle.start && d <= cycle.end
  }), [state.expenses, cycle])

  const available = Math.max(0, Number(state.settings.salary) - Number(state.settings.fixed))
  const spent = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const remaining = Math.max(0, available - spent)
  const remainingDays = Math.max(1, dayCount(new Date(Math.max(Date.now(), cycle.start.getTime())), cycle.end))
  const daily = remaining / remainingDays
  const todaySpent = expenses.filter(e => e.date === toKey(new Date())).reduce((sum, e) => sum + Number(e.amount), 0)
  const percentage = available ? (remaining / available) * 100 : 0
  const finance = useMemo(() => calculateFinance(state.settings.financeStart), [state.settings.financeStart])

  const groups = useMemo(() => {
    const map = {}
    expenses.forEach(e => { if (!map[e.date]) map[e.date] = []; map[e.date].push(e) })
    return Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([dateKey, items]) => ({ date: dateKey, total: items.reduce((s, e) => s + Number(e.amount), 0), items }))
  }, [expenses])

  const openAdd = useCallback(() => {
    setEditId(null)
    setForm({ amount: '', desc: '', date: toKey(new Date()), category: 'other' })
    setSheet(true)
  }, [])

  const openEdit = useCallback((expense) => {
    setEditId(expense.id)
    setForm({ amount: expense.amount, desc: expense.desc, date: expense.date, category: expense.category || 'other' })
    setSheet(true)
  }, [])

  const closeSheet = useCallback(() => {
    setSheet(false)
    setEditId(null)
    setForm({ amount: '', desc: '', date: toKey(new Date()), category: 'other' })
  }, [])

  const saveExpense = useCallback(() => {
    const amount = Number(form.amount)
    if (!amount || amount <= 0 || !form.date) return
    const item = { id: editId || genId(), amount, desc: form.desc.trim(), date: form.date, category: form.category || 'other' }
    setState(current => ({
      ...current,
      expenses: editId
        ? current.expenses.map(e => (e.id === editId ? item : e))
        : [...current.expenses, item],
    }))
    haptic(40)
    toast(editId ? 'تم تعديل المصروف' : 'تم إضافة المصروف', 'success')
    closeSheet()
  }, [form, editId, closeSheet, toast])

  const deleteExpense = useCallback((id) => {
    const item = state.expenses.find(e => e.id === id)
    if (!item) return
    setState(current => ({ ...current, expenses: current.expenses.filter(e => e.id !== id) }))
    setUndoItem(item)
    haptic(60)
    toast('تم الحذف — اضغط للتراجع', 'warning', 4000)
    setTimeout(() => setUndoItem(null), 4000)
  }, [state.expenses, toast])

  const undoDelete = useCallback(() => {
    if (!undoItem) return
    setState(current => ({ ...current, expenses: [...current.expenses, undoItem] }))
    setUndoItem(null)
    toast('تم التراجع عن الحذف', 'success')
  }, [undoItem, toast])

  const togglePrivacy = useCallback(() => {
    setState(c => ({ ...c, privacy: !c.privacy }))
  }, [])

  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `idarat-backup-${toKey(new Date())}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast('تم تصدير البيانات', 'success')
  }, [state, toast])

  const importData = useCallback((file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        if (data.settings && Array.isArray(data.expenses)) {
          setState(data)
          toast('تم استيراد البيانات بنجاح', 'success')
        } else {
          toast('ملف غير صالح', 'error')
        }
      } catch {
        toast('فشل في قراءة الملف', 'error')
      }
    }
    reader.readAsText(file)
  }, [toast])

  // Pull-to-refresh
  const mainRef = useRef(null)
  const ptrStartY = useRef(0)
  const ptrStartX = useRef(0)

  const onPtrTouchStart = useCallback((e) => {
    const main = mainRef.current
    if (!main || main.scrollTop > 0) return
    ptrStartY.current = e.touches[0].clientY
    ptrStartX.current = e.touches[0].clientX
  }, [])

  const onPtrTouchMove = useCallback((e) => {
    if (ptrRefreshing) return
    const main = mainRef.current
    if (!main || main.scrollTop > 0) return
    const dy = e.touches[0].clientY - ptrStartY.current
    const dx = e.touches[0].clientX - ptrStartX.current
    if (dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      const pull = Math.min(dy * 0.4, 80)
      main.style.transform = `translateY(${pull}px)`
      main.style.transition = 'none'
    }
  }, [ptrRefreshing])

  const onPtrTouchEnd = useCallback(() => {
    const main = mainRef.current
    if (!main) return
    const dy = ptrStartY.current ? (parseFloat(main.style.transform?.replace('translateY(', '') || 0)) : 0
    main.style.transition = 'transform 0.3s ease'
    main.style.transform = 'translateY(0)'
    if (dy > 50) {
      setPtrRefreshing(true)
      setTimeout(() => {
        setPtrRefreshing(false)
        toast('تم التحديث', 'success', 1500)
      }, 1200)
    }
  }, [toast])

  return (
    <div className={`app ${state.darkMode ? 'dark' : ''}`}>
      <NetworkBanner online={online} />
      <InstallBanner prompt={prompt} installed={installed} onInstall={install} />

      {ptrRefreshing && (
        <div className="ptr-spinner">
          <div className="ptr-dot" />
          <div className="ptr-dot" />
          <div className="ptr-dot" />
        </div>
      )}

      <main
        ref={mainRef}
        onTouchStart={onPtrTouchStart}
        onTouchMove={onPtrTouchMove}
        onTouchEnd={onPtrTouchEnd}
      >
        {tab === 'home' && (
          <HomePage
            cycle={cycle}
            remaining={remaining}
            available={available}
            percentage={percentage}
            daily={daily}
            todaySpent={todaySpent}
            remainingDays={remainingDays}
            spent={spent}
            finance={finance}
            financeStart={state.settings.financeStart}
            openAdd={openAdd}
            privacy={state.privacy}
            togglePrivacy={togglePrivacy}
            darkMode={state.darkMode}
            standalone={standalone}
          />
        )}
        {tab === 'log' && (
          <ExpensePage
            groups={groups}
            spent={spent}
            onEdit={openEdit}
            onDelete={deleteExpense}
            privacy={state.privacy}
            undoItem={undoItem}
            onUndo={undoDelete}
          />
        )}
        {tab === 'stats' && (
          <StatsPage
            cycle={cycle}
            expenses={expenses}
            spent={spent}
            remaining={remaining}
            settings={state.settings}
            privacy={state.privacy}
          />
        )}
        {tab === 'settings' && (
          <SettingsPage
            settings={state.settings}
            onSave={settings => setState(current => ({ ...current, settings }))}
            exportData={exportData}
            importData={importData}
            darkMode={state.darkMode}
            standalone={standalone}
          />
        )}
      </main>

      <nav className="bottom-nav" aria-label="التنقل الرئيسي">
        {[
          [Home, 'home', 'الرئيسية'],
          [Receipt, 'log', 'المصروفات'],
          [ChartNoAxesCombined, 'stats', 'الإحصائيات'],
          [Settings, 'settings', 'الإعدادات'],
        ].map(([Icon, key, label]) => (
          <button key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {sheet && (
        <ExpenseSheet
          form={form}
          setForm={setForm}
          edit={Boolean(editId)}
          onClose={closeSheet}
          onSave={saveExpense}
        />
      )}
    </div>
  )
}

// ─── Header ─────────────────────────────────────────────────────────
const Header = React.memo(function Header({ title, sub, actions }) {
  return (
    <header>
      <div className="header-row">
        <div>
          <h1>{title}</h1>
          <p>{sub}</p>
        </div>
        {actions && <div className="header-actions">{actions}</div>}
      </div>
    </header>
  )
})

// ─── HomePage ───────────────────────────────────────────────────────
const HomePage = React.memo(function HomePage({ cycle, remaining, available, percentage, daily, todaySpent, remainingDays, spent, finance, financeStart, openAdd, privacy, togglePrivacy, darkMode, standalone }) {
  const r = 82
  const circumference = 2 * Math.PI * r
  const dash = circumference * Math.max(0, Math.min(100, percentage)) / 100
  const overBudget = todaySpent > daily

  return (
    <section>
      <Header
        title="إدارة الراتب"
        sub={`دورة ${fmtDate(cycle.start)} — ${fmtDate(cycle.end)}`}
        actions={
          <>
            <button className="icon-btn" onClick={togglePrivacy} aria-label="إخفاء المبالغ">
              {privacy ? <Eye size={20} /> : <EyeOff size={20} />}
            </button>
          </>
        }
      />

      <div className={`balance ${overBudget ? 'over-budget' : ''}`}>
        <span>المتبقي</span>
        <b>{privacy ? '****' : fmt(remaining)} <i>ريال</i></b>
        <div className="ring">
          <svg viewBox="0 0 200 200">
            <defs>
              <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#60a5fa" />
              </linearGradient>
            </defs>
            <circle className="bg" cx="100" cy="100" r={r} />
            <circle className="val" cx="100" cy="100" r={r} strokeDasharray={`${dash} ${circumference - dash}`} />
          </svg>
          <div>
            <strong>{Math.round(percentage)}%</strong>
            <small>متبقي</small>
          </div>
        </div>
        <em>من أصل {privacy ? '****' : fmt(available)} ريال متاح</em>
      </div>

      <div className={`daily ${overBudget ? 'over-budget' : ''}`}>
        <span>المتاح بعد صرف اليوم</span>
        <strong>{privacy ? '****' : fmt(Math.max(0, daily - todaySpent))} <i>ريال</i></strong>
        <small>
          حد الصرف اليومي
          <b>{privacy ? '****' : fmt(daily)} ريال</b>
        </small>
        {overBudget && <div className="budget-alert">⚠️ تجاوزت حدك اليومي بـ {fmt(todaySpent - daily)} ريال</div>}
      </div>

      <div className="mini">
        <div><span>صرف اليوم</span><b>{privacy ? '****' : fmt(todaySpent)} ريال</b></div>
        <div><span>باقي الأيام</span><b>{remainingDays} يوم</b></div>
        <div><span>مصروفات الدورة</span><b>{privacy ? '****' : fmt(spent)} ريال</b></div>
      </div>

      <button className="add" onClick={openAdd}>
        <Plus size={21} />
        إضافة مصروف
      </button>

      <FinanceCard finance={finance} financeStart={financeStart} privacy={privacy} />
    </section>
  )
})

// ─── FinanceCard ────────────────────────────────────────────────────
const FinanceCard = React.memo(function FinanceCard({ finance, financeStart, privacy }) {
  return (
    <div className="finance-card">
      <div className="finance-head">
        <div>
          <span>التمويل</span>
          <h2>{finance.left} <small>شهر متبقي</small></h2>
        </div>
      </div>
      <div className="finance-progress"><div className="finance-progress-value" style={{ width: `${finance.progress}%` }} /></div>
      <div className="finance-stats">
        <div><span className="green-dot" /><div><b className="green">{finance.done}</b><small>شهر مضت</small></div></div>
        <div><span className="red-dot" /><div><b className="red">{finance.left}</b><small>شهر متبقي</small></div></div>
        <div><div><b>60</b><small>إجمالي الأشهر</small></div></div>
      </div>
      <div className="finance-dates">
        <div><span>البداية</span><b>{financeStart ? fmtDate(fromKey(financeStart)) : '—'}</b></div>
        <div><span>النهاية</span><b>{finance.end ? fmtDate(finance.end) : '—'}</b></div>
      </div>
    </div>
  )
})

// ─── ExpensePage ──────────────────────────────────────────────────────
const ExpensePage = React.memo(function ExpensePage({ groups, spent, onEdit, onDelete, privacy, undoItem, onUndo }) {
  const [swipedId, setSwipedId] = useState(null)
  const touchStart = useRef({ x: 0, y: 0 })

  const onTouchStart = (e) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  const onTouchEnd = (e, id) => {
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    if (Math.abs(dx) > Math.abs(dy) && dx < -60) setSwipedId(id)
    else if (Math.abs(dx) > Math.abs(dy) && dx > 40) setSwipedId(null)
  }

  const shareExpense = async (expense) => {
    const cat = CATEGORIES.find(c => c.id === expense.category) || CATEGORIES[9]
    const text = `💰 مصروف: ${expense.desc || 'مصروف'}\n💵 المبلغ: ${fmt(expense.amount)} ريال\n📅 التاريخ: ${fmtDate(fromKey(expense.date))}\n🏷️ الفئة: ${cat.label}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'مصروف — إدارة راتبي', text })
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text)
      // toast would need context here, skipping for simplicity
    }
  }

  return (
    <section>
      <Header title="المصروفات" sub={`إجمالي الدورة: ${privacy ? '****' : fmt(spent)} ريال`} />

      {undoItem && (
        <div className="undo-bar">
          <span>تم حذف مصروف</span>
          <button onClick={onUndo}><RotateCcw size={16} /> تراجع</button>
        </div>
      )}

      {!groups.length ? (
        <div className="empty">لا توجد مصروفات في هذه الدورة.</div>
      ) : groups.map(group => (
        <div className="day" key={group.date}>
          <div className="dayhead">
            <span>{fmtDay(fromKey(group.date))}</span>
            <b>{privacy ? '****' : fmt(group.total)} ريال</b>
          </div>
          {group.items.map(expense => {
            const cat = CATEGORIES.find(c => c.id === expense.category) || CATEGORIES[9]
            const CatIcon = cat.icon
            const isSwiped = swipedId === expense.id
            return (
              <div
                key={expense.id}
                className={`swipe-row ${isSwiped ? 'swiped' : ''}`}
                onTouchStart={onTouchStart}
                onTouchEnd={e => onTouchEnd(e, expense.id)}
              >
                <div className="swipe-actions">
                  <button className="swipe-share" onClick={() => shareExpense(expense)}><Share2 size={16} /></button>
                  <button className="swipe-edit" onClick={() => { onEdit(expense); setSwipedId(null) }}><Pencil size={16} /></button>
                  <button className="swipe-delete" onClick={() => { onDelete(expense.id); setSwipedId(null) }}><Trash2 size={16} /></button>
                </div>
                <div className="row" onClick={() => setSwipedId(null)}>
                  <span className="row-cat" style={{ background: cat.color + '20', color: cat.color }}>
                    <CatIcon size={14} /> {cat.label}
                  </span>
                  <span className="row-desc">{expense.desc || 'مصروف'}</span>
                  <b>{privacy ? '****' : fmt(expense.amount)} ريال</b>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </section>
  )
})

// ─── StatsPage ──────────────────────────────────────────────────────
const StatsPage = React.memo(function StatsPage({ cycle, expenses, spent, remaining, settings, privacy }) {
  const totalDays = dayCount(cycle.start, cycle.end)
  const rows = Array.from({ length: totalDays }, (_, i) => {
    const d = addDays(cycle.start, i)
    const k = toKey(d)
    const value = expenses.filter(e => e.date === k).reduce((sum, e) => sum + Number(e.amount), 0)
    return { date: d, value }
  })
  const max = Math.max(0, ...rows.map(r => r.value))
  const nonZero = rows.filter(r => r.value > 0)
  const highest = nonZero.length ? Math.max(...nonZero.map(r => r.value)) : 0
  const lowest = nonZero.length ? Math.min(...nonZero.map(r => r.value)) : 0

  const catMap = {}
  expenses.forEach(e => {
    const c = e.category || 'other'
    catMap[c] = (catMap[c] || 0) + Number(e.amount)
  })
  const catEntries = Object.entries(catMap).sort((a, b) => b[1] - a[1])

  return (
    <section>
      <Header title="الإحصائيات" sub="كامل الدورة المالية" />
      <div className="stats">
        <div><span>الراتب</span><b>{privacy ? '****' : fmt(settings.salary)} ريال</b></div>
        <div><span>الثابت</span><b>{privacy ? '****' : fmt(settings.fixed)} ريال</b></div>
        <div><span>المصروفات</span><b>{privacy ? '****' : fmt(spent)} ريال</b></div>
        <div><span>المتبقي</span><b>{privacy ? '****' : fmt(remaining)} ريال</b></div>
      </div>

      {catEntries.length > 0 && (
        <div className="cat-breakdown">
          <h3>حسب الفئة</h3>
          {catEntries.map(([cid, val]) => {
            const cat = CATEGORIES.find(c => c.id === cid) || CATEGORIES[9]
            const pct = (val / spent) * 100
            const CatIcon = cat.icon
            return (
              <div key={cid} className="cat-row">
                <div className="cat-info">
                  <span className="cat-icon" style={{ background: cat.color + '20', color: cat.color }}><CatIcon size={16} /></span>
                  <span>{cat.label}</span>
                </div>
                <div className="cat-bar-wrap">
                  <div className="cat-bar" style={{ width: `${pct}%`, background: cat.color }} />
                </div>
                <b>{privacy ? '****' : fmt(val)} ريال</b>
              </div>
            )
          })}
        </div>
      )}

      <div className="chart">
        <h3>المصروفات اليومية</h3>
        <div className="bars">
          {rows.map(row => (
            <div key={toKey(row.date)} title={`${fmt(row.value)} ريال`}>
              <i style={{ height: `${max ? Math.max(3, row.value / max * 100) : 3}%` }} />
              <small>{row.date.getDate()}</small>
            </div>
          ))}
        </div>
      </div>
      <div className="high">
        <div><span>متوسط الصرف</span><b>{privacy ? '****' : fmt(spent / totalDays)} ريال</b></div>
        <div><span>أعلى يوم</span><b>{highest ? `${privacy ? '****' : fmt(highest)} ريال` : '—'}</b></div>
        <div><span>أقل يوم</span><b>{lowest ? `${privacy ? '****' : fmt(lowest)} ريال` : '—'}</b></div>
      </div>
    </section>
  )
})

// ─── SettingsPage ───────────────────────────────────────────────────
const SettingsPage = React.memo(function SettingsPage({ settings, onSave, exportData, importData, darkMode, standalone }) {
  const [form, setForm] = useState(settings)
  const fileRef = useRef(null)
  const available = Math.max(0, Number(form.salary) - Number(form.fixed))
  const finance = calculateFinance(form.financeStart)

  useEffect(() => setForm(settings), [settings])

  return (
    <section>
      <Header title="إعدادات" sub="البيانات الأساسية للدورة المالية" />
      <div className="form">
        <label>الراتب الشهري<input type="number" inputMode="decimal" value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} /></label>
        <label>المصاريف الشهرية الثابتة<input type="number" inputMode="decimal" value={form.fixed} onChange={e => setForm({ ...form, fixed: e.target.value })} /></label>
        <label>بداية الدورة المالية<input type="number" min="1" max="28" value={form.cycleDay} onChange={e => setForm({ ...form, cycleDay: e.target.value })} /></label>
        <label>تاريخ بداية التمويل<input type="date" value={form.financeStart || ''} onChange={e => setForm({ ...form, financeStart: e.target.value })} /></label>

        <div className="finance-setting">
          <div><span>مدة التمويل</span><b>60 شهر</b></div>
          <div><span>الأشهر المنقضية</span><b className="green">{finance.done} شهر</b></div>
          <div><span>الأشهر المتبقية</span><b className="red">{finance.left} شهر</b></div>
          <div><span>تاريخ النهاية</span><b>{finance.end ? fmtDate(finance.end) : '—'}</b></div>
        </div>

        <div className="available"><span>المتاح بعد المصاريف الثابتة</span><b>{fmt(available)} ريال</b></div>

        {!standalone && (
          <div className="standalone-info">
            <Smartphone size={16} />
            <span>لتثبيت التطبيق: افتح القائمة في المتصفح واختر "إضافة إلى الشاشة الرئيسية"</span>
          </div>
        )}

        <button className="primary" onClick={() => onSave({
          salary: Number(form.salary) || 0,
          fixed: Number(form.fixed) || 0,
          cycleDay: Number(form.cycleDay) || 27,
          financeStart: form.financeStart || '',
        })}>
          <Check size={19} /> حفظ التغييرات
        </button>
      </div>
    </section>
  )
})

// ─── ExpenseSheet ───────────────────────────────────────────────────
const ExpenseSheet = React.memo(function ExpenseSheet({ form, setForm, edit, onClose, onSave }) {
  const sheetRef = useRef(null)
  const touchStartY = useRef(0)

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const onTouchStart = e => { touchStartY.current = e.touches[0].clientY }
  const onTouchEnd = e => {
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (dy > 80) onClose()
  }

  return (
    <div className="veil sheetveil" onClick={e => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true">
      <div className="sheet" ref={sheetRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="handle" />
        <div className="sheethead">
          <h2>{edit ? 'تعديل مصروف' : 'إضافة مصروف'}</h2>
          <button onClick={onClose}><X /></button>
        </div>

        <label>المبلغ (ريال)<input autoFocus type="number" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label>

        <label>التاريخ<div className="date"><CalendarDays size={18} /><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div></label>

        <label>ملاحظات <small>اختياري</small><input type="text" value={form.desc} placeholder="سجّل ملاحظة..." onChange={e => setForm({ ...form, desc: e.target.value })} /></label>

        <button className="primary" onClick={onSave}>{edit ? 'حفظ التعديل' : 'حفظ المصروف'}</button>
      </div>
    </div>
  )
})

// ─── Render ─────────────────────────────────────────────────────────
createRoot(document.getElementById('root')).render(
  <ToastProvider>
    <App />
  </ToastProvider>
)
