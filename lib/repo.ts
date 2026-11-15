import { DEMO } from './config'
import { memoryRepo, type Repo } from './memory'
import { supabaseRepo } from './supabase-repo'

export const repo: Repo = DEMO ? memoryRepo : supabaseRepo
