export type UserRole = 'owner' | 'admin' | 'instructor' | 'member'

export interface User {
  id: string
  email: string
  full_name: string
  phone?: string | null
  role: UserRole
  is_active: boolean
  date_of_birth?: string | null
  join_date?: string | null
  created_at: string
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

export interface Page<T> { items: T[]; total: number }

export interface Package {
  id: string
  name: string
  description?: string | null
  is_unlimited: boolean
  session_count?: number | null
  price: number
  validity_days?: number | null
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

export interface PaymentBrief {
  id: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  paid_at?: string | null
  note?: string | null
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
  created_at: string
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
