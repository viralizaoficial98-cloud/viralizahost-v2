import { createRpcClient } from '@/lib/supabase/server'

export type BannerPageData = {
  id: string
  page_slug: string
  page_name: string
  breadcrumb: string | null
  breadcrumb_parent: string | null
  breadcrumb_parent_href: string | null
  tag: string | null
  title: string
  subtitle: string
  bg_image: string | null
  bg_color: string
  highlights: string[]
  button_primary_text: string
  button_primary_link: string
  button_secondary_text: string | null
  button_secondary_link: string | null
  price_text: string | null
  show_guarantee: boolean
  overlay_opacity: number
  is_active: boolean
  updated_at: string
}

// Returns null when not found — caller falls back to hardcoded defaults
export async function getBannerPage(slug: string): Promise<BannerPageData | null> {
  try {
    // createRpcClient = service_role, no schema header → need explicit schema via PostgREST
    // We use createAdminClient which has schema viralizahost set
    const { createAdminClient } = await import('@/lib/supabase/server')
    const supabase = await createAdminClient()
    const { data, error } = await (supabase as any)
      .from('banner_pages')
      .select('*')
      .eq('page_slug', slug)
      .eq('is_active', true)
      .single()

    if (error || !data) return null
    return data as BannerPageData
  } catch {
    return null
  }
}

// Used by admin — returns all banners regardless of is_active
export async function getAllBannerPages(): Promise<BannerPageData[]> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/server')
    const supabase = await createAdminClient()
    const { data, error } = await (supabase as any)
      .from('banner_pages')
      .select('*')
      .order('page_name', { ascending: true })

    if (error || !data) return []
    return data as BannerPageData[]
  } catch {
    return []
  }
}
