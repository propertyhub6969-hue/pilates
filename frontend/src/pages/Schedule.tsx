import { useAuth } from '@/context/AuthContext'
import { isStaff } from '@/types'
import StaffSchedule from '@/pages/schedule/StaffSchedule'
import MemberSchedule from '@/pages/schedule/MemberSchedule'

export default function Schedule() {
  const { user } = useAuth()
  return isStaff(user?.role) ? <StaffSchedule /> : <MemberSchedule />
}
