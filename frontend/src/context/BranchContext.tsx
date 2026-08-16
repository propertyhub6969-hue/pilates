import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { Branch } from '@/types'

interface BranchState {
  branches: Branch[]
  activeId: string
  activeBranch: Branch | null
  setActiveId: (id: string) => void
  isLoading: boolean
}

const Ctx = createContext<BranchState>({} as BranchState)
const KEY = 'ryb_branch'

export function BranchProvider({ children }: { children: ReactNode }) {
  const { data: branches, isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => (await api.get<Branch[]>('/branches')).data,
  })
  const [activeId, setActive] = useState<string>(() => localStorage.getItem(KEY) || '')

  // Pilih cabang default bila belum ada / tak valid
  useEffect(() => {
    if (branches && branches.length) {
      if (!activeId || !branches.find((b) => b.id === activeId)) {
        const def = branches.find((b) => b.is_default) || branches[0]
        setActiveId(def.id)
      }
    }
  }, [branches]) // eslint-disable-line react-hooks/exhaustive-deps

  function setActiveId(id: string) {
    localStorage.setItem(KEY, id)
    setActive(id)
  }

  const activeBranch = branches?.find((b) => b.id === activeId) ?? null

  return (
    <Ctx.Provider value={{ branches: branches ?? [], activeId, activeBranch, setActiveId, isLoading }}>
      {children}
    </Ctx.Provider>
  )
}

export const useBranch = () => useContext(Ctx)
