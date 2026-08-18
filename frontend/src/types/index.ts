export type UserRole = 'owner' | 'admin' | 'instructor' | 'member'
export type MemberCategory = 'bulanan' | 'private' | 'per_datang'

export const CATEGORY_LABEL: Record<MemberCategory, string> = {
  bulanan: 'Bulanan',
  private: 'Private Training',
  per_datang: 'Per Datang',
}
export const CATEGORY_SHORT: Record<MemberCategory, string> = {
  bulanan: 'Bulanan', private: 'Private', per_datang: 'Per Datang',
}

export interface User {
  id: string
  email: string
  full_name: string
  phone?: string | null
  role: UserRole
  member_category?: MemberCategory | null
  is_active: boolean
  avatar_path?: string | null
  date_of_birth?: string | null
  join_date?: string | null
  created_at?: string
  updated_at?: string | null
  // Ringkasan kuota (diisi di daftar member)
  active_sessions_remaining?: number | null
  has_unlimited?: boolean
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
}

export const ROLE_LABEL: Record<UserRole, string> = {
  owner: 'Pemilik',
  admin: 'Admin',
  instructor: 'Instruktur',
  member: 'Member',
}

export const STAFF_ROLES: UserRole[] = ['owner', 'admin']
export const isStaff = (r?: UserRole) => !!r && STAFF_ROLES.includes(r)
export const isOwner = (r?: UserRole) => r === 'owner'

export interface Page<T> { items: T[]; total: number }

export interface Package {
  id: string
  name: string
  description?: string | null
  is_unlimited: boolean
  session_count?: number | null
  price: number
  validity_days?: number | null
  monthly_expiry?: boolean
  is_active: boolean
  created_at: string
}

export type MemberPackageStatus = 'active' | 'used_up' | 'expired' | 'frozen' | 'cancelled'
export type PaymentMethod = 'cash' | 'transfer' | 'qris' | 'card' | 'other'
export type PaymentStatus = 'paid' | 'pending' | 'refunded'

export interface MemberPackage {
  id: string
  package_name: string
  is_unlimited: boolean
  sessions_total?: number | null
  sessions_remaining?: number | null
  price_paid: number
  purchased_at: string
  expires_at?: string | null
  status: MemberPackageStatus
}

export interface PackageUsage {
  session_date: string
  start_time: string
  title: string
  status: BookingStatus
  booked_at: string
}

export interface PaymentBrief {
  id: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  paid_at?: string | null
  note?: string | null
  member_package_id?: string | null
  has_proof?: boolean
  created_at: string
}

export interface MemberDetail extends User {
  emergency_contact?: string | null
  notes?: string | null
  packages: MemberPackage[]
  payments: PaymentBrief[]
  active_sessions_remaining?: number | null
  has_unlimited: boolean
}

export interface PaymentRow {
  id: string
  member_id: string
  member_name?: string | null
  package_name?: string | null
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  paid_at?: string | null
  note?: string | null
  has_proof?: boolean
  created_at: string
}

// ── Keuangan ──
export type AccountType = 'cash' | 'bank'
export type ExpenseCategory = string  // key kategori (bawaan atau tambahan studio)

// Label bawaan sebagai fallback; label sesungguhnya diambil dari API kategori.
export const EXPENSE_CATEGORY_LABEL: Record<string, string> = {
  sewa: 'Sewa', gaji: 'Gaji / Honor', utilitas: 'Utilitas (listrik/air)', peralatan: 'Peralatan',
  perlengkapan: 'Perlengkapan', marketing: 'Marketing', kebersihan: 'Kebersihan', lainnya: 'Lainnya',
}

export interface ExpenseCategoryRow {
  id: string
  key: string
  label: string
  is_active: boolean
  is_builtin: boolean
  sort_order: number
}

export interface FinancialAccount {
  id: string
  name: string
  type: AccountType
  bank_name?: string | null
  account_number?: string | null
  opening_balance: number
  is_active: boolean
  balance: number
}

export interface ExpenseRow {
  id: string
  expense_date: string
  category: ExpenseCategory
  amount: number
  account_id?: string | null
  account_name?: string | null
  description?: string | null
  created_at: string
  edit_count: number
}

export interface ExpenseEditRow {
  id: string
  edited_by_name?: string | null
  summary?: string | null
  created_at: string
}

export interface LedgerEntry {
  date: string
  kind: 'in' | 'out'
  description: string
  amount: number
  balance: number
}

export interface LedgerResponse {
  account_id: string
  account_name: string
  account_type: AccountType
  opening_balance: number
  starting_balance: number
  total_in: number
  total_out: number
  ending_balance: number
  entries: LedgerEntry[]
}

// ── Cabang ──
export interface Branch {
  id: string
  name: string
  address?: string | null
  phone?: string | null
  cancellation_window_hours: number
  booking_lead_close_hours: number
  is_active: boolean
  is_default: boolean
}

// ── Jadwal & Booking ──
export type ClassSessionStatus = 'scheduled' | 'cancelled' | 'completed'
export type BookingStatus = 'booked' | 'waitlist' | 'attended' | 'cancelled' | 'no_show'

export interface ClassTemplate {
  id: string
  branch_id: string
  name: string
  description?: string | null
  instructor_id?: string | null
  instructor_name?: string | null
  day_of_week: number
  start_time: string
  duration_minutes: number
  capacity: number
  room?: string | null
  is_active: boolean
}

export interface ClassSession {
  id: string
  branch_id: string
  branch_name?: string | null
  title: string
  instructor_id?: string | null
  instructor_name?: string | null
  session_date: string
  start_time: string
  duration_minutes: number
  capacity: number
  room?: string | null
  status: ClassSessionStatus
  notes?: string | null
  booked_count: number
  waitlist_count: number
  my_booking_status?: BookingStatus | null
  my_booking_id?: string | null
  slots_remaining: number
  booking_state: 'not_open' | 'open' | 'full' | 'closed' | 'cancelled'
  booking_opens_at?: string | null
  booking_closes_at?: string | null
  can_book: boolean
  bulanan_count: number
  is_underfilled: boolean
}

export interface BookingRow {
  id: string
  session_id: string
  member_id: string
  member_name?: string | null
  status: BookingStatus
  waitlist_position?: number | null
  booked_at: string
  checked_in_at?: string | null
}

export interface MyBooking {
  id: string
  status: BookingStatus
  waitlist_position?: number | null
  session: ClassSession
}

export const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  booked: 'Terdaftar', waitlist: 'Waitlist', attended: 'Hadir',
  cancelled: 'Dibatalkan', no_show: 'Tidak hadir',
}

export const STATUS_LABEL: Record<MemberPackageStatus, string> = {
  active: 'Aktif', used_up: 'Kuota habis', expired: 'Kedaluwarsa',
  frozen: 'Dibekukan', cancelled: 'Dibatalkan',
}
export const PAY_STATUS_LABEL: Record<PaymentStatus, string> = {
  paid: 'Lunas', pending: 'Menunggu', refunded: 'Refund',
}
export const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Tunai', transfer: 'Transfer', qris: 'QRIS', card: 'Kartu', other: 'Lainnya',
}
