import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/LegalPage'

export const metadata: Metadata = { title: 'Política de Privacidade', description: 'Que dados a ViralizaHost guarda, para quê e como os protege.' }

// Descreve os dados que a plataforma efectivamente guarda e como os protege.
export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade" intro="Que dados pessoais guardamos, para quê e como os protegemos.">
      <h2>Dados que recolhemos</h2>
      <ul>
        <li>Conta: nome, e-mail, telefone e palavra-passe (guardada apenas como resumo criptográfico, nunca em texto).</li>
        <li>Facturação: nome ou empresa, NIF e morada indicados no checkout.</li>
        <li>Encomendas, facturas, comprovativos de pagamento e tickets de suporte.</li>
        <li>Serviços: domínios, utilizador cPanel e dados de utilização (disco, contas de e-mail) obtidos do servidor.</li>
      </ul>
      <h2>Para que usamos</h2>
      <ul>
        <li>Processar encomendas, validar pagamentos, activar e renovar serviços.</li>
        <li>Emitir facturas e prestar suporte.</li>
        <li>Segurança da conta e prevenção de abuso.</li>
      </ul>
      <h2>Como protegemos</h2>
      <ul>
        <li>Os comprovativos de pagamento ficam em armazenamento privado, acessíveis só ao próprio cliente e à equipa, por ligações temporárias.</li>
        <li>Não guardamos dados de cartão. Não guardamos senhas do cPanel: o acesso é feito por ligação temporária gerada no momento.</li>
        <li>Códigos de transferência de domínio são guardados cifrados e usados só para a transferência.</li>
      </ul>
      <h2>Cookies e armazenamento no navegador</h2>
      <ul>
        <li>Um cookie de sessão (<code>vh_session</code>) mantém o início de sessão.</li>
        <li>O carrinho de compras fica guardado no seu navegador até concluir ou esvaziar a encomenda.</li>
      </ul>
      <h2>Os seus direitos</h2>
      <ul>
        <li>Pode consultar e corrigir os seus dados em «Configurações» na Área do Cliente e pedir acesso, correcção ou eliminação através do suporte.</li>
      </ul>
    </LegalPage>
  )
}
