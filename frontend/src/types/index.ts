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
