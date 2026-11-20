import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/LegalPage'

export const metadata: Metadata = { title: 'Termos de Serviço', description: 'Como funcionam as compras, pagamentos, activação e renovação na ViralizaHost.' }

// Descreve o funcionamento real da loja (preços, pagamento, activação, renovação).
export default function TermsPage() {
  return (
    <LegalPage title="Termos de Serviço" intro="Resumo das condições de compra e utilização dos serviços ViralizaHost.">
      <h2>Preços e moeda</h2>
      <ul>
        <li>Os preços são apresentados e cobrados em kwanzas (Kz). O valor final é sempre o que aparece na revisão da encomenda, calculado pelos nossos sistemas no momento da compra.</li>
        <li>Quando aplicável, o imposto é indicado em linha separada antes de confirmar.</li>
        <li>Cada plano indica o valor cobrado por ciclo (mensal, 6 meses, 1, 2 ou 3 anos) e o valor de renovação. O valor de renovação aceite na compra fica registado na encomenda.</li>
        <li>Planos «sob consulta» não são vendidos online: a equipa comercial envia uma proposta.</li>
      </ul>
      <h2>Pagamento</h2>
      <ul>
        <li>O pagamento é feito por transferência bancária para os dados indicados no checkout e na factura.</li>
        <li>A encomenda fica pendente até a equipa validar o comprovativo. Um comprovativo recusado não activa o serviço; pode enviar outro na factura.</li>
        <li>Pagamentos em duplicado de uma mesma encomenda são detectados e não geram novos serviços.</li>
      </ul>
      <h2>Activação</h2>
      <ul>
        <li>Os serviços só são activados depois de o pagamento ser confirmado.</li>
        <li>Alojamento e e-mail são activados automaticamente quando o servidor está disponível. Domínios, servidores VPS e dedicados podem exigir activação manual pela equipa; o estado aparece na Área do Cliente.</li>
        <li>Se uma activação falhar, a equipa repete-a sem nova cobrança.</li>
        <li>O registo ou transferência de um domínio depende da confirmação de disponibilidade pelo registrador da extensão.</li>
      </ul>
      <h2>Renovação</h2>
      <ul>
        <li>A data de vencimento de cada serviço aparece na Área do Cliente, em «Serviços». A renovação é feita a partir dessa página, pelo valor de renovação indicado.</li>
        <li>O pagamento de uma renovação prolonga o serviço a partir da data de vencimento em curso.</li>
      </ul>
      <h2>Utilização e suporte</h2>
      <ul>
        <li>O cliente é responsável pelos conteúdos alojados e pela guarda das suas credenciais de acesso.</li>
        <li>Operações que não estão disponíveis na Área do Cliente (por exemplo, alterações de DNS de domínios ou reinício de servidores dedicados) são pedidas por ticket de suporte.</li>
      </ul>
    </LegalPage>
  )
}
