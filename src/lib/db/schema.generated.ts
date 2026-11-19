// AUTO-GERADO por scripts/mariadb/generate-schema.mjs — não editar à mão.
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
        "defaultUuid": true,
        "hasDefault": true
      },
      "profile_id": {
        "kind": "uuid",
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
        "nullable": true
      },
      "entity_id": {
        "kind": "uuid",
        "nullable": true
      },
      "description": {
        "kind": "text"
      },
      "ip_address": {
        "kind": "text",
        "nullable": true
      },
      "user_agent": {
        "kind": "text",
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
        "defaultUuid": true,
        "hasDefault": true
      },
      "conversation_id": {
        "kind": "uuid",
        "nullable": true
      },
      "profile_id": {
        "kind": "uuid",
        "nullable": true
      },
      "tool_name": {
        "kind": "text"
      },
      "tool_input": {
        "kind": "json",
        "nullable": true
      },
      "result_summary": {
        "kind": "text",
        "nullable": true
      },
      "success": {
        "kind": "bool",
        "hasDefault": true
      },
      "error_message": {
        "kind": "text",
        "nullable": true
      },
      "ip_address": {
        "kind": "text",
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
        "defaultUuid": true,
        "hasDefault": true
      },
      "profile_id": {
        "kind": "uuid",
        "nullable": true
      },
      "session_token": {
        "kind": "text",
        "nullable": true
      },
      "title": {
        "kind": "text",
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
        "autoUpdate": true,
        "hasDefault": true
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
        "defaultUuid": true,
        "hasDefault": true
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
        "nullable": true
      },
      "tool_input": {
        "kind": "json",
        "nullable": true
      },
      "tool_output": {
        "kind": "json",
        "nullable": true
      },
      "tokens_used": {
        "kind": "int",
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
        "defaultUuid": true,
        "hasDefault": true
      },
      "page_slug": {
        "kind": "text"
      },
      "page_name": {
        "kind": "text"
      },
      "breadcrumb": {
        "kind": "text",
        "nullable": true
      },
      "breadcrumb_parent": {
        "kind": "text",
        "nullable": true
      },
      "breadcrumb_parent_href": {
        "kind": "text",
        "nullable": true
      },
      "tag": {
        "kind": "text",
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
        "nullable": true
      },
      "button_secondary_link": {
        "kind": "text",
        "nullable": true
      },
      "price_text": {
        "kind": "text",
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
        "autoUpdate": true,
        "hasDefault": true
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
        "defaultUuid": true,
        "hasDefault": true
      },
      "profile_id": {
        "kind": "uuid"
      },
      "company_name": {
        "kind": "text",
        "nullable": true
      },
      "tax_id": {
        "kind": "text",
        "nullable": true
      },
      "address": {
        "kind": "text",
        "nullable": true
      },
      "city": {
        "kind": "text",
        "nullable": true
      },
      "state": {
        "kind": "text",
        "nullable": true
      },
      "postal_code": {
        "kind": "text",
        "nullable": true
      },
      "notes": {
        "kind": "text",
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
        "autoUpdate": true,
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
        "defaultUuid": true,
        "hasDefault": true
      },
      "company_name": {
        "kind": "text",
        "hasDefault": true
      },
      "logo_url": {
        "kind": "text",
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
        "nullable": true
      },
      "address": {
        "kind": "text",
        "nullable": true
      },
      "bank_name": {
        "kind": "text",
        "nullable": true
      },
      "account_holder": {
        "kind": "text",
        "nullable": true
      },
      "account_number": {
        "kind": "text",
        "nullable": true
      },
      "iban": {
        "kind": "text",
        "nullable": true
      },
      "swift": {
        "kind": "text",
        "nullable": true
      },
      "payment_instructions": {
        "kind": "text",
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
        "autoUpdate": true,
        "hasDefault": true
      },
      "updated_by": {
        "kind": "uuid",
        "nullable": true
      },
      "active_unique_key": {
        "kind": "int",
        "generated": true,
        "hidden": true
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
        "defaultUuid": true,
        "hasDefault": true
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
      ],
      [
        "name"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "defaultUuid": true,
        "hasDefault": true
      },
      "profile_id": {
        "kind": "uuid"
      },
      "service_id": {
        "kind": "uuid",
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
        "nullable": true
      },
      "price_paid": {
        "kind": "number",
        "nullable": true
      },
      "currency": {
        "kind": "enum",
        "values": [
          "AKZ",
          "BRL",
          "USD"
        ],
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "autoUpdate": true,
        "hasDefault": true
      },
      "order_id": {
        "kind": "uuid",
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
  "email_logs": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "defaultUuid": true,
        "hasDefault": true
      },
      "profile_id": {
        "kind": "uuid",
        "nullable": true
      },
      "invoice_id": {
        "kind": "uuid",
        "nullable": true
      },
      "order_id": {
        "kind": "uuid",
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
        "nullable": true
      },
      "provider": {
        "kind": "text",
        "hasDefault": true
      },
      "provider_message_id": {
        "kind": "text",
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
        "nullable": true
      },
      "sent_at": {
        "kind": "timestamp",
        "nullable": true
      },
      "delivered_at": {
        "kind": "timestamp",
        "nullable": true
      },
      "failed_at": {
        "kind": "timestamp",
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "autoUpdate": true,
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
        "defaultUuid": true,
        "hasDefault": true
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
        "autoUpdate": true,
        "hasDefault": true
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
        "defaultUuid": true,
        "hasDefault": true
      },
      "service_id": {
        "kind": "uuid"
      },
      "profile_id": {
        "kind": "uuid"
      },
      "server_id": {
        "kind": "uuid",
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
        "autoUpdate": true,
        "hasDefault": true
      },
      "disk_limit_mb": {
        "kind": "int",
        "nullable": true
      },
      "package_name": {
        "kind": "text",
        "nullable": true
      },
      "ip_address": {
        "kind": "text",
        "nullable": true
      },
      "suspension_reason": {
        "kind": "text",
        "nullable": true
      },
      "last_synced_at": {
        "kind": "timestamp",
        "nullable": true
      },
      "cpanel_url": {
        "kind": "text",
        "nullable": true
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
        "table": "emails",
        "refColumns": [
          "hosting_id"
        ],
        "name": "emails_hosting_id_fkey",
        "many": true
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
  "invoice_items": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "defaultUuid": true,
        "hasDefault": true
      },
      "invoice_id": {
        "kind": "uuid"
      },
      "product_id": {
        "kind": "uuid",
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
        "defaultUuid": true,
        "hasDefault": true
      },
      "invoice_id": {
        "kind": "uuid"
      },
      "order_id": {
        "kind": "uuid",
        "nullable": true
      },
      "ticket_id": {
        "kind": "uuid",
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
        "nullable": true
      },
      "status": {
        "kind": "text",
        "hasDefault": true
      },
      "error_message": {
        "kind": "text",
        "nullable": true
      },
      "initiated_by": {
        "kind": "uuid",
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
        "autoUpdate": true,
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
        "name": "invoice_send_logs_invoice_id_fkey"
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
        "defaultUuid": true,
        "hasDefault": true
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
        "nullable": true
      },
      "notes": {
        "kind": "text",
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "autoUpdate": true,
        "hasDefault": true
      },
      "order_id": {
        "kind": "uuid",
        "nullable": true
      },
      "amount_paid": {
        "kind": "number",
        "hasDefault": true
      },
      "ticket_id": {
        "kind": "uuid",
        "nullable": true
      },
      "issue_date": {
        "kind": "date",
        "hasDefault": true
      },
      "pdf_storage_path": {
        "kind": "text",
        "nullable": true
      },
      "emailed_at": {
        "kind": "timestamp",
        "nullable": true
      },
      "created_by": {
        "kind": "uuid",
        "nullable": true
      },
      "email_to": {
        "kind": "text",
        "nullable": true
      },
      "email_from": {
        "kind": "text",
        "nullable": true
      },
      "email_provider": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "email_provider_id": {
        "kind": "text",
        "nullable": true
      },
      "email_sent_at": {
        "kind": "timestamp",
        "nullable": true
      },
      "email_last_error": {
        "kind": "text",
        "nullable": true
      },
      "email_attempts": {
        "kind": "int",
        "hasDefault": true
      },
      "email_delivered_at": {
        "kind": "timestamp",
        "nullable": true
      },
      "email_bounced_at": {
        "kind": "timestamp",
        "nullable": true
      },
      "email_status": {
        "kind": "text",
        "hasDefault": true
      },
      "proof_file": {
        "kind": "text",
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
        "table": "email_logs",
        "refColumns": [
          "invoice_id"
        ],
        "name": "email_logs_invoice_id_fkey",
        "many": true
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
  "notifications": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "defaultUuid": true,
        "hasDefault": true
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
  "order_items": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "defaultUuid": true,
        "hasDefault": true
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
  "orders": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "defaultUuid": true,
        "hasDefault": true
      },
      "user_id": {
        "kind": "uuid",
        "nullable": true
      },
      "billing_cycle": {
        "kind": "text",
        "hasDefault": true
      },
      "domain_name": {
        "kind": "text",
        "nullable": true
      },
      "domain_action": {
        "kind": "text",
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
        "nullable": true
      },
      "transfer_ref": {
        "kind": "text",
        "nullable": true
      },
      "notes": {
        "kind": "text",
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
        "nullable": true
      },
      "ns2": {
        "kind": "text",
        "nullable": true
      },
      "ns3": {
        "kind": "text",
        "nullable": true
      },
      "ns4": {
        "kind": "text",
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
  "payments": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "defaultUuid": true,
        "hasDefault": true
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
        "nullable": true
      },
      "gateway_data": {
        "kind": "json",
        "hasDefault": true,
        "nullable": true
      },
      "paid_at": {
        "kind": "timestamp",
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "order_id": {
        "kind": "uuid",
        "nullable": true
      },
      "proof_url": {
        "kind": "text",
        "nullable": true
      },
      "proof_filename": {
        "kind": "text",
        "nullable": true
      },
      "proof_mime": {
        "kind": "text",
        "nullable": true
      },
      "transfer_ref": {
        "kind": "text",
        "nullable": true
      },
      "transfer_date": {
        "kind": "date",
        "nullable": true
      },
      "payer_name": {
        "kind": "text",
        "nullable": true
      },
      "payer_bank": {
        "kind": "text",
        "nullable": true
      },
      "declared_amount": {
        "kind": "number",
        "nullable": true
      },
      "rejection_reason": {
        "kind": "text",
        "nullable": true
      },
      "reviewed_at": {
        "kind": "timestamp",
        "nullable": true
      },
      "reviewed_by": {
        "kind": "uuid",
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
        "defaultUuid": true,
        "hasDefault": true
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
        "autoUpdate": true,
        "hasDefault": true
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
  "product_features": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "defaultUuid": true,
        "hasDefault": true
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
        "defaultUuid": true,
        "hasDefault": true
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
        "nullable": true
      },
      "badge": {
        "kind": "text",
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
        "nullable": true
      },
      "price_6months": {
        "kind": "number",
        "nullable": true
      },
      "price_1year": {
        "kind": "number",
        "nullable": true
      },
      "price_2years": {
        "kind": "number",
        "nullable": true
      },
      "price_3years": {
        "kind": "number",
        "nullable": true
      },
      "color": {
        "kind": "text",
        "nullable": true
      },
      "href_override": {
        "kind": "text",
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
        "nullable": true
      },
      "cta_label": {
        "kind": "text",
        "nullable": true
      },
      "cta_url": {
        "kind": "text",
        "nullable": true
      },
      "currency": {
        "kind": "text",
        "hasDefault": true
      },
      "price_aoa": {
        "kind": "number",
        "nullable": true
      },
      "price_brl": {
        "kind": "number",
        "nullable": true
      },
      "price_usd": {
        "kind": "number",
        "nullable": true
      },
      "use_auto_conversion": {
        "kind": "bool",
        "hasDefault": true
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
        "autoUpdate": true,
        "hasDefault": true
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
        "table": "whm_accounts",
        "refColumns": [
          "profile_id"
        ],
        "name": "whm_accounts_profile_id_fkey",
        "many": true
      }
    ]
  },
  "servers": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "defaultUuid": true,
        "hasDefault": true
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
        "nullable": true
      },
      "whm_api_token": {
        "kind": "text",
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
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "autoUpdate": true,
        "hasDefault": true
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
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "defaultUuid": true,
        "hasDefault": true
      },
      "profile_id": {
        "kind": "uuid"
      },
      "plan_id": {
        "kind": "uuid",
        "nullable": true
      },
      "server_id": {
        "kind": "uuid",
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
        "nullable": true
      },
      "expires_at": {
        "kind": "timestamp",
        "nullable": true
      },
      "auto_renew": {
        "kind": "bool",
        "hasDefault": true
      },
      "notes": {
        "kind": "text",
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "autoUpdate": true,
        "hasDefault": true
      },
      "order_id": {
        "kind": "uuid",
        "nullable": true
      },
      "service_type": {
        "kind": "text",
        "nullable": true
      },
      "service_name": {
        "kind": "text",
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
        "defaultUuid": true,
        "hasDefault": true
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
        "nullable": true
      },
      "title": {
        "kind": "text",
        "nullable": true
      },
      "subtitle": {
        "kind": "text",
        "nullable": true
      },
      "cta_text": {
        "kind": "text",
        "nullable": true
      },
      "cta_href": {
        "kind": "text",
        "nullable": true
      },
      "cta_secondary_text": {
        "kind": "text",
        "nullable": true
      },
      "cta_secondary_href": {
        "kind": "text",
        "nullable": true
      },
      "features": {
        "kind": "array",
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
        "defaultUuid": true,
        "hasDefault": true
      },
      "extension": {
        "kind": "text"
      },
      "price_monthly": {
        "kind": "number",
        "nullable": true
      },
      "price_annual": {
        "kind": "number",
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
        "defaultUuid": true,
        "hasDefault": true
      },
      "name": {
        "kind": "text"
      },
      "description": {
        "kind": "text",
        "nullable": true
      },
      "badge": {
        "kind": "text",
        "nullable": true
      },
      "price_monthly": {
        "kind": "number",
        "nullable": true
      },
      "price_annual": {
        "kind": "number",
        "nullable": true
      },
      "discount_annual": {
        "kind": "int",
        "hasDefault": true,
        "nullable": true
      },
      "features": {
        "kind": "array",
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
        "nullable": true
      },
      "video_storage_path": {
        "kind": "text",
        "nullable": true
      },
      "video_file_name": {
        "kind": "text",
        "nullable": true
      },
      "video_size_bytes": {
        "kind": "int",
        "nullable": true
      },
      "updated_at": {
        "kind": "timestamp",
        "autoUpdate": true,
        "hasDefault": true
      },
      "updated_by": {
        "kind": "uuid",
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
        "defaultUuid": true,
        "hasDefault": true
      },
      "name": {
        "kind": "text"
      },
      "description": {
        "kind": "text",
        "nullable": true
      },
      "badge": {
        "kind": "text",
        "nullable": true
      },
      "price_monthly": {
        "kind": "number",
        "nullable": true
      },
      "price_annual": {
        "kind": "number",
        "nullable": true
      },
      "discount_annual": {
        "kind": "int",
        "hasDefault": true,
        "nullable": true
      },
      "features": {
        "kind": "array",
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
        "defaultUuid": true,
        "hasDefault": true
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
        "nullable": true
      },
      "title": {
        "kind": "text",
        "hasDefault": true,
        "nullable": true
      },
      "bio": {
        "kind": "text",
        "nullable": true
      },
      "photo_url": {
        "kind": "text",
        "nullable": true
      },
      "flag": {
        "kind": "text",
        "nullable": true
      },
      "country": {
        "kind": "text",
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
        "nullable": true
      },
      "specialty": {
        "kind": "text",
        "nullable": true
      },
      "secondary_flag": {
        "kind": "text",
        "nullable": true
      },
      "secondary_country_code": {
        "kind": "text",
        "nullable": true
      },
      "secondary_country_name": {
        "kind": "text",
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
        "defaultUuid": true,
        "hasDefault": true
      },
      "profile_id": {
        "kind": "uuid"
      },
      "service_id": {
        "kind": "uuid",
        "nullable": true
      },
      "hosting_account_id": {
        "kind": "uuid",
        "nullable": true
      },
      "access_type": {
        "kind": "text"
      },
      "ip_address": {
        "kind": "text",
        "nullable": true
      },
      "user_agent": {
        "kind": "text",
        "nullable": true
      },
      "success": {
        "kind": "bool",
        "hasDefault": true
      },
      "error_message": {
        "kind": "text",
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
  "ticket_attachments": {
    "pk": [
      "id"
    ],
    "unique": [],
    "columns": {
      "id": {
        "kind": "uuid",
        "defaultUuid": true,
        "hasDefault": true
      },
      "ticket_id": {
        "kind": "uuid"
      },
      "message_id": {
        "kind": "uuid",
        "nullable": true
      },
      "invoice_id": {
        "kind": "uuid",
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
        "nullable": true
      },
      "uploaded_by": {
        "kind": "uuid",
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
        "defaultUuid": true,
        "hasDefault": true
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
      },
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
        "defaultUuid": true,
        "hasDefault": true
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
        "nullable": true
      },
      "service_id": {
        "kind": "uuid",
        "nullable": true
      },
      "closed_at": {
        "kind": "timestamp",
        "nullable": true
      },
      "created_at": {
        "kind": "timestamp",
        "hasDefault": true
      },
      "updated_at": {
        "kind": "timestamp",
        "autoUpdate": true,
        "hasDefault": true
      },
      "ticket_number": {
        "kind": "text",
        "nullable": true
      },
      "category": {
        "kind": "text",
        "nullable": true
      },
      "domain_id": {
        "kind": "uuid",
        "nullable": true
      }
    },
    "relations": [
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
        "table": "invoices",
        "refColumns": [
          "ticket_id"
        ],
        "name": "invoices_ticket_id_fkey",
        "many": true
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
  "whm_accounts": {
    "pk": [
      "id"
    ],
    "unique": [
      [
        "server_id",
        "primary_domain"
      ],
      [
        "server_id",
        "whm_username"
      ]
    ],
    "columns": {
      "id": {
        "kind": "uuid",
        "defaultUuid": true,
        "hasDefault": true
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
        "nullable": true
      },
      "package_name": {
        "kind": "text",
        "nullable": true
      },
      "ip_address": {
        "kind": "text",
        "nullable": true
      },
      "owner": {
        "kind": "text",
        "nullable": true
      },
      "partition": {
        "kind": "text",
        "nullable": true
      },
      "disk_used_mb": {
        "kind": "int",
        "hasDefault": true
      },
      "disk_limit_mb": {
        "kind": "int",
        "nullable": true
      },
      "unix_startdate": {
        "kind": "int",
        "nullable": true
      },
      "account_created_at": {
        "kind": "timestamp",
        "nullable": true
      },
      "is_suspended": {
        "kind": "bool",
        "hasDefault": true
      },
      "suspension_reason": {
        "kind": "text",
        "nullable": true
      },
      "theme": {
        "kind": "text",
        "nullable": true
      },
      "php_version": {
        "kind": "text",
        "nullable": true
      },
      "max_pop": {
        "kind": "text",
        "nullable": true
      },
      "max_sub": {
        "kind": "text",
        "nullable": true
      },
      "max_sql": {
        "kind": "text",
        "nullable": true
      },
      "max_ftp": {
        "kind": "text",
        "nullable": true
      },
      "profile_id": {
        "kind": "uuid",
        "nullable": true
      },
      "service_id": {
        "kind": "uuid",
        "nullable": true
      },
      "hosting_account_id": {
        "kind": "uuid",
        "nullable": true
      },
      "raw_metadata": {
        "kind": "json",
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
        "defaultUuid": true,
        "hasDefault": true
      },
      "server_id": {
        "kind": "uuid",
        "nullable": true
      },
      "whm_package_name": {
        "kind": "text"
      },
      "plan_id": {
        "kind": "uuid",
        "nullable": true
      },
      "label": {
        "kind": "text",
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
