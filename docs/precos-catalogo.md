# Catálogo e preços ViralizaHost

Gerado por `scripts/commerce/build-catalog.mjs` a partir de `database/mariadb/pricing/references-2026-11-20.json`.

- **Consulta das fontes:** 2026-11-20T09:40:35Z
- **Regra:** preço ViralizaHost = referência × 2
- **Câmbio:** 1 USD = 913 AKZ — Banco Nacional de Angola — taxa de referência, 2026-11-19 (https://www.bna.ao/service/rest/taxas/get/taxa/referencia?moeda=usd&tipocambio=b)
- **Arredondamento:** arredondamento para cima à centena de kwanzas: ceil(valor / 100) × 100
- **Impostos:** Preços sem impostos. A taxa de IVA é configurável no painel (company_billing_settings.tax_rate, 0 por omissão) e aplicada em separado no checkout. A taxa legal não foi confirmada numa fonte oficial nesta consulta (www.agt.minfin.gov.ao recusou a ligação).
- **Referência:** Serviços recorrentes: referência = preço de renovação publicado pela Hostinger para o mesmo prazo (preço regular, não promocional). O preço promocional de Black Friday exige pré-pagamento de 48 meses (hospedagem/e-mail) ou 24 meses (VPS) e fica registado só para comparação. A Hostinger só publica esse prazo; os restantes ciclos ViralizaHost usam o mesmo valor mensal × número de meses (sem descontos de ciclo inventados). Domínios internacionais: referência = preço normal do 1.º ano (não o promocional), renovação e transferência publicados. Domínios nacionais: referência AngoWeb em AKZ (sem conversão).

## Serviços recorrentes

| Plano ViralizaHost | Referência (fornecedor, plano) | Promo publicada | Renovação publicada (referência) | Cálculo | Preço/mês | Anual (12 meses) | Renovação anual |
|---|---|---|---|---|---|---|---|
| `hosting-start` | [Hostinger Premium](https://www.hostinger.com/web-hosting) | US$ 1.99/mês (pré-pago 48 meses: US$ 95.52) | US$ 10.99/mês | 10.99 × 2 × 913 = 20 067,74 → 20 100 | **20 100 Kz** | 241 200 Kz | 241 200 Kz |
| `wp-start` | [Hostinger Premium](https://www.hostinger.com/web-hosting) | US$ 1.99/mês (pré-pago 48 meses: US$ 95.52) | US$ 10.99/mês | 10.99 × 2 × 913 = 20 067,74 → 20 100 | **20 100 Kz** | 241 200 Kz | 241 200 Kz |
| `wp-builder-start` | [Hostinger Premium](https://www.hostinger.com/web-hosting) | US$ 1.99/mês (pré-pago 48 meses: US$ 95.52) | US$ 10.99/mês | 10.99 × 2 × 913 = 20 067,74 → 20 100 | **20 100 Kz** | 241 200 Kz | 241 200 Kz |
| `ia-starter` | [Hostinger Premium](https://www.hostinger.com/web-hosting) | US$ 1.99/mês (pré-pago 48 meses: US$ 95.52) | US$ 10.99/mês | 10.99 × 2 × 913 = 20 067,74 → 20 100 | **20 100 Kz** | 241 200 Kz | 241 200 Kz |
| `hosting-business` | [Hostinger Unlimited](https://www.hostinger.com/web-hosting) | US$ 2.79/mês (pré-pago 48 meses: US$ 133.92) | US$ 16.99/mês | 16.99 × 2 × 913 = 31 023,74 → 31 100 | **31 100 Kz** | 373 200 Kz | 373 200 Kz |
| `wp-pro` | [Hostinger Unlimited](https://www.hostinger.com/web-hosting) | US$ 2.79/mês (pré-pago 48 meses: US$ 133.92) | US$ 16.99/mês | 16.99 × 2 × 913 = 31 023,74 → 31 100 | **31 100 Kz** | 373 200 Kz | 373 200 Kz |
| `wp-builder-pro` | [Hostinger Unlimited](https://www.hostinger.com/web-hosting) | US$ 2.79/mês (pré-pago 48 meses: US$ 133.92) | US$ 16.99/mês | 16.99 × 2 × 913 = 31 023,74 → 31 100 | **31 100 Kz** | 373 200 Kz | 373 200 Kz |
| `ia-pro` | [Hostinger Unlimited](https://www.hostinger.com/web-hosting) | US$ 2.79/mês (pré-pago 48 meses: US$ 133.92) | US$ 16.99/mês | 16.99 × 2 × 913 = 31 023,74 → 31 100 | **31 100 Kz** | 373 200 Kz | 373 200 Kz |
| `hosting-turbo` | [Hostinger Cloud Startup](https://www.hostinger.com/web-hosting) | US$ 7.99/mês (pré-pago 48 meses: US$ 383.52) | US$ 25.99/mês | 25.99 × 2 × 913 = 47 457,74 → 47 500 | **47 500 Kz** | 570 000 Kz | 570 000 Kz |
| `wp-turbo` | [Hostinger Cloud Startup](https://www.hostinger.com/web-hosting) | US$ 7.99/mês (pré-pago 48 meses: US$ 383.52) | US$ 25.99/mês | 25.99 × 2 × 913 = 47 457,74 → 47 500 | **47 500 Kz** | 570 000 Kz | 570 000 Kz |
| `wp-builder-turbo` | [Hostinger Cloud Startup](https://www.hostinger.com/web-hosting) | US$ 7.99/mês (pré-pago 48 meses: US$ 383.52) | US$ 25.99/mês | 25.99 × 2 × 913 = 47 457,74 → 47 500 | **47 500 Kz** | 570 000 Kz | 570 000 Kz |
| `ia-business` | [Hostinger Cloud Startup](https://www.hostinger.com/web-hosting) | US$ 7.99/mês (pré-pago 48 meses: US$ 383.52) | US$ 25.99/mês | 25.99 × 2 × 913 = 47 457,74 → 47 500 | **47 500 Kz** | 570 000 Kz | 570 000 Kz |
| `email-starter` | [Hostinger Business Email Starter (por caixa)](https://www.hostinger.com/business-email) | US$ 0.39/mês (pré-pago 48 meses: US$ 18.72) | US$ 1.59/mês | 1.59 × 2 × 913 = 2903,34 → 3000 | **3000 Kz** | 36 000 Kz | 36 000 Kz |
| `email-standard` | [Hostinger Business Email Standard (por caixa)](https://www.hostinger.com/business-email) | US$ 0.99/mês (pré-pago 48 meses: US$ 47.52) | US$ 2.79/mês | 2.79 × 2 × 913 = 5094,54 → 5100 | **5100 Kz** | 61 200 Kz | 61 200 Kz |
| `email-premium` | [Hostinger Business Email Premium (por caixa)](https://www.hostinger.com/business-email) | US$ 1.99/mês (pré-pago 48 meses: US$ 95.52) | US$ 3.99/mês | 3.99 × 2 × 913 = 7285,74 → 7300 | **7300 Kz** | 87 600 Kz | 87 600 Kz |
| `vps-nvme2` | [Hostinger KVM 2](https://www.hostinger.com/vps-hosting) | US$ 8.79/mês (pré-pago 24 meses: US$ 210.96) | US$ 14.99/mês | 14.99 × 2 × 913 = 27 371,74 → 27 400 | **27 400 Kz** | 328 800 Kz | 328 800 Kz |
| `vps-n8n-start` | [Hostinger KVM 2](https://www.hostinger.com/vps-hosting) | US$ 8.79/mês (pré-pago 24 meses: US$ 210.96) | US$ 14.99/mês | 14.99 × 2 × 913 = 27 371,74 → 27 400 | **27 400 Kz** | 328 800 Kz | 328 800 Kz |
| `vps-openclaw-start` | [Hostinger KVM 2](https://www.hostinger.com/vps-hosting) | US$ 8.79/mês (pré-pago 24 meses: US$ 210.96) | US$ 14.99/mês | 14.99 × 2 × 913 = 27 371,74 → 27 400 | **27 400 Kz** | 328 800 Kz | 328 800 Kz |
| `vps-evolution-start` | [Hostinger KVM 2](https://www.hostinger.com/vps-hosting) | US$ 8.79/mês (pré-pago 24 meses: US$ 210.96) | US$ 14.99/mês | 14.99 × 2 × 913 = 27 371,74 → 27 400 | **27 400 Kz** | 328 800 Kz | 328 800 Kz |
| `vps-ai-cloud-start` | [Hostinger KVM 2](https://www.hostinger.com/vps-hosting) | US$ 8.79/mês (pré-pago 24 meses: US$ 210.96) | US$ 14.99/mês | 14.99 × 2 × 913 = 27 371,74 → 27 400 | **27 400 Kz** | 328 800 Kz | 328 800 Kz |
| `vps-nvme4` | [Hostinger KVM 4](https://www.hostinger.com/vps-hosting) | US$ 12.99/mês (pré-pago 24 meses: US$ 311.76) | US$ 28.99/mês | 28.99 × 2 × 913 = 52 935,74 → 53 000 | **53 000 Kz** | 636 000 Kz | 636 000 Kz |
| `vps-n8n-pro` | [Hostinger KVM 4](https://www.hostinger.com/vps-hosting) | US$ 12.99/mês (pré-pago 24 meses: US$ 311.76) | US$ 28.99/mês | 28.99 × 2 × 913 = 52 935,74 → 53 000 | **53 000 Kz** | 636 000 Kz | 636 000 Kz |
| `vps-openclaw-pro` | [Hostinger KVM 4](https://www.hostinger.com/vps-hosting) | US$ 12.99/mês (pré-pago 24 meses: US$ 311.76) | US$ 28.99/mês | 28.99 × 2 × 913 = 52 935,74 → 53 000 | **53 000 Kz** | 636 000 Kz | 636 000 Kz |
| `vps-evolution-pro` | [Hostinger KVM 4](https://www.hostinger.com/vps-hosting) | US$ 12.99/mês (pré-pago 24 meses: US$ 311.76) | US$ 28.99/mês | 28.99 × 2 × 913 = 52 935,74 → 53 000 | **53 000 Kz** | 636 000 Kz | 636 000 Kz |
| `vps-ai-cloud-pro` | [Hostinger KVM 4](https://www.hostinger.com/vps-hosting) | US$ 12.99/mês (pré-pago 24 meses: US$ 311.76) | US$ 28.99/mês | 28.99 × 2 × 913 = 52 935,74 → 53 000 | **53 000 Kz** | 636 000 Kz | 636 000 Kz |
| `vps-nvme8` | [Hostinger KVM 8](https://www.hostinger.com/vps-hosting) | US$ 25.99/mês (pré-pago 24 meses: US$ 623.76) | US$ 49.99/mês | 49.99 × 2 × 913 = 91 281,74 → 91 300 | **91 300 Kz** | 1 095 600 Kz | 1 095 600 Kz |
| `vps-n8n-scale` | [Hostinger KVM 8](https://www.hostinger.com/vps-hosting) | US$ 25.99/mês (pré-pago 24 meses: US$ 623.76) | US$ 49.99/mês | 49.99 × 2 × 913 = 91 281,74 → 91 300 | **91 300 Kz** | 1 095 600 Kz | 1 095 600 Kz |
| `vps-openclaw-scale` | [Hostinger KVM 8](https://www.hostinger.com/vps-hosting) | US$ 25.99/mês (pré-pago 24 meses: US$ 623.76) | US$ 49.99/mês | 49.99 × 2 × 913 = 91 281,74 → 91 300 | **91 300 Kz** | 1 095 600 Kz | 1 095 600 Kz |
| `vps-evolution-scale` | [Hostinger KVM 8](https://www.hostinger.com/vps-hosting) | US$ 25.99/mês (pré-pago 24 meses: US$ 623.76) | US$ 49.99/mês | 49.99 × 2 × 913 = 91 281,74 → 91 300 | **91 300 Kz** | 1 095 600 Kz | 1 095 600 Kz |
| `vps-ai-cloud-enterprise` | [Hostinger KVM 8](https://www.hostinger.com/vps-hosting) | US$ 25.99/mês (pré-pago 24 meses: US$ 623.76) | US$ 49.99/mês | 49.99 × 2 × 913 = 91 281,74 → 91 300 | **91 300 Kz** | 1 095 600 Kz | 1 095 600 Kz |

Todos os ciclos (mensal, trimestral, 6 meses, 1, 2 e 3 anos) cobram preço/mês × meses; a renovação comunicada é igual ao valor do ciclo.

## Sob consulta

| Planos | Motivo |
|---|---|
| `reseller-start`, `reseller-growth`, `reseller-business`, `reseller-enterprise` | A Hostinger não publica planos de revenda (WHM) equivalentes. |
| `ded-16`, `ded-32`, `ded-64`, `win-black`, `win-sapphire`, `win-diamond` | A Hostinger não vende servidores dedicados; não há preço público equivalente. |
| `microsoft-365-outlook` | Sem equivalente com plano e recursos publicados nas fontes consultadas (a AngoWeb mostra apenas «a partir de»). |
| `ssl-dv`, `ssl-ov`, `ssl-ev`, `ssl-wildcard` | A Hostinger inclui SSL gratuito nos planos e não publica certificados OV/EV/Wildcard pagos. |
| `backup-100`, `backup-500`, `backup-2000` | Sem produto de backup equivalente com preço público nas fontes consultadas. |
| `protection-basic`, `protection-pro`, `protection-premium` | Sem produto de protecção equivalente com preço público nas fontes consultadas. |

## Domínios (1 ano)

| Extensão | Operação | Fonte | Referência | Promo 1.º ano (só registo) | Cálculo | Preço ViralizaHost |
|---|---|---|---|---|---|---|
| .com | Registo | [Hostinger](https://www.hostinger.com/domains) | US$ 19.99 | US$ 0.01 (With 3-year term) | 19.99 × 2 × 913 = 36 501,74 | **36 600 Kz** |
| .com | Renovação | [Hostinger](https://www.hostinger.com/domains) | US$ 19.99 | — | 19.99 × 2 × 913 = 36 501,74 | **36 600 Kz** |
| .com | Transferência | [Hostinger](https://www.hostinger.com/domains) | US$ 9.99 | — | 9.99 × 2 × 913 = 18 241,74 | **18 300 Kz** |
| .net | Registo | [Hostinger](https://www.hostinger.com/domains) | US$ 17.99 | US$ 11.99 (With 2-year term) | 17.99 × 2 × 913 = 32 849,74 | **32 900 Kz** |
| .net | Renovação | [Hostinger](https://www.hostinger.com/domains) | US$ 17.99 | — | 17.99 × 2 × 913 = 32 849,74 | **32 900 Kz** |
| .net | Transferência | [Hostinger](https://www.hostinger.com/domains) | US$ 14.99 | — | 14.99 × 2 × 913 = 27 371,74 | **27 400 Kz** |
| .org | Registo | [Hostinger](https://www.hostinger.com/domains) | US$ 17.99 | US$ 7.99 | 17.99 × 2 × 913 = 32 849,74 | **32 900 Kz** |
| .org | Renovação | [Hostinger](https://www.hostinger.com/domains) | US$ 17.99 | — | 17.99 × 2 × 913 = 32 849,74 | **32 900 Kz** |
| .org | Transferência | [Hostinger](https://www.hostinger.com/domains) | US$ 12.99 | — | 12.99 × 2 × 913 = 23 719,74 | **23 800 Kz** |
| .online | Registo | [Hostinger](https://www.hostinger.com/domains) | US$ 35.99 | US$ 0.99 | 35.99 × 2 × 913 = 65 717,74 | **65 800 Kz** |
| .online | Renovação | [Hostinger](https://www.hostinger.com/domains) | US$ 35.99 | — | 35.99 × 2 × 913 = 65 717,74 | **65 800 Kz** |
| .online | Transferência | [Hostinger](https://www.hostinger.com/domains) | US$ 30.99 | — | 30.99 × 2 × 913 = 56 587,74 | **56 600 Kz** |
| .shop | Registo | [Hostinger](https://www.hostinger.com/domains) | US$ 39.99 | US$ 0.99 | 39.99 × 2 × 913 = 73 021,74 | **73 100 Kz** |
| .shop | Renovação | [Hostinger](https://www.hostinger.com/domains) | US$ 39.99 | — | 39.99 × 2 × 913 = 73 021,74 | **73 100 Kz** |
| .shop | Transferência | [Hostinger](https://www.hostinger.com/domains) | US$ 34.99 | — | 34.99 × 2 × 913 = 63 891,74 | **63 900 Kz** |
| .store | Registo | [Hostinger](https://www.hostinger.com/domains) | US$ 54.99 | US$ 0.99 | 54.99 × 2 × 913 = 100 411,74 | **100 500 Kz** |
| .store | Renovação | [Hostinger](https://www.hostinger.com/domains) | US$ 54.99 | — | 54.99 × 2 × 913 = 100 411,74 | **100 500 Kz** |
| .store | Transferência | [Hostinger](https://www.hostinger.com/domains) | US$ 46.99 | — | 46.99 × 2 × 913 = 85 803,74 | **85 900 Kz** |
| .tech | Registo | [Hostinger](https://www.hostinger.com/domains) | US$ 63.99 | US$ 6.99 | 63.99 × 2 × 913 = 116 845,74 | **116 900 Kz** |
| .tech | Renovação | [Hostinger](https://www.hostinger.com/domains) | US$ 63.99 | — | 63.99 × 2 × 913 = 116 845,74 | **116 900 Kz** |
| .tech | Transferência | [Hostinger](https://www.hostinger.com/domains) | US$ 53.99 | — | 53.99 × 2 × 913 = 98 585,74 | **98 600 Kz** |
| .ai | Registo | [Hostinger](https://www.hostinger.com/domains) | US$ 109.99 | US$ 50.00 (2-year term only) | 109.99 × 2 × 913 = 200 841,74 | **200 900 Kz** |
| .ai | Renovação | [Hostinger](https://www.hostinger.com/domains) | US$ 109.99 | — | 109.99 × 2 × 913 = 200 841,74 | **200 900 Kz** |
| .ai | Transferência | [Hostinger](https://www.hostinger.com/domains) | US$ 179.99 | — | 179.99 × 2 × 913 = 328 661,74 | **328 700 Kz** |
| .io | Registo | [Hostinger](https://www.hostinger.com/domains) | US$ 74.99 | US$ 26.99 | 74.99 × 2 × 913 = 136 931,74 | **137 000 Kz** |
| .io | Renovação | [Hostinger](https://www.hostinger.com/domains) | US$ 74.99 | — | 74.99 × 2 × 913 = 136 931,74 | **137 000 Kz** |
| .io | Transferência | [Hostinger](https://www.hostinger.com/domains) | US$ 54.99 | — | 54.99 × 2 × 913 = 100 411,74 | **100 500 Kz** |
| .xyz | Registo | [Hostinger](https://www.hostinger.com/domains) | US$ 19.99 | US$ 1.29 | 19.99 × 2 × 913 = 36 501,74 | **36 600 Kz** |
| .xyz | Renovação | [Hostinger](https://www.hostinger.com/domains) | US$ 19.99 | — | 19.99 × 2 × 913 = 36 501,74 | **36 600 Kz** |
| .xyz | Transferência | [Hostinger](https://www.hostinger.com/domains) | US$ 14.99 | — | 14.99 × 2 × 913 = 27 371,74 | **27 400 Kz** |
| .ao | Registo | [AngoWeb](https://angoweb.ao/index.php?rp=/domain/pricing) | 24 900 Kz | — | 24 900 × 2 | **49 800 Kz** |
| .ao | Renovação | [AngoWeb](https://angoweb.ao/index.php?rp=/domain/pricing) | 34 900 Kz | — | 34 900 × 2 | **69 800 Kz** |
| .ao | Transferência | [AngoWeb](https://angoweb.ao/index.php?rp=/domain/pricing) | 0 Kz | — | 0 × 2 | **0 Kz** |
| .co.ao | Registo | [AngoWeb](https://angoweb.ao/index.php?rp=/domain/pricing) | 34 900 Kz | — | 34 900 × 2 | **69 800 Kz** |
| .co.ao | Renovação | [AngoWeb](https://angoweb.ao/index.php?rp=/domain/pricing) | 44 900 Kz | — | 44 900 × 2 | **89 800 Kz** |
| .co.ao | Transferência | [AngoWeb](https://angoweb.ao/index.php?rp=/domain/pricing) | 0 Kz | — | 0 × 2 | **0 Kz** |
| .org.ao | Registo | [AngoWeb](https://angoweb.ao/index.php?rp=/domain/pricing) | 34 900 Kz | — | 34 900 × 2 | **69 800 Kz** |
| .org.ao | Renovação | [AngoWeb](https://angoweb.ao/index.php?rp=/domain/pricing) | 44 900 Kz | — | 44 900 × 2 | **89 800 Kz** |
| .org.ao | Transferência | [AngoWeb](https://angoweb.ao/index.php?rp=/domain/pricing) | 0 Kz | — | 0 × 2 | **0 Kz** |
| .edu.ao | Registo | [AngoWeb](https://angoweb.ao/index.php?rp=/domain/pricing) | 34 900 Kz | — | 34 900 × 2 | **69 800 Kz** |
| .edu.ao | Renovação | [AngoWeb](https://angoweb.ao/index.php?rp=/domain/pricing) | 44 900 Kz | — | 44 900 × 2 | **89 800 Kz** |
| .edu.ao | Transferência | [AngoWeb](https://angoweb.ao/index.php?rp=/domain/pricing) | 0 Kz | — | 0 × 2 | **0 Kz** |
| .it.ao | Registo | [AngoWeb](https://angoweb.ao/index.php?rp=/domain/pricing) | 4900 Kz | — | 4900 × 2 | **9800 Kz** |
| .it.ao | Renovação | [AngoWeb](https://angoweb.ao/index.php?rp=/domain/pricing) | 9900 Kz | — | 9900 × 2 | **19 800 Kz** |
| .it.ao | Transferência | [AngoWeb](https://angoweb.ao/index.php?rp=/domain/pricing) | 0 Kz | — | 0 × 2 | **0 Kz** |
| .com.br | — | — | — | — | Sob consulta: Não consta da tabela pública da Hostinger consultada; registo .br exige registrador acreditado no Registro.br. | Sob consulta |

Nota: a AngoWeb publica a transferência de domínios nacionais a 0 Kz; com a regra ×2 o valor mantém-se 0 Kz.
