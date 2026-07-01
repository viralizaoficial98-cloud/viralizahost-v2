import { Check, type LucideIcon } from 'lucide-react'

interface Feature {
  icon: LucideIcon
  title: string
  desc: string
}

interface IncludedFeaturesProps {
  features: Feature[]
  title?: string
  subtitle?: string
  dark?: boolean
}

export function IncludedFeatures({
  features,
  title = 'Todos os planos incluem',
  subtitle = 'Recursos premium sem custo adicional em todos os planos.',
  dark = false,
}: IncludedFeaturesProps) {
  return (
    <section className={`py-20 ${dark ? 'bg-[#0A0A0A]' : 'bg-white'}`}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className={`section-tag ${dark ? '!bg-yellow-400/10 !text-yellow-400 !border-yellow-400/20' : ''}`}>
            Incluído em todos os planos
          </span>
          <h2 className={`text-3xl md:text-4xl font-black mt-3 mb-3 ${dark ? 'text-white' : 'text-[#0A0A0A]'}`}>
            {title}
          </h2>
          <p className={`max-w-lg mx-auto text-sm md:text-base ${dark ? 'text-gray-500' : 'text-[#666]'}`}>
            {subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {features.map(({ icon: Icon, title: t, desc }) => (
            <div key={t} className={`flex gap-4 p-5 rounded-2xl ${
              dark ? 'bg-[#111] border border-[#1E1E1E]' : 'bg-[#F8F8F8] border border-[#EFEFEF]'
            }`}>
              <div className="w-10 h-10 rounded-xl bg-[#F5B700]/10 flex items-center justify-center shrink-0">
                <Icon size={18} className="text-[#F5B700]" />
              </div>
              <div>
                <div className={`font-semibold text-sm mb-0.5 ${dark ? 'text-white' : 'text-[#0A0A0A]'}`}>{t}</div>
                <div className={`text-xs leading-relaxed ${dark ? 'text-gray-500' : 'text-[#888]'}`}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
