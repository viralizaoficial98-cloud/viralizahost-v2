// AUTO-GERADO por scripts/mariadb/generate-meta.mjs (a partir do MariaDB) — não editar à mão.
// Metadados do schema MariaDB usados pela camada de dados (src/lib/db).
import type { SchemaMeta } from './types'

export const SCHEMA_META: SchemaMeta = {
  "activity_logs": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "profile_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "action": {
        "kind": "enum",
        "values": [
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
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "entity_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "description": {
        "kind": "text"
      },
      "ip_address": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "user_agent": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "metadata": {
        "kind": "json",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      }
    },
    "relations": [
      {
        "columns": [
          "profile_id"
        ],
        "table": "profiles",
        "refColumns": [
          "id"
        ],
        "name": "activity_logs_profile_id_fkey"
      }
    ]
  },
  "ai_audit_logs": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "conversation_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "profile_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "tool_name": {
        "kind": "text"
      },
      "tool_input": {
        "kind": "json",
        "hasDefault": true,
        "nullable": true
      },
      "result_summary": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "success": {
        "kind": "bool",
        "hasDefault": true
      },
      "error_message": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "ip_address": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      }
    },
    "relations": [
      {
        "columns": [
          "conversation_id"
        ],
        "table": "ai_conversations",
        "refColumns": [
          "id"
        ],
        "name": "ai_audit_logs_conversation_id_fkey"
      }
    ]
  },
  "ai_conversations": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "profile_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "session_token": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "title": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "status": {
        "kind": "text",
        "hasDefault": true
      },
      "user_level": {
        "kind": "text",
        "hasDefault": true
      },
      "metadata": {
        "kind": "json",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "autoUpdate": true
      }
    },
    "relations": [
      {
        "columns": [
          "id"
        ],
        "table": "ai_audit_logs",
        "refColumns": [
          "conversation_id"
        ],
        "name": "ai_audit_logs_conversation_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "ai_messages",
        "refColumns": [
          "conversation_id"
        ],
        "name": "ai_messages_conversation_id_fkey",
        "many": true
      }
    ]
  },
  "ai_messages": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "conversation_id": {
        "kind": "uuid"
      },
      "role": {
        "kind": "text"
      },
      "content": {
        "kind": "text"
      },
      "tool_name": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "tool_input": {
        "kind": "json",
        "hasDefault": true,
        "nullable": true
      },
      "tool_output": {
        "kind": "json",
        "hasDefault": true,
        "nullable": true
      },
      "tokens_used": {
        "kind": "int",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      }
    },
    "relations": [
      {
        "columns": [
          "conversation_id"
        ],
        "table": "ai_conversations",
        "refColumns": [
          "id"
        ],
        "name": "ai_messages_conversation_id_fkey"
      }
    ]
  },
  "banner_pages": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "page_slug"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "page_slug": {
        "kind": "text"
      },
      "page_name": {
        "kind": "text"
      },
      "breadcrumb": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "breadcrumb_parent": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "breadcrumb_parent_href": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "tag": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "title": {
        "kind": "text",
        "hasDefault": true
      },
      "subtitle": {
        "kind": "text",
        "hasDefault": true
      },
      "bg_image": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "bg_color": {
        "kind": "text",
        "hasDefault": true
      },
      "highlights": {
        "kind": "array",
        "hasDefault": true
      },
      "button_primary_text": {
        "kind": "text",
        "hasDefault": true
      },
      "button_primary_link": {
        "kind": "text",
        "hasDefault": true
      },
      "button_secondary_text": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "button_secondary_link": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "price_text": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "show_guarantee": {
        "kind": "bool",
        "hasDefault": true
      },
      "overlay_opacity": {
        "kind": "number",
        "hasDefault": true
      },
      "is_active": {
        "kind": "bool",
        "hasDefault": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "autoUpdate": true
      }
    },
    "relations": []
  },
  "clients": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "profile_id"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "profile_id": {
        "kind": "uuid"
      },
      "company_name": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "tax_id": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "address": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "city": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "state": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "postal_code": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "notes": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "credit_balance": {
        "kind": "number",
        "hasDefault": true
      },
      "currency": {
        "kind": "enum",
        "values": [
          "AKZ",
          "BRL",
          "USD"
        ],
        "hasDefault": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "autoUpdate": true
      }
    },
    "relations": [
      {
        "columns": [
          "profile_id"
        ],
        "table": "profiles",
        "refColumns": [
          "id"
        ],
        "name": "clients_profile_id_fkey"
      }
    ]
  },
  "company_billing_settings": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "company_name": {
        "kind": "text",
        "hasDefault": true
      },
      "logo_url": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "email": {
        "kind": "text",
        "hasDefault": true
      },
      "website": {
        "kind": "text",
        "hasDefault": true
      },
      "phone": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "address": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "bank_name": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "account_holder": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "account_number": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "iban": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "swift": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "payment_instructions": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "footer_text": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "default_due_days": {
        "kind": "int",
        "hasDefault": true
      },
      "email_subject_template": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "email_body_template": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "auto_email_on_create": {
        "kind": "bool",
        "hasDefault": true
      },
      "active": {
        "kind": "bool",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "autoUpdate": true
      },
      "updated_by": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "active_unique_key": {
        "kind": "bool",
        "generated": true,
        "hidden": true
      },
      "tax_rate": {
        "kind": "number",
        "hasDefault": true
      },
      "tax_label": {
        "kind": "text",
        "hasDefault": true
      },
      "payment_methods": {
        "kind": "json",
        "hasDefault": true,
        "nullable": true
      }
    },
    "relations": []
  },
  "currency_rates": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "base_currency",
        "target_currency"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "base_currency": {
        "kind": "text",
        "hasDefault": true
      },
      "target_currency": {
        "kind": "text"
      },
      "rate": {
        "kind": "number"
      },
      "source": {
        "kind": "text",
        "hasDefault": true
      },
      "is_active": {
        "kind": "bool",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      }
    },
    "relations": []
  },
  "domains": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "name",
        "extension"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "profile_id": {
        "kind": "uuid"
      },
      "service_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "name": {
        "kind": "text"
      },
      "extension": {
        "kind": "text"
      },
      "full_domain": {
        "kind": "text",
        "generated": true
      },
      "status": {
        "kind": "enum",
        "values": [
          "active",
          "expired",
          "pending",
          "transferred",
          "locked"
        ],
        "hasDefault": true
      },
      "registrar": {
        "kind": "text",
        "hasDefault": true
      },
      "nameservers": {
        "kind": "json",
        "hasDefault": true
      },
      "auto_renew": {
        "kind": "bool",
        "hasDefault": true
      },
      "is_locked": {
        "kind": "bool",
        "hasDefault": true
      },
      "whois_privacy": {
        "kind": "bool",
        "hasDefault": true
      },
      "registered_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "expires_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "price_paid": {
        "kind": "number",
        "hasDefault": true,
        "nullable": true
      },
      "currency": {
        "kind": "enum",
        "values": [
          "AKZ",
          "BRL",
          "USD"
        ],
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "autoUpdate": true
      },
      "order_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "registered": {
        "kind": "bool",
        "hasDefault": true
      }
    },
    "relations": [
      {
        "columns": [
          "order_id"
        ],
        "table": "orders",
        "refColumns": [
          "id"
        ],
        "name": "domains_order_id_fkey"
      },
      {
        "columns": [
          "profile_id"
        ],
        "table": "profiles",
        "refColumns": [
          "id"
        ],
        "name": "domains_profile_id_fkey"
      },
      {
        "columns": [
          "service_id"
        ],
        "table": "services",
        "refColumns": [
          "id"
        ],
        "name": "domains_service_id_fkey"
      },
      {
        "columns": [
          "id"
        ],
        "table": "tickets",
        "refColumns": [
          "domain_id"
        ],
        "name": "tickets_domain_id_fkey",
        "many": true
      }
    ]
  },
  "domain_prices": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "extension",
        "operation",
        "years"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "extension": {
        "kind": "text"
      },
      "operation": {
        "kind": "enum",
        "values": [
          "register",
          "renew",
          "transfer"
        ]
      },
      "years": {
        "kind": "int",
        "hasDefault": true
      },
      "price": {
        "kind": "number",
        "hasDefault": true,
        "nullable": true
      },
      "currency": {
        "kind": "enum",
        "values": [
          "AKZ",
          "BRL",
          "USD"
        ],
        "hasDefault": true
      },
      "status": {
        "kind": "enum",
        "values": [
          "active",
          "draft",
          "on_request"
        ],
        "hasDefault": true
      },
      "registrar": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "reference": {
        "kind": "json",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "autoUpdate": true
      }
    },
    "relations": []
  },
  "emails": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "email_address"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "hosting_id": {
        "kind": "uuid"
      },
      "profile_id": {
        "kind": "uuid"
      },
      "email_address": {
        "kind": "text"
      },
      "display_name": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "quota_mb": {
        "kind": "int",
        "hasDefault": true
      },
      "used_mb": {
        "kind": "int",
        "hasDefault": true
      },
      "status": {
        "kind": "text",
        "hasDefault": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "autoUpdate": true
      }
    },
    "relations": [
      {
        "columns": [
          "hosting_id"
        ],
        "table": "hosting_accounts",
        "refColumns": [
          "id"
        ],
        "name": "emails_hosting_id_fkey"
      },
      {
        "columns": [
          "profile_id"
        ],
        "table": "profiles",
        "refColumns": [
          "id"
        ],
        "name": "emails_profile_id_fkey"
      }
    ]
  },
  "email_logs": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "profile_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "invoice_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "order_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "recipient": {
        "kind": "text"
      },
      "sender": {
        "kind": "text",
        "hasDefault": true
      },
      "subject": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "provider": {
        "kind": "text",
        "hasDefault": true
      },
      "provider_message_id": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "status": {
        "kind": "enum",
        "values": [
          "queued",
          "processing",
          "sent",
          "delivered",
          "bounced",
          "failed",
          "complained",
          "delayed"
        ],
        "hasDefault": true
      },
      "error_message": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "attempts": {
        "kind": "int",
        "hasDefault": true
      },
      "initiated_by_agent": {
        "kind": "bool",
        "hasDefault": true
      },
      "initiated_by": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "sent_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "delivered_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "failed_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "autoUpdate": true
      }
    },
    "relations": [
      {
        "columns": [
          "invoice_id"
        ],
        "table": "invoices",
        "refColumns": [
          "id"
        ],
        "name": "email_logs_invoice_id_fkey"
      },
      {
        "columns": [
          "order_id"
        ],
        "table": "orders",
        "refColumns": [
          "id"
        ],
        "name": "email_logs_order_id_fkey"
      },
      {
        "columns": [
          "profile_id"
        ],
        "table": "profiles",
        "refColumns": [
          "id"
        ],
        "name": "email_logs_profile_id_fkey"
      }
    ]
  },
  "hosting_accounts": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "cpanel_username"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "service_id": {
        "kind": "uuid"
      },
      "profile_id": {
        "kind": "uuid"
      },
      "server_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "cpanel_username": {
        "kind": "text"
      },
      "primary_domain": {
        "kind": "text"
      },
      "status": {
        "kind": "enum",
        "values": [
          "pending",
          "active",
          "suspended",
          "cancelled",
          "expired",
          "pending_provisioning"
        ],
        "hasDefault": true
      },
      "disk_used_mb": {
        "kind": "int",
        "hasDefault": true
      },
      "bandwidth_used_mb": {
        "kind": "int",
        "hasDefault": true
      },
      "email_count": {
        "kind": "int",
        "hasDefault": true
      },
      "db_count": {
        "kind": "int",
        "hasDefault": true
      },
      "php_version": {
        "kind": "text",
        "hasDefault": true
      },
      "ssl_enabled": {
        "kind": "bool",
        "hasDefault": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "autoUpdate": true
      },
      "disk_limit_mb": {
        "kind": "int",
        "hasDefault": true,
        "nullable": true
      },
      "package_name": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "ip_address": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "suspension_reason": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "last_synced_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "cpanel_url": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      }
    },
    "relations": [
      {
        "columns": [
          "id"
        ],
        "table": "emails",
        "refColumns": [
          "hosting_id"
        ],
        "name": "emails_hosting_id_fkey",
        "many": true
      },
      {
        "columns": [
          "profile_id"
        ],
        "table": "profiles",
        "refColumns": [
          "id"
        ],
        "name": "hosting_accounts_profile_id_fkey"
      },
      {
        "columns": [
          "server_id"
        ],
        "table": "servers",
        "refColumns": [
          "id"
        ],
        "name": "hosting_accounts_server_id_fkey"
      },
      {
        "columns": [
          "service_id"
        ],
        "table": "services",
        "refColumns": [
          "id"
        ],
        "name": "hosting_accounts_service_id_fkey"
      },
      {
        "columns": [
          "id"
        ],
        "table": "sso_audit_logs",
        "refColumns": [
          "hosting_account_id"
        ],
        "name": "sso_audit_logs_hosting_account_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "whm_accounts",
        "refColumns": [
          "hosting_account_id"
        ],
        "name": "whm_accounts_hosting_account_id_fkey",
        "many": true
      }
    ]
  },
  "invoices": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "invoice_number"
      ],
      [
        "order_id"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "invoice_number": {
        "kind": "text",
        "appDefault": "((('INV-'::text || to_char(now(), 'YYYY'::text)) || '-'::text) || lpad((floor((random() * (99999)::double precision)))::text, 5, '0'::text))",
        "hasDefault": true
      },
      "profile_id": {
        "kind": "uuid"
      },
      "service_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "status": {
        "kind": "enum",
        "values": [
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
        "hasDefault": true
      },
      "currency": {
        "kind": "enum",
        "values": [
          "AKZ",
          "BRL",
          "USD"
        ],
        "hasDefault": true
      },
      "subtotal": {
        "kind": "number",
        "hasDefault": true
      },
      "discount": {
        "kind": "number",
        "hasDefault": true
      },
      "tax": {
        "kind": "number",
        "hasDefault": true
      },
      "total": {
        "kind": "number",
        "hasDefault": true
      },
      "items": {
        "kind": "json",
        "hasDefault": true
      },
      "due_date": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "paid_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "notes": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "autoUpdate": true
      },
      "order_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "amount_paid": {
        "kind": "number",
        "hasDefault": true
      },
      "ticket_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "issue_date": {
        "kind": "date",
        "hasDefault": true
      },
      "pdf_storage_path": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "emailed_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "created_by": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "email_to": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "email_from": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "email_provider": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "email_provider_id": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "email_sent_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "email_last_error": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "email_attempts": {
        "kind": "int",
        "hasDefault": true
      },
      "email_delivered_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "email_bounced_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "email_status": {
        "kind": "text",
        "hasDefault": true
      },
      "proof_file": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      }
    },
    "relations": [
      {
        "columns": [
          "id"
        ],
        "table": "email_logs",
        "refColumns": [
          "invoice_id"
        ],
        "name": "email_logs_invoice_id_fkey",
        "many": true
      },
      {
        "columns": [
          "order_id"
        ],
        "table": "orders",
        "refColumns": [
          "id"
        ],
        "name": "invoices_order_id_fkey"
      },
      {
        "columns": [
          "profile_id"
        ],
        "table": "profiles",
        "refColumns": [
          "id"
        ],
        "name": "invoices_profile_id_fkey"
      },
      {
        "columns": [
          "service_id"
        ],
        "table": "services",
        "refColumns": [
          "id"
        ],
        "name": "invoices_service_id_fkey"
      },
      {
        "columns": [
          "ticket_id"
        ],
        "table": "tickets",
        "refColumns": [
          "id"
        ],
        "name": "invoices_ticket_id_fkey"
      },
      {
        "columns": [
          "id"
        ],
        "table": "invoice_items",
        "refColumns": [
          "invoice_id"
        ],
        "name": "invoice_items_invoice_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "invoice_send_logs",
        "refColumns": [
          "invoice_id"
        ],
        "name": "invoice_send_logs_invoice_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "payments",
        "refColumns": [
          "invoice_id"
        ],
        "name": "payments_invoice_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "ticket_attachments",
        "refColumns": [
          "invoice_id"
        ],
        "name": "ticket_attachments_invoice_id_fkey",
        "many": true
      }
    ]
  },
  "invoice_items": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "invoice_id": {
        "kind": "uuid"
      },
      "product_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "description": {
        "kind": "text"
      },
      "quantity": {
        "kind": "int",
        "hasDefault": true
      },
      "unit_price": {
        "kind": "number",
        "hasDefault": true
      },
      "subtotal": {
        "kind": "number",
        "hasDefault": true
      },
      "position": {
        "kind": "int",
        "hasDefault": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      }
    },
    "relations": [
      {
        "columns": [
          "invoice_id"
        ],
        "table": "invoices",
        "refColumns": [
          "id"
        ],
        "name": "invoice_items_invoice_id_fkey"
      },
      {
        "columns": [
          "product_id"
        ],
        "table": "products",
        "refColumns": [
          "id"
        ],
        "name": "invoice_items_product_id_fkey"
      }
    ]
  },
  "invoice_send_logs": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "invoice_id": {
        "kind": "uuid"
      },
      "order_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "ticket_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "customer_id": {
        "kind": "uuid"
      },
      "recipient": {
        "kind": "text"
      },
      "provider": {
        "kind": "text",
        "hasDefault": true
      },
      "provider_message_id": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "status": {
        "kind": "text",
        "hasDefault": true
      },
      "error_message": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "initiated_by": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "initiated_by_agent": {
        "kind": "bool",
        "hasDefault": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "autoUpdate": true
      }
    },
    "relations": [
      {
        "columns": [
          "invoice_id"
        ],
        "table": "invoices",
        "refColumns": [
          "id"
        ],
        "name": "invoice_send_logs_invoice_id_fkey"
      }
    ]
  },
  "notifications": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "profile_id": {
        "kind": "uuid"
      },
      "type": {
        "kind": "enum",
        "values": [
          "info",
          "warning",
          "error",
          "success"
        ],
        "hasDefault": true
      },
      "title": {
        "kind": "text"
      },
      "message": {
        "kind": "text"
      },
      "link": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "is_read": {
        "kind": "bool",
        "hasDefault": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      }
    },
    "relations": [
      {
        "columns": [
          "profile_id"
        ],
        "table": "profiles",
        "refColumns": [
          "id"
        ],
        "name": "notifications_profile_id_fkey"
      }
    ]
  },
  "orders": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "user_id",
        "idempotency_key"
      ],
      [
        "order_number"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "user_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "billing_cycle": {
        "kind": "text",
        "hasDefault": true
      },
      "domain_name": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "domain_action": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "payment_method": {
        "kind": "text",
        "hasDefault": true
      },
      "amount": {
        "kind": "number",
        "hasDefault": true
      },
      "status": {
        "kind": "text",
        "hasDefault": true
      },
      "proof_file": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "transfer_ref": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "notes": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "use_default_ns": {
        "kind": "bool",
        "hasDefault": true
      },
      "ns1": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "ns2": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "ns3": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "ns4": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "idempotency_key": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "order_number": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "currency": {
        "kind": "enum",
        "values": [
          "AKZ",
          "BRL",
          "USD"
        ],
        "hasDefault": true
      },
      "subtotal": {
        "kind": "number",
        "hasDefault": true,
        "nullable": true
      },
      "tax_rate": {
        "kind": "number",
        "hasDefault": true
      },
      "tax_amount": {
        "kind": "number",
        "hasDefault": true
      },
      "payment_status": {
        "kind": "enum",
        "values": [
          "unpaid",
          "proof_submitted",
          "paid",
          "failed",
          "refunded"
        ],
        "hasDefault": true
      },
      "activation_status": {
        "kind": "enum",
        "values": [
          "pending",
          "in_progress",
          "active",
          "partial",
          "manual_required",
          "failed",
          "cancelled"
        ],
        "hasDefault": true
      },
      "hold_reason": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "paid_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "billing_details": {
        "kind": "json",
        "hasDefault": true,
        "nullable": true
      },
      "review_flag": {
        "kind": "enum",
        "values": [
          "test",
          "real"
        ],
        "hasDefault": true,
        "nullable": true
      },
      "review_note": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "review_by": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "review_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      }
    },
    "relations": [
      {
        "columns": [
          "id"
        ],
        "table": "domains",
        "refColumns": [
          "order_id"
        ],
        "name": "domains_order_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "email_logs",
        "refColumns": [
          "order_id"
        ],
        "name": "email_logs_order_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "invoices",
        "refColumns": [
          "order_id"
        ],
        "name": "invoices_order_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "order_items",
        "refColumns": [
          "order_id"
        ],
        "name": "order_items_order_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "payments",
        "refColumns": [
          "order_id"
        ],
        "name": "payments_order_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "services",
        "refColumns": [
          "order_id"
        ],
        "name": "services_order_id_fkey",
        "many": true
      }
    ]
  },
  "order_items": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "order_id": {
        "kind": "uuid"
      },
      "service_name": {
        "kind": "text"
      },
      "service_type": {
        "kind": "text",
        "hasDefault": true
      },
      "price": {
        "kind": "number",
        "hasDefault": true
      },
      "quantity": {
        "kind": "int",
        "hasDefault": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "product_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "product_slug": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "billing_cycle": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "months": {
        "kind": "int",
        "hasDefault": true,
        "nullable": true
      },
      "unit_price": {
        "kind": "number",
        "hasDefault": true,
        "nullable": true
      },
      "line_total": {
        "kind": "number",
        "hasDefault": true,
        "nullable": true
      },
      "renewal_price": {
        "kind": "number",
        "hasDefault": true,
        "nullable": true
      },
      "domain_name": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "domain_operation": {
        "kind": "enum",
        "values": [
          "register",
          "transfer",
          "existing",
          "renew"
        ],
        "hasDefault": true,
        "nullable": true
      },
      "epp_code_enc": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "renews_service_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "availability": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "years": {
        "kind": "int",
        "hasDefault": true,
        "nullable": true
      },
      "nameservers": {
        "kind": "json",
        "hasDefault": true,
        "nullable": true
      }
    },
    "relations": [
      {
        "columns": [
          "order_id"
        ],
        "table": "orders",
        "refColumns": [
          "id"
        ],
        "name": "order_items_order_id_fkey"
      }
    ]
  },
  "payments": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "gateway_event_id"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "invoice_id": {
        "kind": "uuid"
      },
      "profile_id": {
        "kind": "uuid"
      },
      "method": {
        "kind": "enum",
        "values": [
          "credit_card",
          "paypal",
          "mercadopago",
          "pix",
          "bank_transfer",
          "multicaixa"
        ],
        "hasDefault": true
      },
      "amount": {
        "kind": "number",
        "hasDefault": true
      },
      "currency": {
        "kind": "enum",
        "values": [
          "AKZ",
          "BRL",
          "USD"
        ],
        "hasDefault": true
      },
      "status": {
        "kind": "text",
        "hasDefault": true
      },
      "gateway_ref": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "gateway_data": {
        "kind": "json",
        "hasDefault": true,
        "nullable": true
      },
      "paid_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "order_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "proof_url": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "proof_filename": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "proof_mime": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "transfer_ref": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "transfer_date": {
        "kind": "date",
        "hasDefault": true,
        "nullable": true
      },
      "payer_name": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "payer_bank": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "declared_amount": {
        "kind": "number",
        "hasDefault": true,
        "nullable": true
      },
      "rejection_reason": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "reviewed_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "reviewed_by": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "gateway_event_id": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      }
    },
    "relations": [
      {
        "columns": [
          "invoice_id"
        ],
        "table": "invoices",
        "refColumns": [
          "id"
        ],
        "name": "payments_invoice_id_fkey"
      },
      {
        "columns": [
          "order_id"
        ],
        "table": "orders",
        "refColumns": [
          "id"
        ],
        "name": "payments_order_id_fkey"
      },
      {
        "columns": [
          "profile_id"
        ],
        "table": "profiles",
        "refColumns": [
          "id"
        ],
        "name": "payments_profile_id_fkey"
      }
    ]
  },
  "plans": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "slug"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "slug": {
        "kind": "text"
      },
      "name": {
        "kind": "text"
      },
      "type": {
        "kind": "enum",
        "values": [
          "shared",
          "vps",
          "dedicated",
          "reseller"
        ],
        "hasDefault": true
      },
      "description": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "features": {
        "kind": "json",
        "hasDefault": true
      },
      "price_akz": {
        "kind": "number",
        "hasDefault": true
      },
      "price_brl": {
        "kind": "number",
        "hasDefault": true
      },
      "price_usd": {
        "kind": "number",
        "hasDefault": true
      },
      "disk_gb": {
        "kind": "int",
        "hasDefault": true
      },
      "bandwidth_gb": {
        "kind": "int",
        "hasDefault": true
      },
      "email_accounts": {
        "kind": "int",
        "hasDefault": true
      },
      "max_domains": {
        "kind": "int",
        "hasDefault": true
      },
      "max_subdomains": {
        "kind": "int",
        "hasDefault": true
      },
      "max_databases": {
        "kind": "int",
        "hasDefault": true
      },
      "is_popular": {
        "kind": "bool",
        "hasDefault": true
      },
      "is_active": {
        "kind": "bool",
        "hasDefault": true
      },
      "sort_order": {
        "kind": "int",
        "hasDefault": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "autoUpdate": true
      }
    },
    "relations": [
      {
        "columns": [
          "id"
        ],
        "table": "services",
        "refColumns": [
          "plan_id"
        ],
        "name": "services_plan_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "whm_package_mappings",
        "refColumns": [
          "plan_id"
        ],
        "name": "whm_package_mappings_plan_id_fkey",
        "many": true
      }
    ]
  },
  "products": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "slug"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "slug": {
        "kind": "text"
      },
      "category": {
        "kind": "text"
      },
      "name": {
        "kind": "text"
      },
      "description": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "badge": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "popular": {
        "kind": "bool",
        "hasDefault": true
      },
      "active": {
        "kind": "bool",
        "hasDefault": true
      },
      "position": {
        "kind": "int",
        "hasDefault": true
      },
      "price_monthly": {
        "kind": "number",
        "hasDefault": true,
        "nullable": true
      },
      "price_6months": {
        "kind": "number",
        "hasDefault": true,
        "nullable": true
      },
      "price_1year": {
        "kind": "number",
        "hasDefault": true,
        "nullable": true
      },
      "price_2years": {
        "kind": "number",
        "hasDefault": true,
        "nullable": true
      },
      "price_3years": {
        "kind": "number",
        "hasDefault": true,
        "nullable": true
      },
      "color": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "href_override": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "meta": {
        "kind": "json",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "subcategory": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "cta_label": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "cta_url": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "currency": {
        "kind": "text",
        "hasDefault": true
      },
      "price_aoa": {
        "kind": "number",
        "hasDefault": true,
        "nullable": true
      },
      "price_brl": {
        "kind": "number",
        "hasDefault": true,
        "nullable": true
      },
      "price_usd": {
        "kind": "number",
        "hasDefault": true,
        "nullable": true
      },
      "use_auto_conversion": {
        "kind": "bool",
        "hasDefault": true
      },
      "sale_status": {
        "kind": "enum",
        "values": [
          "active",
          "draft",
          "on_request"
        ],
        "hasDefault": true
      },
      "service_type": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "provisioning": {
        "kind": "enum",
        "values": [
          "whm",
          "registrar",
          "manual"
        ],
        "hasDefault": true
      },
      "whm_package": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "quantity_unit": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "max_quantity": {
        "kind": "int",
        "hasDefault": true
      },
      "pricing_note": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "whm_server_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      }
    },
    "relations": [
      {
        "columns": [
          "id"
        ],
        "table": "invoice_items",
        "refColumns": [
          "product_id"
        ],
        "name": "invoice_items_product_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "product_features",
        "refColumns": [
          "product_id"
        ],
        "name": "product_features_product_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "product_prices",
        "refColumns": [
          "product_id"
        ],
        "name": "product_prices_product_id_fkey",
        "many": true
      }
    ]
  },
  "product_features": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "product_id": {
        "kind": "uuid"
      },
      "feature": {
        "kind": "text"
      },
      "included": {
        "kind": "bool",
        "hasDefault": true
      },
      "position": {
        "kind": "int",
        "hasDefault": true
      }
    },
    "relations": [
      {
        "columns": [
          "product_id"
        ],
        "table": "products",
        "refColumns": [
          "id"
        ],
        "name": "product_features_product_id_fkey"
      }
    ]
  },
  "product_prices": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "product_id",
        "cycle"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "product_id": {
        "kind": "uuid"
      },
      "cycle": {
        "kind": "enum",
        "values": [
          "monthly",
          "3months",
          "6months",
          "1year",
          "2years",
          "3years"
        ]
      },
      "months": {
        "kind": "int"
      },
      "price": {
        "kind": "number"
      },
      "renewal_price": {
        "kind": "number"
      },
      "currency": {
        "kind": "enum",
        "values": [
          "AKZ",
          "BRL",
          "USD"
        ],
        "hasDefault": true
      },
      "active": {
        "kind": "bool",
        "hasDefault": true
      },
      "reference": {
        "kind": "json",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "autoUpdate": true
      }
    },
    "relations": [
      {
        "columns": [
          "product_id"
        ],
        "table": "products",
        "refColumns": [
          "id"
        ],
        "name": "product_prices_product_id_fkey"
      }
    ]
  },
  "profiles": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "email"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid"
      },
      "email": {
        "kind": "text"
      },
      "full_name": {
        "kind": "text",
        "hasDefault": true
      },
      "phone": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "country": {
        "kind": "text",
        "hasDefault": true
      },
      "role": {
        "kind": "enum",
        "values": [
          "client",
          "admin",
          "reseller"
        ],
        "hasDefault": true
      },
      "currency": {
        "kind": "enum",
        "values": [
          "AKZ",
          "BRL",
          "USD"
        ],
        "hasDefault": true
      },
      "avatar_url": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "is_active": {
        "kind": "bool",
        "hasDefault": true
      },
      "email_verified": {
        "kind": "bool",
        "hasDefault": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "autoUpdate": true
      }
    },
    "relations": [
      {
        "columns": [
          "id"
        ],
        "table": "activity_logs",
        "refColumns": [
          "profile_id"
        ],
        "name": "activity_logs_profile_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "clients",
        "refColumns": [
          "profile_id"
        ],
        "name": "clients_profile_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "domains",
        "refColumns": [
          "profile_id"
        ],
        "name": "domains_profile_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "emails",
        "refColumns": [
          "profile_id"
        ],
        "name": "emails_profile_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "email_logs",
        "refColumns": [
          "profile_id"
        ],
        "name": "email_logs_profile_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "hosting_accounts",
        "refColumns": [
          "profile_id"
        ],
        "name": "hosting_accounts_profile_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "invoices",
        "refColumns": [
          "profile_id"
        ],
        "name": "invoices_profile_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "notifications",
        "refColumns": [
          "profile_id"
        ],
        "name": "notifications_profile_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "payments",
        "refColumns": [
          "profile_id"
        ],
        "name": "payments_profile_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "services",
        "refColumns": [
          "profile_id"
        ],
        "name": "services_profile_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "sso_audit_logs",
        "refColumns": [
          "profile_id"
        ],
        "name": "sso_audit_logs_profile_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "tickets",
        "refColumns": [
          "assigned_to"
        ],
        "name": "tickets_assigned_to_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "tickets",
        "refColumns": [
          "profile_id"
        ],
        "name": "tickets_profile_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "ticket_messages",
        "refColumns": [
          "profile_id"
        ],
        "name": "ticket_messages_profile_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "whm_accounts",
        "refColumns": [
          "profile_id"
        ],
        "name": "whm_accounts_profile_id_fkey",
        "many": true
      }
    ]
  },
  "quote_requests": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "reference"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid"
      },
      "reference": {
        "kind": "text"
      },
      "product_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "product_slug": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "product_name": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "profile_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "name": {
        "kind": "text"
      },
      "email": {
        "kind": "text"
      },
      "phone": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "company": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "message": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "status": {
        "kind": "enum",
        "values": [
          "new",
          "contacted",
          "quoted",
          "closed"
        ],
        "hasDefault": true
      },
      "admin_notes": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "autoUpdate": true
      }
    },
    "relations": []
  },
  "registrar_contacts": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "provider",
        "profile_id",
        "tld",
        "details_hash"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid"
      },
      "provider": {
        "kind": "text"
      },
      "profile_id": {
        "kind": "uuid"
      },
      "tld": {
        "kind": "text"
      },
      "details_hash": {
        "kind": "text"
      },
      "provider_contact_id": {
        "kind": "text"
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      }
    },
    "relations": []
  },
  "registrar_operations": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "client_ref"
      ],
      [
        "service_id",
        "operation"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid"
      },
      "service_id": {
        "kind": "uuid"
      },
      "operation": {
        "kind": "enum",
        "values": [
          "register",
          "renew",
          "transfer"
        ]
      },
      "domain": {
        "kind": "text"
      },
      "provider": {
        "kind": "text"
      },
      "mode": {
        "kind": "enum",
        "values": [
          "test",
          "live"
        ]
      },
      "client_ref": {
        "kind": "text"
      },
      "status": {
        "kind": "enum",
        "values": [
          "pending",
          "submitted",
          "succeeded",
          "failed",
          "unknown"
        ],
        "hasDefault": true
      },
      "provider_ref": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "provider_status": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "message": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "attempts": {
        "kind": "int",
        "hasDefault": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "autoUpdate": true
      },
      "authorized_by": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "authorized_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "cost_amount": {
        "kind": "number",
        "hasDefault": true,
        "nullable": true
      },
      "cost_currency": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "item_id": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "provider_order_id": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "ns_status": {
        "kind": "enum",
        "values": [
          "pending",
          "applied",
          "failed"
        ],
        "hasDefault": true,
        "nullable": true
      },
      "ns_message": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "dns_status": {
        "kind": "enum",
        "values": [
          "pending",
          "confirmed"
        ],
        "hasDefault": true,
        "nullable": true
      },
      "dns_checked_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "locked_until": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      }
    },
    "relations": []
  },
  "registrar_operation_events": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid"
      },
      "operation_id": {
        "kind": "uuid"
      },
      "kind": {
        "kind": "text"
      },
      "http_status": {
        "kind": "int",
        "hasDefault": true,
        "nullable": true
      },
      "outcome": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "message": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "actor_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      }
    },
    "relations": []
  },
  "registrar_settings": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "int"
      },
      "provider": {
        "kind": "text",
        "hasDefault": true
      },
      "mode": {
        "kind": "enum",
        "values": [
          "test",
          "live"
        ],
        "hasDefault": true
      },
      "enabled": {
        "kind": "bool",
        "hasDefault": true
      },
      "api_url": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "username": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "secret_enc": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "extensions": {
        "kind": "json",
        "hasDefault": true,
        "nullable": true
      },
      "last_test_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "last_test_ok": {
        "kind": "bool",
        "hasDefault": true,
        "nullable": true
      },
      "last_test_message": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "updated_by": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "autoUpdate": true
      },
      "default_nameservers": {
        "kind": "json",
        "hasDefault": true,
        "nullable": true
      }
    },
    "relations": []
  },
  "servers": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "name": {
        "kind": "text"
      },
      "hostname": {
        "kind": "text"
      },
      "ip_address": {
        "kind": "text"
      },
      "location": {
        "kind": "text",
        "hasDefault": true
      },
      "whm_url": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "whm_api_token": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "whm_username": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "is_active": {
        "kind": "bool",
        "hasDefault": true
      },
      "max_accounts": {
        "kind": "int",
        "hasDefault": true
      },
      "current_load": {
        "kind": "number",
        "hasDefault": true
      },
      "notes": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "autoUpdate": true
      }
    },
    "relations": [
      {
        "columns": [
          "id"
        ],
        "table": "hosting_accounts",
        "refColumns": [
          "server_id"
        ],
        "name": "hosting_accounts_server_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "services",
        "refColumns": [
          "server_id"
        ],
        "name": "services_server_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "whm_accounts",
        "refColumns": [
          "server_id"
        ],
        "name": "whm_accounts_server_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "whm_package_mappings",
        "refColumns": [
          "server_id"
        ],
        "name": "whm_package_mappings_server_id_fkey",
        "many": true
      }
    ]
  },
  "services": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "order_item_id"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "profile_id": {
        "kind": "uuid"
      },
      "plan_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "server_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "status": {
        "kind": "enum",
        "values": [
          "pending",
          "active",
          "suspended",
          "cancelled",
          "expired",
          "pending_provisioning"
        ],
        "hasDefault": true
      },
      "currency": {
        "kind": "enum",
        "values": [
          "AKZ",
          "BRL",
          "USD"
        ],
        "hasDefault": true
      },
      "price": {
        "kind": "number",
        "hasDefault": true
      },
      "billing_cycle": {
        "kind": "text",
        "hasDefault": true
      },
      "started_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "expires_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "auto_renew": {
        "kind": "bool",
        "hasDefault": true
      },
      "notes": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "autoUpdate": true
      },
      "order_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "service_type": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "service_name": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "product_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "order_item_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "renews_service_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "domain": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "renewal_price": {
        "kind": "number",
        "hasDefault": true,
        "nullable": true
      },
      "provisioning_status": {
        "kind": "enum",
        "values": [
          "pending",
          "in_progress",
          "active",
          "manual_required",
          "failed"
        ],
        "hasDefault": true
      },
      "provisioning_error": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "provisioning_attempts": {
        "kind": "int",
        "hasDefault": true
      },
      "provisioned_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "external_ref": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "next_due_date": {
        "kind": "date",
        "hasDefault": true,
        "nullable": true
      },
      "activation_source": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "activated_by": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      }
    },
    "relations": [
      {
        "columns": [
          "id"
        ],
        "table": "domains",
        "refColumns": [
          "service_id"
        ],
        "name": "domains_service_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "hosting_accounts",
        "refColumns": [
          "service_id"
        ],
        "name": "hosting_accounts_service_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "invoices",
        "refColumns": [
          "service_id"
        ],
        "name": "invoices_service_id_fkey",
        "many": true
      },
      {
        "columns": [
          "order_id"
        ],
        "table": "orders",
        "refColumns": [
          "id"
        ],
        "name": "services_order_id_fkey"
      },
      {
        "columns": [
          "plan_id"
        ],
        "table": "plans",
        "refColumns": [
          "id"
        ],
        "name": "services_plan_id_fkey"
      },
      {
        "columns": [
          "profile_id"
        ],
        "table": "profiles",
        "refColumns": [
          "id"
        ],
        "name": "services_profile_id_fkey"
      },
      {
        "columns": [
          "server_id"
        ],
        "table": "servers",
        "refColumns": [
          "id"
        ],
        "name": "services_server_id_fkey"
      },
      {
        "columns": [
          "id"
        ],
        "table": "sso_audit_logs",
        "refColumns": [
          "service_id"
        ],
        "name": "sso_audit_logs_service_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "tickets",
        "refColumns": [
          "service_id"
        ],
        "name": "tickets_service_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "whm_accounts",
        "refColumns": [
          "service_id"
        ],
        "name": "whm_accounts_service_id_fkey",
        "many": true
      }
    ]
  },
  "shopping_carts": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "token_hash"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid"
      },
      "token_hash": {
        "kind": "text"
      },
      "profile_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "items": {
        "kind": "json",
        "hasDefault": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "autoUpdate": true
      }
    },
    "relations": []
  },
  "site_banners": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "position"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "position": {
        "kind": "int",
        "hasDefault": true
      },
      "active": {
        "kind": "bool",
        "hasDefault": true
      },
      "bg_image": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "bg_color": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "accent_color": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "tag": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "title": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "subtitle": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "cta_text": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "cta_href": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "cta_secondary_text": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "cta_secondary_href": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "features": {
        "kind": "array",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      }
    },
    "relations": []
  },
  "site_domains": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "extension"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "extension": {
        "kind": "text"
      },
      "price_monthly": {
        "kind": "number",
        "hasDefault": true,
        "nullable": true
      },
      "price_annual": {
        "kind": "number",
        "hasDefault": true,
        "nullable": true
      },
      "currency": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "popular": {
        "kind": "bool",
        "hasDefault": true,
        "nullable": true
      },
      "active": {
        "kind": "bool",
        "hasDefault": true,
        "nullable": true
      },
      "position": {
        "kind": "int",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      }
    },
    "relations": []
  },
  "site_email_plans": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "slug"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "name": {
        "kind": "text"
      },
      "description": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "badge": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "price_monthly": {
        "kind": "number",
        "hasDefault": true,
        "nullable": true
      },
      "price_annual": {
        "kind": "number",
        "hasDefault": true,
        "nullable": true
      },
      "discount_annual": {
        "kind": "int",
        "hasDefault": true,
        "nullable": true
      },
      "features": {
        "kind": "array",
        "hasDefault": true,
        "nullable": true
      },
      "active": {
        "kind": "bool",
        "hasDefault": true,
        "nullable": true
      },
      "featured": {
        "kind": "bool",
        "hasDefault": true,
        "nullable": true
      },
      "position": {
        "kind": "int",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "currency": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "storage_gb": {
        "kind": "int",
        "hasDefault": true,
        "nullable": true
      },
      "accounts": {
        "kind": "int",
        "hasDefault": true,
        "nullable": true
      },
      "color": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "popular": {
        "kind": "bool",
        "hasDefault": true,
        "nullable": true
      },
      "slug": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      }
    },
    "relations": []
  },
  "site_home_hero": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "int",
        "hasDefault": true
      },
      "mode": {
        "kind": "text",
        "hasDefault": true
      },
      "video_url": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "video_storage_path": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "video_file_name": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "video_size_bytes": {
        "kind": "int",
        "hasDefault": true,
        "nullable": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "autoUpdate": true
      },
      "updated_by": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      }
    },
    "relations": []
  },
  "site_hosting_plans": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "slug"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "name": {
        "kind": "text"
      },
      "description": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "badge": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "price_monthly": {
        "kind": "number",
        "hasDefault": true,
        "nullable": true
      },
      "price_annual": {
        "kind": "number",
        "hasDefault": true,
        "nullable": true
      },
      "discount_annual": {
        "kind": "int",
        "hasDefault": true,
        "nullable": true
      },
      "features": {
        "kind": "array",
        "hasDefault": true,
        "nullable": true
      },
      "active": {
        "kind": "bool",
        "hasDefault": true,
        "nullable": true
      },
      "featured": {
        "kind": "bool",
        "hasDefault": true,
        "nullable": true
      },
      "position": {
        "kind": "int",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "currency": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "slug": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      }
    },
    "relations": []
  },
  "site_team": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "name"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "is_ceo": {
        "kind": "bool",
        "hasDefault": true,
        "nullable": true
      },
      "name": {
        "kind": "text"
      },
      "role": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "title": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "bio": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "photo_url": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "flag": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "country": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "accent_color": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "position": {
        "kind": "int",
        "hasDefault": true,
        "nullable": true
      },
      "active": {
        "kind": "bool",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "country_code": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "specialty": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "secondary_flag": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "secondary_country_code": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "secondary_country_name": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      }
    },
    "relations": []
  },
  "sso_audit_logs": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "profile_id": {
        "kind": "uuid"
      },
      "service_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "hosting_account_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "access_type": {
        "kind": "text"
      },
      "ip_address": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "user_agent": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "success": {
        "kind": "bool",
        "hasDefault": true
      },
      "error_message": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      }
    },
    "relations": [
      {
        "columns": [
          "hosting_account_id"
        ],
        "table": "hosting_accounts",
        "refColumns": [
          "id"
        ],
        "name": "sso_audit_logs_hosting_account_id_fkey"
      },
      {
        "columns": [
          "profile_id"
        ],
        "table": "profiles",
        "refColumns": [
          "id"
        ],
        "name": "sso_audit_logs_profile_id_fkey"
      },
      {
        "columns": [
          "service_id"
        ],
        "table": "services",
        "refColumns": [
          "id"
        ],
        "name": "sso_audit_logs_service_id_fkey"
      }
    ]
  },
  "tickets": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "ticket_number"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "profile_id": {
        "kind": "uuid"
      },
      "subject": {
        "kind": "text"
      },
      "status": {
        "kind": "enum",
        "values": [
          "open",
          "in_progress",
          "resolved",
          "closed"
        ],
        "hasDefault": true
      },
      "priority": {
        "kind": "enum",
        "values": [
          "low",
          "medium",
          "high",
          "critical"
        ],
        "hasDefault": true
      },
      "department": {
        "kind": "text",
        "hasDefault": true
      },
      "assigned_to": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "service_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "closed_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "autoUpdate": true
      },
      "ticket_number": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "category": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "domain_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      }
    },
    "relations": [
      {
        "columns": [
          "id"
        ],
        "table": "invoices",
        "refColumns": [
          "ticket_id"
        ],
        "name": "invoices_ticket_id_fkey",
        "many": true
      },
      {
        "columns": [
          "assigned_to"
        ],
        "table": "profiles",
        "refColumns": [
          "id"
        ],
        "name": "tickets_assigned_to_fkey"
      },
      {
        "columns": [
          "domain_id"
        ],
        "table": "domains",
        "refColumns": [
          "id"
        ],
        "name": "tickets_domain_id_fkey"
      },
      {
        "columns": [
          "profile_id"
        ],
        "table": "profiles",
        "refColumns": [
          "id"
        ],
        "name": "tickets_profile_id_fkey"
      },
      {
        "columns": [
          "service_id"
        ],
        "table": "services",
        "refColumns": [
          "id"
        ],
        "name": "tickets_service_id_fkey"
      },
      {
        "columns": [
          "id"
        ],
        "table": "ticket_attachments",
        "refColumns": [
          "ticket_id"
        ],
        "name": "ticket_attachments_ticket_id_fkey",
        "many": true
      },
      {
        "columns": [
          "id"
        ],
        "table": "ticket_messages",
        "refColumns": [
          "ticket_id"
        ],
        "name": "ticket_messages_ticket_id_fkey",
        "many": true
      }
    ]
  },
  "ticket_attachments": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "ticket_id": {
        "kind": "uuid"
      },
      "message_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "invoice_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "file_name": {
        "kind": "text"
      },
      "storage_path": {
        "kind": "text"
      },
      "mime_type": {
        "kind": "text",
        "hasDefault": true
      },
      "file_size": {
        "kind": "int",
        "hasDefault": true,
        "nullable": true
      },
      "uploaded_by": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      }
    },
    "relations": [
      {
        "columns": [
          "invoice_id"
        ],
        "table": "invoices",
        "refColumns": [
          "id"
        ],
        "name": "ticket_attachments_invoice_id_fkey"
      },
      {
        "columns": [
          "message_id"
        ],
        "table": "ticket_messages",
        "refColumns": [
          "id"
        ],
        "name": "ticket_attachments_message_id_fkey"
      },
      {
        "columns": [
          "ticket_id"
        ],
        "table": "tickets",
        "refColumns": [
          "id"
        ],
        "name": "ticket_attachments_ticket_id_fkey"
      }
    ]
  },
  "ticket_messages": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "ticket_id": {
        "kind": "uuid"
      },
      "profile_id": {
        "kind": "uuid"
      },
      "message": {
        "kind": "text"
      },
      "is_staff": {
        "kind": "bool",
        "hasDefault": true
      },
      "attachments": {
        "kind": "json",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "is_internal": {
        "kind": "bool",
        "hasDefault": true
      }
    },
    "relations": [
      {
        "columns": [
          "id"
        ],
        "table": "ticket_attachments",
        "refColumns": [
          "message_id"
        ],
        "name": "ticket_attachments_message_id_fkey",
        "many": true
      },
      {
        "columns": [
          "profile_id"
        ],
        "table": "profiles",
        "refColumns": [
          "id"
        ],
        "name": "ticket_messages_profile_id_fkey"
      },
      {
        "columns": [
          "ticket_id"
        ],
        "table": "tickets",
        "refColumns": [
          "id"
        ],
        "name": "ticket_messages_ticket_id_fkey"
      }
    ]
  },
  "whm_accounts": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "server_id",
        "whm_username"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "server_id": {
        "kind": "uuid"
      },
      "whm_username": {
        "kind": "text"
      },
      "primary_domain": {
        "kind": "text"
      },
      "contact_email": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "package_name": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "ip_address": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "owner": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "partition": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "disk_used_mb": {
        "kind": "int",
        "hasDefault": true
      },
      "disk_limit_mb": {
        "kind": "int",
        "hasDefault": true,
        "nullable": true
      },
      "unix_startdate": {
        "kind": "int",
        "hasDefault": true,
        "nullable": true
      },
      "account_created_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "is_suspended": {
        "kind": "bool",
        "hasDefault": true
      },
      "suspension_reason": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "theme": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "php_version": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "max_pop": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "max_sub": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "max_sql": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "max_ftp": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "profile_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "service_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "hosting_account_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "raw_metadata": {
        "kind": "json",
        "hasDefault": true,
        "nullable": true
      },
      "status": {
        "kind": "text",
        "hasDefault": true
      },
      "last_synced_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "sync_status": {
        "kind": "text",
        "hasDefault": true
      },
      "requires_manual_link": {
        "kind": "bool",
        "hasDefault": true
      },
      "link_status": {
        "kind": "text",
        "hasDefault": true
      },
      "notes": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "whm_uuid": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "link_candidate_profile_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "link_candidate_reason": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "linked_by": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "linked_at": {
        "kind": "timestamp",
        "hasDefault": true,
        "nullable": true
      },
      "link_method": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      }
    },
    "relations": [
      {
        "columns": [
          "hosting_account_id"
        ],
        "table": "hosting_accounts",
        "refColumns": [
          "id"
        ],
        "name": "whm_accounts_hosting_account_id_fkey"
      },
      {
        "columns": [
          "profile_id"
        ],
        "table": "profiles",
        "refColumns": [
          "id"
        ],
        "name": "whm_accounts_profile_id_fkey"
      },
      {
        "columns": [
          "server_id"
        ],
        "table": "servers",
        "refColumns": [
          "id"
        ],
        "name": "whm_accounts_server_id_fkey"
      },
      {
        "columns": [
          "service_id"
        ],
        "table": "services",
        "refColumns": [
          "id"
        ],
        "name": "whm_accounts_service_id_fkey"
      }
    ]
  },
  "whm_package_mappings": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "server_id",
        "whm_package_name"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "hasDefault": true,
        "defaultUuid": true
      },
      "server_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "whm_package_name": {
        "kind": "text"
      },
      "plan_id": {
        "kind": "uuid",
        "hasDefault": true,
        "nullable": true
      },
      "label": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "hasDefault": true
      }
    },
    "relations": [
      {
        "columns": [
          "plan_id"
        ],
        "table": "plans",
        "refColumns": [
          "id"
        ],
        "name": "whm_package_mappings_plan_id_fkey"
      },
      {
        "columns": [
          "server_id"
        ],
        "table": "servers",
        "refColumns": [
          "id"
        ],
        "name": "whm_package_mappings_server_id_fkey"
      }
    ]
  }
}
