// GERADO por scripts/mariadb/generate-schema.mjs — não editar à mão.
// Metadados do schema MariaDB usados pela camada de acesso (src/lib/db).
import type { SchemaMeta } from './types'

export const schemaMeta: SchemaMeta = {
  "tables": {
    "profiles": {
      "columns": {
        "id": {
          "type": "uuid"
        },
        "email": {
          "type": "text"
        },
        "full_name": {
          "type": "text",
          "default": {
            "value": ""
          }
        },
        "phone": {
          "type": "text",
          "nullable": true
        },
        "country": {
          "type": "text",
          "default": {
            "value": "AO"
          }
        },
        "role": {
          "type": "enum",
          "enumValues": [
            "client",
            "admin",
            "reseller"
          ],
          "default": {
            "value": "client"
          }
        },
        "currency": {
          "type": "enum",
          "enumValues": [
            "AKZ",
            "BRL",
            "USD"
          ],
          "default": {
            "value": "USD"
          }
        },
        "avatar_url": {
          "type": "text",
          "nullable": true
        },
        "is_active": {
          "type": "bool",
          "default": {
            "value": true
          }
        },
        "email_verified": {
          "type": "bool",
          "default": {
            "value": false
          }
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        },
        "updated_at": {
          "type": "datetime",
          "default": "now"
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [
        [
          "email"
        ]
      ],
      "fks": [
        {
          "name": "profiles_id_fkey",
          "columns": [
            "id"
          ],
          "refTable": "auth_users",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": true
    },
    "activity_logs": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "profile_id": {
          "type": "uuid",
          "nullable": true
        },
        "action": {
          "type": "enum",
          "enumValues": [
            "login",
            "logout",
            "create",
            "update",
            "delete",
            "payment",
            "suspend",
            "activate"
          ]
        },
        "entity_type": {
          "type": "text",
          "nullable": true
        },
        "entity_id": {
          "type": "uuid",
          "nullable": true
        },
        "description": {
          "type": "text"
        },
        "ip_address": {
          "type": "text",
          "nullable": true
        },
        "user_agent": {
          "type": "text",
          "nullable": true
        },
        "metadata": {
          "type": "json",
          "nullable": true,
          "default": {
            "value": {}
          }
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [],
      "fks": [
        {
          "name": "activity_logs_profile_id_fkey",
          "columns": [
            "profile_id"
          ],
          "refTable": "profiles",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": false
    },
    "ai_conversations": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "profile_id": {
          "type": "uuid",
          "nullable": true
        },
        "session_token": {
          "type": "text",
          "nullable": true
        },
        "title": {
          "type": "text",
          "nullable": true
        },
        "status": {
          "type": "text",
          "default": {
            "value": "active"
          }
        },
        "user_level": {
          "type": "text",
          "default": {
            "value": "visitor"
          }
        },
        "metadata": {
          "type": "json",
          "nullable": true,
          "default": {
            "value": {}
          }
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        },
        "updated_at": {
          "type": "datetime",
          "default": "now"
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [],
      "fks": [
        {
          "name": "ai_conversations_profile_id_fkey",
          "columns": [
            "profile_id"
          ],
          "refTable": "auth_users",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": true
    },
    "ai_audit_logs": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "conversation_id": {
          "type": "uuid",
          "nullable": true
        },
        "profile_id": {
          "type": "uuid",
          "nullable": true
        },
        "tool_name": {
          "type": "text"
        },
        "tool_input": {
          "type": "json",
          "nullable": true
        },
        "result_summary": {
          "type": "text",
          "nullable": true
        },
        "success": {
          "type": "bool",
          "default": {
            "value": true
          }
        },
        "error_message": {
          "type": "text",
          "nullable": true
        },
        "ip_address": {
          "type": "text",
          "nullable": true
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [],
      "fks": [
        {
          "name": "ai_audit_logs_conversation_id_fkey",
          "columns": [
            "conversation_id"
          ],
          "refTable": "ai_conversations",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "ai_audit_logs_profile_id_fkey",
          "columns": [
            "profile_id"
          ],
          "refTable": "auth_users",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": false
    },
    "ai_messages": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "conversation_id": {
          "type": "uuid"
        },
        "role": {
          "type": "text"
        },
        "content": {
          "type": "text"
        },
        "tool_name": {
          "type": "text",
          "nullable": true
        },
        "tool_input": {
          "type": "json",
          "nullable": true
        },
        "tool_output": {
          "type": "json",
          "nullable": true
        },
        "tokens_used": {
          "type": "int",
          "nullable": true
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [],
      "fks": [
        {
          "name": "ai_messages_conversation_id_fkey",
          "columns": [
            "conversation_id"
          ],
          "refTable": "ai_conversations",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": false
    },
    "banner_pages": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "page_slug": {
          "type": "text"
        },
        "page_name": {
          "type": "text"
        },
        "breadcrumb": {
          "type": "text",
          "nullable": true
        },
        "breadcrumb_parent": {
          "type": "text",
          "nullable": true
        },
        "breadcrumb_parent_href": {
          "type": "text",
          "nullable": true
        },
        "tag": {
          "type": "text",
          "nullable": true
        },
        "title": {
          "type": "text",
          "default": {
            "value": ""
          }
        },
        "subtitle": {
          "type": "text",
          "default": {
            "value": ""
          }
        },
        "bg_image": {
          "type": "text",
          "nullable": true
        },
        "bg_color": {
          "type": "text",
          "default": {
            "value": "#080d1a"
          }
        },
        "highlights": {
          "type": "array",
          "default": {
            "value": []
          }
        },
        "button_primary_text": {
          "type": "text",
          "default": {
            "value": "Ver Planos"
          }
        },
        "button_primary_link": {
          "type": "text",
          "default": {
            "value": "#planos"
          }
        },
        "button_secondary_text": {
          "type": "text",
          "nullable": true
        },
        "button_secondary_link": {
          "type": "text",
          "nullable": true
        },
        "price_text": {
          "type": "text",
          "nullable": true
        },
        "show_guarantee": {
          "type": "bool",
          "default": {
            "value": true
          }
        },
        "overlay_opacity": {
          "type": "decimal",
          "default": {
            "value": 0
          }
        },
        "is_active": {
          "type": "bool",
          "default": {
            "value": true
          }
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        },
        "updated_at": {
          "type": "datetime",
          "default": "now"
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [
        [
          "page_slug"
        ]
      ],
      "fks": [],
      "autoUpdatedAt": true
    },
    "clients": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "profile_id": {
          "type": "uuid"
        },
        "company_name": {
          "type": "text",
          "nullable": true
        },
        "tax_id": {
          "type": "text",
          "nullable": true
        },
        "address": {
          "type": "text",
          "nullable": true
        },
        "city": {
          "type": "text",
          "nullable": true
        },
        "state": {
          "type": "text",
          "nullable": true
        },
        "postal_code": {
          "type": "text",
          "nullable": true
        },
        "notes": {
          "type": "text",
          "nullable": true
        },
        "credit_balance": {
          "type": "decimal",
          "default": {
            "value": 0
          }
        },
        "currency": {
          "type": "enum",
          "enumValues": [
            "AKZ",
            "BRL",
            "USD"
          ],
          "default": {
            "value": "USD"
          }
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        },
        "updated_at": {
          "type": "datetime",
          "default": "now"
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [
        [
          "profile_id"
        ]
      ],
      "fks": [
        {
          "name": "clients_profile_id_fkey",
          "columns": [
            "profile_id"
          ],
          "refTable": "profiles",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": true
    },
    "company_billing_settings": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "company_name": {
          "type": "text",
          "default": {
            "value": "ViralizaHost"
          }
        },
        "logo_url": {
          "type": "text",
          "nullable": true
        },
        "email": {
          "type": "text",
          "default": {
            "value": "comercial@viralizahost.com"
          }
        },
        "website": {
          "type": "text",
          "default": {
            "value": "viralizahost.com"
          }
        },
        "phone": {
          "type": "text",
          "nullable": true
        },
        "address": {
          "type": "text",
          "nullable": true
        },
        "bank_name": {
          "type": "text",
          "nullable": true
        },
        "account_holder": {
          "type": "text",
          "nullable": true
        },
        "account_number": {
          "type": "text",
          "nullable": true
        },
        "iban": {
          "type": "text",
          "nullable": true
        },
        "swift": {
          "type": "text",
          "nullable": true
        },
        "payment_instructions": {
          "type": "text",
          "nullable": true
        },
        "footer_text": {
          "type": "text",
          "nullable": true,
          "default": {
            "value": "ViralizaHost — Hospedagem Web, Domínios e E-mails Corporativos\nE-mail: comercial@viralizahost.com | viralizahost.com | Suporte 24/7"
          }
        },
        "default_due_days": {
          "type": "int",
          "default": {
            "value": 7
          }
        },
        "email_subject_template": {
          "type": "text",
          "nullable": true,
          "default": {
            "value": "Fatura ViralizaHost nº {invoice_number} — {service_name}"
          }
        },
        "email_body_template": {
          "type": "text",
          "nullable": true
        },
        "auto_email_on_create": {
          "type": "bool",
          "default": {
            "value": false
          }
        },
        "active": {
          "type": "bool",
          "default": {
            "value": true
          }
        },
        "updated_at": {
          "type": "datetime",
          "default": "now"
        },
        "updated_by": {
          "type": "uuid",
          "nullable": true
        },
        "active_unique_key": {
          "type": "int",
          "nullable": true,
          "generated": true,
          "internal": true
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [
        [
          "active"
        ]
      ],
      "fks": [
        {
          "name": "company_billing_settings_updated_by_fkey",
          "columns": [
            "updated_by"
          ],
          "refTable": "auth_users",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": true
    },
    "currency_rates": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "base_currency": {
          "type": "text",
          "default": {
            "value": "AOA"
          }
        },
        "target_currency": {
          "type": "text"
        },
        "rate": {
          "type": "decimal"
        },
        "source": {
          "type": "text",
          "default": {
            "value": "manual"
          }
        },
        "is_active": {
          "type": "bool",
          "default": {
            "value": true
          }
        },
        "updated_at": {
          "type": "datetime",
          "default": "now"
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [
        [
          "base_currency",
          "target_currency"
        ]
      ],
      "fks": [],
      "autoUpdatedAt": false
    },
    "plans": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "slug": {
          "type": "text"
        },
        "name": {
          "type": "text"
        },
        "type": {
          "type": "enum",
          "enumValues": [
            "shared",
            "vps",
            "dedicated",
            "reseller"
          ],
          "default": {
            "value": "shared"
          }
        },
        "description": {
          "type": "text",
          "nullable": true
        },
        "features": {
          "type": "json",
          "default": {
            "value": []
          }
        },
        "price_akz": {
          "type": "decimal",
          "default": {
            "value": 0
          }
        },
        "price_brl": {
          "type": "decimal",
          "default": {
            "value": 0
          }
        },
        "price_usd": {
          "type": "decimal",
          "default": {
            "value": 0
          }
        },
        "disk_gb": {
          "type": "int",
          "default": {
            "value": 10
          }
        },
        "bandwidth_gb": {
          "type": "int",
          "default": {
            "value": 100
          }
        },
        "email_accounts": {
          "type": "int",
          "default": {
            "value": 5
          }
        },
        "max_domains": {
          "type": "int",
          "default": {
            "value": 1
          }
        },
        "max_subdomains": {
          "type": "int",
          "default": {
            "value": 5
          }
        },
        "max_databases": {
          "type": "int",
          "default": {
            "value": 3
          }
        },
        "is_popular": {
          "type": "bool",
          "default": {
            "value": false
          }
        },
        "is_active": {
          "type": "bool",
          "default": {
            "value": true
          }
        },
        "sort_order": {
          "type": "int",
          "default": {
            "value": 0
          }
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        },
        "updated_at": {
          "type": "datetime",
          "default": "now"
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [
        [
          "slug"
        ]
      ],
      "fks": [],
      "autoUpdatedAt": true
    },
    "servers": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "name": {
          "type": "text"
        },
        "hostname": {
          "type": "text"
        },
        "ip_address": {
          "type": "text"
        },
        "location": {
          "type": "text",
          "default": {
            "value": "AO"
          }
        },
        "whm_url": {
          "type": "text",
          "nullable": true
        },
        "whm_api_token": {
          "type": "text",
          "nullable": true
        },
        "whm_username": {
          "type": "text",
          "nullable": true,
          "default": {
            "value": "root"
          }
        },
        "is_active": {
          "type": "bool",
          "default": {
            "value": true
          }
        },
        "max_accounts": {
          "type": "int",
          "default": {
            "value": 500
          }
        },
        "current_load": {
          "type": "decimal",
          "default": {
            "value": 0
          }
        },
        "notes": {
          "type": "text",
          "nullable": true
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        },
        "updated_at": {
          "type": "datetime",
          "default": "now"
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [],
      "fks": [],
      "autoUpdatedAt": true
    },
    "orders": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "user_id": {
          "type": "uuid",
          "nullable": true
        },
        "billing_cycle": {
          "type": "text",
          "default": {
            "value": "monthly"
          }
        },
        "domain_name": {
          "type": "text",
          "nullable": true
        },
        "domain_action": {
          "type": "text",
          "nullable": true
        },
        "payment_method": {
          "type": "text",
          "default": {
            "value": "bank_transfer"
          }
        },
        "amount": {
          "type": "decimal",
          "default": {
            "value": 0
          }
        },
        "status": {
          "type": "text",
          "default": {
            "value": "pending"
          }
        },
        "proof_file": {
          "type": "text",
          "nullable": true
        },
        "transfer_ref": {
          "type": "text",
          "nullable": true
        },
        "notes": {
          "type": "text",
          "nullable": true
        },
        "created_at": {
          "type": "datetime",
          "nullable": true,
          "default": "now"
        },
        "updated_at": {
          "type": "datetime",
          "nullable": true,
          "default": "now"
        },
        "use_default_ns": {
          "type": "bool",
          "default": {
            "value": true
          }
        },
        "ns1": {
          "type": "text",
          "nullable": true
        },
        "ns2": {
          "type": "text",
          "nullable": true
        },
        "ns3": {
          "type": "text",
          "nullable": true
        },
        "ns4": {
          "type": "text",
          "nullable": true
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [],
      "fks": [
        {
          "name": "orders_user_id_fkey",
          "columns": [
            "user_id"
          ],
          "refTable": "auth_users",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": false
    },
    "services": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "profile_id": {
          "type": "uuid"
        },
        "plan_id": {
          "type": "uuid",
          "nullable": true
        },
        "server_id": {
          "type": "uuid",
          "nullable": true
        },
        "status": {
          "type": "enum",
          "enumValues": [
            "pending",
            "active",
            "suspended",
            "cancelled",
            "expired",
            "pending_provisioning"
          ],
          "default": {
            "value": "pending"
          }
        },
        "currency": {
          "type": "enum",
          "enumValues": [
            "AKZ",
            "BRL",
            "USD"
          ],
          "default": {
            "value": "USD"
          }
        },
        "price": {
          "type": "decimal",
          "default": {
            "value": 0
          }
        },
        "billing_cycle": {
          "type": "text",
          "default": {
            "value": "monthly"
          }
        },
        "started_at": {
          "type": "datetime",
          "nullable": true
        },
        "expires_at": {
          "type": "datetime",
          "nullable": true
        },
        "auto_renew": {
          "type": "bool",
          "default": {
            "value": true
          }
        },
        "notes": {
          "type": "text",
          "nullable": true
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        },
        "updated_at": {
          "type": "datetime",
          "default": "now"
        },
        "order_id": {
          "type": "uuid",
          "nullable": true
        },
        "service_type": {
          "type": "text",
          "nullable": true
        },
        "service_name": {
          "type": "text",
          "nullable": true
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [],
      "fks": [
        {
          "name": "services_profile_id_fkey",
          "columns": [
            "profile_id"
          ],
          "refTable": "profiles",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "services_plan_id_fkey",
          "columns": [
            "plan_id"
          ],
          "refTable": "plans",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "services_server_id_fkey",
          "columns": [
            "server_id"
          ],
          "refTable": "servers",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "services_order_id_fkey",
          "columns": [
            "order_id"
          ],
          "refTable": "orders",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": true
    },
    "domains": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "profile_id": {
          "type": "uuid"
        },
        "service_id": {
          "type": "uuid",
          "nullable": true
        },
        "name": {
          "type": "text"
        },
        "extension": {
          "type": "text"
        },
        "full_domain": {
          "type": "text",
          "nullable": true,
          "generated": true
        },
        "status": {
          "type": "enum",
          "enumValues": [
            "active",
            "expired",
            "pending",
            "transferred",
            "locked"
          ],
          "default": {
            "value": "pending"
          }
        },
        "registrar": {
          "type": "text",
          "default": {
            "value": "viralizahost"
          }
        },
        "nameservers": {
          "type": "json",
          "default": {
            "value": [
              "ns1.viralizahost.com",
              "ns2.viralizahost.com"
            ]
          }
        },
        "auto_renew": {
          "type": "bool",
          "default": {
            "value": true
          }
        },
        "is_locked": {
          "type": "bool",
          "default": {
            "value": true
          }
        },
        "whois_privacy": {
          "type": "bool",
          "default": {
            "value": false
          }
        },
        "registered_at": {
          "type": "datetime",
          "default": "now"
        },
        "expires_at": {
          "type": "datetime",
          "nullable": true
        },
        "price_paid": {
          "type": "decimal",
          "nullable": true
        },
        "currency": {
          "type": "enum",
          "nullable": true,
          "enumValues": [
            "AKZ",
            "BRL",
            "USD"
          ]
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        },
        "updated_at": {
          "type": "datetime",
          "default": "now"
        },
        "order_id": {
          "type": "uuid",
          "nullable": true
        },
        "registered": {
          "type": "bool",
          "default": {
            "value": false
          }
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [
        [
          "name",
          "extension"
        ],
        [
          "name"
        ]
      ],
      "fks": [
        {
          "name": "domains_profile_id_fkey",
          "columns": [
            "profile_id"
          ],
          "refTable": "profiles",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "domains_service_id_fkey",
          "columns": [
            "service_id"
          ],
          "refTable": "services",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "domains_order_id_fkey",
          "columns": [
            "order_id"
          ],
          "refTable": "orders",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": true
    },
    "tickets": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "profile_id": {
          "type": "uuid"
        },
        "subject": {
          "type": "text"
        },
        "status": {
          "type": "enum",
          "enumValues": [
            "open",
            "in_progress",
            "resolved",
            "closed"
          ],
          "default": {
            "value": "open"
          }
        },
        "priority": {
          "type": "enum",
          "enumValues": [
            "low",
            "medium",
            "high",
            "critical"
          ],
          "default": {
            "value": "medium"
          }
        },
        "department": {
          "type": "text",
          "default": {
            "value": "technical"
          }
        },
        "assigned_to": {
          "type": "uuid",
          "nullable": true
        },
        "service_id": {
          "type": "uuid",
          "nullable": true
        },
        "closed_at": {
          "type": "datetime",
          "nullable": true
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        },
        "updated_at": {
          "type": "datetime",
          "default": "now"
        },
        "ticket_number": {
          "type": "text",
          "nullable": true
        },
        "category": {
          "type": "text",
          "nullable": true
        },
        "domain_id": {
          "type": "uuid",
          "nullable": true
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [
        [
          "ticket_number"
        ]
      ],
      "fks": [
        {
          "name": "tickets_profile_id_fkey",
          "columns": [
            "profile_id"
          ],
          "refTable": "profiles",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "tickets_assigned_to_fkey",
          "columns": [
            "assigned_to"
          ],
          "refTable": "profiles",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "tickets_service_id_fkey",
          "columns": [
            "service_id"
          ],
          "refTable": "services",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "tickets_domain_id_fkey",
          "columns": [
            "domain_id"
          ],
          "refTable": "domains",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": true
    },
    "invoices": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "invoice_number": {
          "type": "text",
          "default": "invoice_number"
        },
        "profile_id": {
          "type": "uuid"
        },
        "service_id": {
          "type": "uuid",
          "nullable": true
        },
        "status": {
          "type": "enum",
          "enumValues": [
            "pending",
            "paid",
            "overdue",
            "cancelled",
            "refunded",
            "under_review",
            "partially_paid",
            "rejected",
            "draft",
            "sending",
            "sent",
            "generated",
            "failed"
          ],
          "default": {
            "value": "pending"
          }
        },
        "currency": {
          "type": "enum",
          "enumValues": [
            "AKZ",
            "BRL",
            "USD"
          ],
          "default": {
            "value": "USD"
          }
        },
        "subtotal": {
          "type": "decimal",
          "default": {
            "value": 0
          }
        },
        "discount": {
          "type": "decimal",
          "default": {
            "value": 0
          }
        },
        "tax": {
          "type": "decimal",
          "default": {
            "value": 0
          }
        },
        "total": {
          "type": "decimal",
          "default": {
            "value": 0
          }
        },
        "items": {
          "type": "json",
          "default": {
            "value": []
          }
        },
        "due_date": {
          "type": "datetime",
          "default": "now+7d"
        },
        "paid_at": {
          "type": "datetime",
          "nullable": true
        },
        "notes": {
          "type": "text",
          "nullable": true
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        },
        "updated_at": {
          "type": "datetime",
          "default": "now"
        },
        "order_id": {
          "type": "uuid",
          "nullable": true
        },
        "amount_paid": {
          "type": "decimal",
          "default": {
            "value": 0
          }
        },
        "ticket_id": {
          "type": "uuid",
          "nullable": true
        },
        "issue_date": {
          "type": "date",
          "default": "today"
        },
        "pdf_storage_path": {
          "type": "text",
          "nullable": true
        },
        "emailed_at": {
          "type": "datetime",
          "nullable": true
        },
        "created_by": {
          "type": "uuid",
          "nullable": true
        },
        "email_to": {
          "type": "text",
          "nullable": true
        },
        "email_from": {
          "type": "text",
          "nullable": true
        },
        "email_provider": {
          "type": "text",
          "nullable": true,
          "default": {
            "value": "resend"
          }
        },
        "email_provider_id": {
          "type": "text",
          "nullable": true
        },
        "email_sent_at": {
          "type": "datetime",
          "nullable": true
        },
        "email_last_error": {
          "type": "text",
          "nullable": true
        },
        "email_attempts": {
          "type": "int",
          "default": {
            "value": 0
          }
        },
        "email_delivered_at": {
          "type": "datetime",
          "nullable": true
        },
        "email_bounced_at": {
          "type": "datetime",
          "nullable": true
        },
        "email_status": {
          "type": "text",
          "default": {
            "value": "unsent"
          }
        },
        "proof_file": {
          "type": "text",
          "nullable": true
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [
        [
          "invoice_number"
        ],
        [
          "order_id"
        ]
      ],
      "fks": [
        {
          "name": "invoices_profile_id_fkey",
          "columns": [
            "profile_id"
          ],
          "refTable": "profiles",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "invoices_service_id_fkey",
          "columns": [
            "service_id"
          ],
          "refTable": "services",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "invoices_order_id_fkey",
          "columns": [
            "order_id"
          ],
          "refTable": "orders",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "invoices_ticket_id_fkey",
          "columns": [
            "ticket_id"
          ],
          "refTable": "tickets",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "invoices_created_by_fkey",
          "columns": [
            "created_by"
          ],
          "refTable": "auth_users",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": true
    },
    "email_logs": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "profile_id": {
          "type": "uuid",
          "nullable": true
        },
        "invoice_id": {
          "type": "uuid",
          "nullable": true
        },
        "order_id": {
          "type": "uuid",
          "nullable": true
        },
        "recipient": {
          "type": "text"
        },
        "sender": {
          "type": "text",
          "default": {
            "value": "ViralizaHost Comercial <comercial@viralizahost.com>"
          }
        },
        "subject": {
          "type": "text",
          "nullable": true
        },
        "provider": {
          "type": "text",
          "default": {
            "value": "resend"
          }
        },
        "provider_message_id": {
          "type": "text",
          "nullable": true
        },
        "status": {
          "type": "enum",
          "enumValues": [
            "queued",
            "processing",
            "sent",
            "delivered",
            "bounced",
            "failed",
            "complained",
            "delayed"
          ],
          "default": {
            "value": "queued"
          }
        },
        "error_message": {
          "type": "text",
          "nullable": true
        },
        "attempts": {
          "type": "int",
          "default": {
            "value": 1
          }
        },
        "initiated_by_agent": {
          "type": "bool",
          "default": {
            "value": false
          }
        },
        "initiated_by": {
          "type": "uuid",
          "nullable": true
        },
        "sent_at": {
          "type": "datetime",
          "nullable": true
        },
        "delivered_at": {
          "type": "datetime",
          "nullable": true
        },
        "failed_at": {
          "type": "datetime",
          "nullable": true
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        },
        "updated_at": {
          "type": "datetime",
          "default": "now"
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [],
      "fks": [
        {
          "name": "email_logs_profile_id_fkey",
          "columns": [
            "profile_id"
          ],
          "refTable": "profiles",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "email_logs_invoice_id_fkey",
          "columns": [
            "invoice_id"
          ],
          "refTable": "invoices",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "email_logs_order_id_fkey",
          "columns": [
            "order_id"
          ],
          "refTable": "orders",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": true
    },
    "hosting_accounts": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "service_id": {
          "type": "uuid"
        },
        "profile_id": {
          "type": "uuid"
        },
        "server_id": {
          "type": "uuid",
          "nullable": true
        },
        "cpanel_username": {
          "type": "text"
        },
        "primary_domain": {
          "type": "text"
        },
        "status": {
          "type": "enum",
          "enumValues": [
            "pending",
            "active",
            "suspended",
            "cancelled",
            "expired",
            "pending_provisioning"
          ],
          "default": {
            "value": "pending"
          }
        },
        "disk_used_mb": {
          "type": "int",
          "default": {
            "value": 0
          }
        },
        "bandwidth_used_mb": {
          "type": "int",
          "default": {
            "value": 0
          }
        },
        "email_count": {
          "type": "int",
          "default": {
            "value": 0
          }
        },
        "db_count": {
          "type": "int",
          "default": {
            "value": 0
          }
        },
        "php_version": {
          "type": "text",
          "default": {
            "value": "8.2"
          }
        },
        "ssl_enabled": {
          "type": "bool",
          "default": {
            "value": false
          }
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        },
        "updated_at": {
          "type": "datetime",
          "default": "now"
        },
        "disk_limit_mb": {
          "type": "int",
          "nullable": true
        },
        "package_name": {
          "type": "text",
          "nullable": true
        },
        "ip_address": {
          "type": "text",
          "nullable": true
        },
        "suspension_reason": {
          "type": "text",
          "nullable": true
        },
        "last_synced_at": {
          "type": "datetime",
          "nullable": true
        },
        "cpanel_url": {
          "type": "text",
          "nullable": true
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [
        [
          "cpanel_username"
        ]
      ],
      "fks": [
        {
          "name": "hosting_accounts_service_id_fkey",
          "columns": [
            "service_id"
          ],
          "refTable": "services",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "hosting_accounts_profile_id_fkey",
          "columns": [
            "profile_id"
          ],
          "refTable": "profiles",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "hosting_accounts_server_id_fkey",
          "columns": [
            "server_id"
          ],
          "refTable": "servers",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": true
    },
    "emails": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "hosting_id": {
          "type": "uuid"
        },
        "profile_id": {
          "type": "uuid"
        },
        "email_address": {
          "type": "text"
        },
        "display_name": {
          "type": "text",
          "nullable": true
        },
        "quota_mb": {
          "type": "int",
          "default": {
            "value": 500
          }
        },
        "used_mb": {
          "type": "int",
          "default": {
            "value": 0
          }
        },
        "status": {
          "type": "text",
          "default": {
            "value": "active"
          }
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        },
        "updated_at": {
          "type": "datetime",
          "default": "now"
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [
        [
          "email_address"
        ]
      ],
      "fks": [
        {
          "name": "emails_hosting_id_fkey",
          "columns": [
            "hosting_id"
          ],
          "refTable": "hosting_accounts",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "emails_profile_id_fkey",
          "columns": [
            "profile_id"
          ],
          "refTable": "profiles",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": true
    },
    "products": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "slug": {
          "type": "text"
        },
        "category": {
          "type": "text"
        },
        "name": {
          "type": "text"
        },
        "description": {
          "type": "text",
          "nullable": true
        },
        "badge": {
          "type": "text",
          "nullable": true
        },
        "popular": {
          "type": "bool",
          "default": {
            "value": false
          }
        },
        "active": {
          "type": "bool",
          "default": {
            "value": true
          }
        },
        "position": {
          "type": "int",
          "default": {
            "value": 0
          }
        },
        "price_monthly": {
          "type": "decimal",
          "nullable": true
        },
        "price_6months": {
          "type": "decimal",
          "nullable": true
        },
        "price_1year": {
          "type": "decimal",
          "nullable": true
        },
        "price_2years": {
          "type": "decimal",
          "nullable": true
        },
        "price_3years": {
          "type": "decimal",
          "nullable": true
        },
        "color": {
          "type": "text",
          "nullable": true
        },
        "href_override": {
          "type": "text",
          "nullable": true
        },
        "meta": {
          "type": "json",
          "nullable": true,
          "default": {
            "value": {}
          }
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        },
        "updated_at": {
          "type": "datetime",
          "default": "now"
        },
        "subcategory": {
          "type": "text",
          "nullable": true
        },
        "cta_label": {
          "type": "text",
          "nullable": true
        },
        "cta_url": {
          "type": "text",
          "nullable": true
        },
        "currency": {
          "type": "text",
          "default": {
            "value": "AOA"
          }
        },
        "price_aoa": {
          "type": "decimal",
          "nullable": true
        },
        "price_brl": {
          "type": "decimal",
          "nullable": true
        },
        "price_usd": {
          "type": "decimal",
          "nullable": true
        },
        "use_auto_conversion": {
          "type": "bool",
          "default": {
            "value": true
          }
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [
        [
          "slug"
        ]
      ],
      "fks": [],
      "autoUpdatedAt": false
    },
    "invoice_items": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "invoice_id": {
          "type": "uuid"
        },
        "product_id": {
          "type": "uuid",
          "nullable": true
        },
        "description": {
          "type": "text"
        },
        "quantity": {
          "type": "int",
          "default": {
            "value": 1
          }
        },
        "unit_price": {
          "type": "decimal",
          "default": {
            "value": 0
          }
        },
        "subtotal": {
          "type": "decimal",
          "default": {
            "value": 0
          }
        },
        "position": {
          "type": "int",
          "default": {
            "value": 0
          }
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [],
      "fks": [
        {
          "name": "invoice_items_invoice_id_fkey",
          "columns": [
            "invoice_id"
          ],
          "refTable": "invoices",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "invoice_items_product_id_fkey",
          "columns": [
            "product_id"
          ],
          "refTable": "products",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": false
    },
    "invoice_send_logs": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "invoice_id": {
          "type": "uuid"
        },
        "order_id": {
          "type": "uuid",
          "nullable": true
        },
        "ticket_id": {
          "type": "uuid",
          "nullable": true
        },
        "customer_id": {
          "type": "uuid"
        },
        "recipient": {
          "type": "text"
        },
        "provider": {
          "type": "text",
          "default": {
            "value": "resend"
          }
        },
        "provider_message_id": {
          "type": "text",
          "nullable": true
        },
        "status": {
          "type": "text",
          "default": {
            "value": "attempted"
          }
        },
        "error_message": {
          "type": "text",
          "nullable": true
        },
        "initiated_by": {
          "type": "uuid",
          "nullable": true
        },
        "initiated_by_agent": {
          "type": "bool",
          "default": {
            "value": false
          }
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        },
        "updated_at": {
          "type": "datetime",
          "default": "now"
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [],
      "fks": [
        {
          "name": "invoice_send_logs_invoice_id_fkey",
          "columns": [
            "invoice_id"
          ],
          "refTable": "invoices",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "invoice_send_logs_initiated_by_fkey",
          "columns": [
            "initiated_by"
          ],
          "refTable": "auth_users",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": true
    },
    "notifications": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "profile_id": {
          "type": "uuid"
        },
        "type": {
          "type": "enum",
          "enumValues": [
            "info",
            "warning",
            "error",
            "success"
          ],
          "default": {
            "value": "info"
          }
        },
        "title": {
          "type": "text"
        },
        "message": {
          "type": "text"
        },
        "link": {
          "type": "text",
          "nullable": true
        },
        "is_read": {
          "type": "bool",
          "default": {
            "value": false
          }
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [],
      "fks": [
        {
          "name": "notifications_profile_id_fkey",
          "columns": [
            "profile_id"
          ],
          "refTable": "profiles",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": false
    },
    "order_items": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "order_id": {
          "type": "uuid"
        },
        "service_name": {
          "type": "text"
        },
        "service_type": {
          "type": "text",
          "default": {
            "value": "other"
          }
        },
        "price": {
          "type": "decimal",
          "default": {
            "value": 0
          }
        },
        "quantity": {
          "type": "int",
          "default": {
            "value": 1
          }
        },
        "created_at": {
          "type": "datetime",
          "nullable": true,
          "default": "now"
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [],
      "fks": [
        {
          "name": "order_items_order_id_fkey",
          "columns": [
            "order_id"
          ],
          "refTable": "orders",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": false
    },
    "payments": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "invoice_id": {
          "type": "uuid"
        },
        "profile_id": {
          "type": "uuid"
        },
        "method": {
          "type": "enum",
          "enumValues": [
            "credit_card",
            "paypal",
            "mercadopago",
            "pix",
            "bank_transfer",
            "multicaixa"
          ],
          "default": {
            "value": "credit_card"
          }
        },
        "amount": {
          "type": "decimal",
          "default": {
            "value": 0
          }
        },
        "currency": {
          "type": "enum",
          "enumValues": [
            "AKZ",
            "BRL",
            "USD"
          ],
          "default": {
            "value": "USD"
          }
        },
        "status": {
          "type": "text",
          "default": {
            "value": "pending"
          }
        },
        "gateway_ref": {
          "type": "text",
          "nullable": true
        },
        "gateway_data": {
          "type": "json",
          "nullable": true,
          "default": {
            "value": {}
          }
        },
        "paid_at": {
          "type": "datetime",
          "nullable": true
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        },
        "order_id": {
          "type": "uuid",
          "nullable": true
        },
        "proof_url": {
          "type": "text",
          "nullable": true
        },
        "proof_filename": {
          "type": "text",
          "nullable": true
        },
        "proof_mime": {
          "type": "text",
          "nullable": true
        },
        "transfer_ref": {
          "type": "text",
          "nullable": true
        },
        "transfer_date": {
          "type": "date",
          "nullable": true
        },
        "payer_name": {
          "type": "text",
          "nullable": true
        },
        "payer_bank": {
          "type": "text",
          "nullable": true
        },
        "declared_amount": {
          "type": "decimal",
          "nullable": true
        },
        "rejection_reason": {
          "type": "text",
          "nullable": true
        },
        "reviewed_at": {
          "type": "datetime",
          "nullable": true
        },
        "reviewed_by": {
          "type": "uuid",
          "nullable": true
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [],
      "fks": [
        {
          "name": "payments_invoice_id_fkey",
          "columns": [
            "invoice_id"
          ],
          "refTable": "invoices",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "payments_profile_id_fkey",
          "columns": [
            "profile_id"
          ],
          "refTable": "profiles",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "payments_order_id_fkey",
          "columns": [
            "order_id"
          ],
          "refTable": "orders",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": false
    },
    "product_features": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "product_id": {
          "type": "uuid"
        },
        "feature": {
          "type": "text"
        },
        "included": {
          "type": "bool",
          "default": {
            "value": true
          }
        },
        "position": {
          "type": "int",
          "default": {
            "value": 0
          }
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [],
      "fks": [
        {
          "name": "product_features_product_id_fkey",
          "columns": [
            "product_id"
          ],
          "refTable": "products",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": false
    },
    "site_banners": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "position": {
          "type": "int",
          "default": {
            "value": 0
          }
        },
        "active": {
          "type": "bool",
          "default": {
            "value": true
          }
        },
        "bg_image": {
          "type": "text",
          "nullable": true
        },
        "bg_color": {
          "type": "text",
          "nullable": true,
          "default": {
            "value": "#000000"
          }
        },
        "accent_color": {
          "type": "text",
          "nullable": true,
          "default": {
            "value": "#F5B700"
          }
        },
        "tag": {
          "type": "text",
          "nullable": true
        },
        "title": {
          "type": "text",
          "nullable": true
        },
        "subtitle": {
          "type": "text",
          "nullable": true
        },
        "cta_text": {
          "type": "text",
          "nullable": true
        },
        "cta_href": {
          "type": "text",
          "nullable": true
        },
        "cta_secondary_text": {
          "type": "text",
          "nullable": true
        },
        "cta_secondary_href": {
          "type": "text",
          "nullable": true
        },
        "features": {
          "type": "array",
          "nullable": true
        },
        "created_at": {
          "type": "datetime",
          "nullable": true,
          "default": "now"
        },
        "updated_at": {
          "type": "datetime",
          "nullable": true,
          "default": "now"
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [
        [
          "position"
        ]
      ],
      "fks": [],
      "autoUpdatedAt": false
    },
    "site_domains": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "extension": {
          "type": "text"
        },
        "price_monthly": {
          "type": "decimal",
          "nullable": true
        },
        "price_annual": {
          "type": "decimal",
          "nullable": true
        },
        "currency": {
          "type": "text",
          "nullable": true,
          "default": {
            "value": "AOA"
          }
        },
        "popular": {
          "type": "bool",
          "nullable": true,
          "default": {
            "value": false
          }
        },
        "active": {
          "type": "bool",
          "nullable": true,
          "default": {
            "value": true
          }
        },
        "position": {
          "type": "int",
          "nullable": true,
          "default": {
            "value": 0
          }
        },
        "created_at": {
          "type": "datetime",
          "nullable": true,
          "default": "now"
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [
        [
          "extension"
        ]
      ],
      "fks": [],
      "autoUpdatedAt": false
    },
    "site_email_plans": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "name": {
          "type": "text"
        },
        "description": {
          "type": "text",
          "nullable": true
        },
        "badge": {
          "type": "text",
          "nullable": true
        },
        "price_monthly": {
          "type": "decimal",
          "nullable": true
        },
        "price_annual": {
          "type": "decimal",
          "nullable": true
        },
        "discount_annual": {
          "type": "int",
          "nullable": true,
          "default": {
            "value": 0
          }
        },
        "features": {
          "type": "array",
          "nullable": true
        },
        "active": {
          "type": "bool",
          "nullable": true,
          "default": {
            "value": true
          }
        },
        "featured": {
          "type": "bool",
          "nullable": true,
          "default": {
            "value": false
          }
        },
        "position": {
          "type": "int",
          "nullable": true,
          "default": {
            "value": 0
          }
        },
        "created_at": {
          "type": "datetime",
          "nullable": true,
          "default": "now"
        },
        "currency": {
          "type": "text",
          "nullable": true,
          "default": {
            "value": "AOA"
          }
        },
        "storage_gb": {
          "type": "int",
          "nullable": true,
          "default": {
            "value": 10
          }
        },
        "accounts": {
          "type": "int",
          "nullable": true,
          "default": {
            "value": 5
          }
        },
        "color": {
          "type": "text",
          "nullable": true,
          "default": {
            "value": "#3B82F6"
          }
        },
        "popular": {
          "type": "bool",
          "nullable": true,
          "default": {
            "value": false
          }
        },
        "slug": {
          "type": "text",
          "nullable": true
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [
        [
          "slug"
        ]
      ],
      "fks": [],
      "autoUpdatedAt": false
    },
    "site_home_hero": {
      "columns": {
        "id": {
          "type": "int",
          "default": {
            "value": 1
          }
        },
        "mode": {
          "type": "text",
          "default": {
            "value": "carousel"
          }
        },
        "video_url": {
          "type": "text",
          "nullable": true
        },
        "video_storage_path": {
          "type": "text",
          "nullable": true
        },
        "video_file_name": {
          "type": "text",
          "nullable": true
        },
        "video_size_bytes": {
          "type": "int",
          "nullable": true
        },
        "updated_at": {
          "type": "datetime",
          "default": "now"
        },
        "updated_by": {
          "type": "uuid",
          "nullable": true
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [],
      "fks": [],
      "autoUpdatedAt": true
    },
    "site_hosting_plans": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "name": {
          "type": "text"
        },
        "description": {
          "type": "text",
          "nullable": true
        },
        "badge": {
          "type": "text",
          "nullable": true
        },
        "price_monthly": {
          "type": "decimal",
          "nullable": true
        },
        "price_annual": {
          "type": "decimal",
          "nullable": true
        },
        "discount_annual": {
          "type": "int",
          "nullable": true,
          "default": {
            "value": 0
          }
        },
        "features": {
          "type": "array",
          "nullable": true
        },
        "active": {
          "type": "bool",
          "nullable": true,
          "default": {
            "value": true
          }
        },
        "featured": {
          "type": "bool",
          "nullable": true,
          "default": {
            "value": false
          }
        },
        "position": {
          "type": "int",
          "nullable": true,
          "default": {
            "value": 0
          }
        },
        "created_at": {
          "type": "datetime",
          "nullable": true,
          "default": "now"
        },
        "currency": {
          "type": "text",
          "nullable": true,
          "default": {
            "value": "AOA"
          }
        },
        "slug": {
          "type": "text",
          "nullable": true
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [
        [
          "slug"
        ]
      ],
      "fks": [],
      "autoUpdatedAt": false
    },
    "site_team": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "is_ceo": {
          "type": "bool",
          "nullable": true,
          "default": {
            "value": false
          }
        },
        "name": {
          "type": "text"
        },
        "role": {
          "type": "text",
          "nullable": true
        },
        "title": {
          "type": "text",
          "nullable": true,
          "default": {
            "value": "Especialista"
          }
        },
        "bio": {
          "type": "text",
          "nullable": true
        },
        "photo_url": {
          "type": "text",
          "nullable": true
        },
        "flag": {
          "type": "text",
          "nullable": true
        },
        "country": {
          "type": "text",
          "nullable": true
        },
        "accent_color": {
          "type": "text",
          "nullable": true,
          "default": {
            "value": "#F5B700"
          }
        },
        "position": {
          "type": "int",
          "nullable": true,
          "default": {
            "value": 0
          }
        },
        "active": {
          "type": "bool",
          "nullable": true,
          "default": {
            "value": true
          }
        },
        "created_at": {
          "type": "datetime",
          "nullable": true,
          "default": "now"
        },
        "country_code": {
          "type": "text",
          "nullable": true
        },
        "specialty": {
          "type": "text",
          "nullable": true
        },
        "secondary_flag": {
          "type": "text",
          "nullable": true
        },
        "secondary_country_code": {
          "type": "text",
          "nullable": true
        },
        "secondary_country_name": {
          "type": "text",
          "nullable": true
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [
        [
          "name"
        ]
      ],
      "fks": [],
      "autoUpdatedAt": false
    },
    "sso_audit_logs": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "profile_id": {
          "type": "uuid"
        },
        "service_id": {
          "type": "uuid",
          "nullable": true
        },
        "hosting_account_id": {
          "type": "uuid",
          "nullable": true
        },
        "access_type": {
          "type": "text"
        },
        "ip_address": {
          "type": "text",
          "nullable": true
        },
        "user_agent": {
          "type": "text",
          "nullable": true
        },
        "success": {
          "type": "bool",
          "default": {
            "value": false
          }
        },
        "error_message": {
          "type": "text",
          "nullable": true
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [],
      "fks": [
        {
          "name": "sso_audit_logs_profile_id_fkey",
          "columns": [
            "profile_id"
          ],
          "refTable": "profiles",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "sso_audit_logs_service_id_fkey",
          "columns": [
            "service_id"
          ],
          "refTable": "services",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "sso_audit_logs_hosting_account_id_fkey",
          "columns": [
            "hosting_account_id"
          ],
          "refTable": "hosting_accounts",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": false
    },
    "ticket_messages": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "ticket_id": {
          "type": "uuid"
        },
        "profile_id": {
          "type": "uuid"
        },
        "message": {
          "type": "text"
        },
        "is_staff": {
          "type": "bool",
          "default": {
            "value": false
          }
        },
        "attachments": {
          "type": "json",
          "nullable": true,
          "default": {
            "value": []
          }
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        },
        "is_internal": {
          "type": "bool",
          "default": {
            "value": false
          }
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [],
      "fks": [
        {
          "name": "ticket_messages_ticket_id_fkey",
          "columns": [
            "ticket_id"
          ],
          "refTable": "tickets",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "ticket_messages_profile_id_fkey",
          "columns": [
            "profile_id"
          ],
          "refTable": "profiles",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": false
    },
    "ticket_attachments": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "ticket_id": {
          "type": "uuid"
        },
        "message_id": {
          "type": "uuid",
          "nullable": true
        },
        "invoice_id": {
          "type": "uuid",
          "nullable": true
        },
        "file_name": {
          "type": "text"
        },
        "storage_path": {
          "type": "text"
        },
        "mime_type": {
          "type": "text",
          "default": {
            "value": "application/pdf"
          }
        },
        "file_size": {
          "type": "int",
          "nullable": true
        },
        "uploaded_by": {
          "type": "uuid",
          "nullable": true
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [],
      "fks": [
        {
          "name": "ticket_attachments_ticket_id_fkey",
          "columns": [
            "ticket_id"
          ],
          "refTable": "tickets",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "ticket_attachments_message_id_fkey",
          "columns": [
            "message_id"
          ],
          "refTable": "ticket_messages",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "ticket_attachments_invoice_id_fkey",
          "columns": [
            "invoice_id"
          ],
          "refTable": "invoices",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "ticket_attachments_uploaded_by_fkey",
          "columns": [
            "uploaded_by"
          ],
          "refTable": "auth_users",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": false
    },
    "whm_accounts": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "server_id": {
          "type": "uuid"
        },
        "whm_username": {
          "type": "text"
        },
        "primary_domain": {
          "type": "text"
        },
        "contact_email": {
          "type": "text",
          "nullable": true
        },
        "package_name": {
          "type": "text",
          "nullable": true
        },
        "ip_address": {
          "type": "text",
          "nullable": true
        },
        "owner": {
          "type": "text",
          "nullable": true
        },
        "partition": {
          "type": "text",
          "nullable": true
        },
        "disk_used_mb": {
          "type": "int",
          "default": {
            "value": 0
          }
        },
        "disk_limit_mb": {
          "type": "int",
          "nullable": true
        },
        "unix_startdate": {
          "type": "int",
          "nullable": true
        },
        "account_created_at": {
          "type": "datetime",
          "nullable": true
        },
        "is_suspended": {
          "type": "bool",
          "default": {
            "value": false
          }
        },
        "suspension_reason": {
          "type": "text",
          "nullable": true
        },
        "theme": {
          "type": "text",
          "nullable": true
        },
        "php_version": {
          "type": "text",
          "nullable": true
        },
        "max_pop": {
          "type": "text",
          "nullable": true
        },
        "max_sub": {
          "type": "text",
          "nullable": true
        },
        "max_sql": {
          "type": "text",
          "nullable": true
        },
        "max_ftp": {
          "type": "text",
          "nullable": true
        },
        "profile_id": {
          "type": "uuid",
          "nullable": true
        },
        "service_id": {
          "type": "uuid",
          "nullable": true
        },
        "hosting_account_id": {
          "type": "uuid",
          "nullable": true
        },
        "raw_metadata": {
          "type": "json",
          "nullable": true
        },
        "status": {
          "type": "text",
          "default": {
            "value": "active"
          }
        },
        "last_synced_at": {
          "type": "datetime",
          "default": "now"
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        },
        "updated_at": {
          "type": "datetime",
          "default": "now"
        },
        "sync_status": {
          "type": "text",
          "default": {
            "value": "linked"
          }
        },
        "requires_manual_link": {
          "type": "bool",
          "default": {
            "value": false
          }
        },
        "link_status": {
          "type": "text",
          "default": {
            "value": "linked"
          }
        },
        "notes": {
          "type": "text",
          "nullable": true
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [
        [
          "server_id",
          "primary_domain"
        ],
        [
          "server_id",
          "whm_username"
        ]
      ],
      "fks": [
        {
          "name": "whm_accounts_server_id_fkey",
          "columns": [
            "server_id"
          ],
          "refTable": "servers",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "whm_accounts_profile_id_fkey",
          "columns": [
            "profile_id"
          ],
          "refTable": "profiles",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "whm_accounts_service_id_fkey",
          "columns": [
            "service_id"
          ],
          "refTable": "services",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "whm_accounts_hosting_account_id_fkey",
          "columns": [
            "hosting_account_id"
          ],
          "refTable": "hosting_accounts",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": false
    },
    "whm_package_mappings": {
      "columns": {
        "id": {
          "type": "uuid",
          "default": "uuid"
        },
        "server_id": {
          "type": "uuid",
          "nullable": true
        },
        "whm_package_name": {
          "type": "text"
        },
        "plan_id": {
          "type": "uuid",
          "nullable": true
        },
        "label": {
          "type": "text",
          "nullable": true
        },
        "created_at": {
          "type": "datetime",
          "default": "now"
        },
        "updated_at": {
          "type": "datetime",
          "default": "now"
        }
      },
      "pk": [
        "id"
      ],
      "uniques": [
        [
          "server_id",
          "whm_package_name"
        ]
      ],
      "fks": [
        {
          "name": "whm_package_mappings_server_id_fkey",
          "columns": [
            "server_id"
          ],
          "refTable": "servers",
          "refColumns": [
            "id"
          ]
        },
        {
          "name": "whm_package_mappings_plan_id_fkey",
          "columns": [
            "plan_id"
          ],
          "refTable": "plans",
          "refColumns": [
            "id"
          ]
        }
      ],
      "autoUpdatedAt": false
    }
  }
}
