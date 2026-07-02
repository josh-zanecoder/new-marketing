/**
 * MortDash CRM — Tailwind theme extension (portable)
 * Merge into your tailwind.config.js: theme.extend = { ...mortdashTheme }
 */
export const mortdashTheme = {
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554',
    },
  },
  fontFamily: {
    sans: [
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      'Roboto',
      'Helvetica Neue',
      'Arial',
      'sans-serif',
    ],
  },
  borderRadius: {
    card: '1rem',
    'button-lg': '0.75rem',
    input: '0.5rem',
    'input-lg': '0.625rem',
    badge: '0.5rem',
    'nav-item': '0.625rem',
  },
  boxShadow: {
    card: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
    modal:
      '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    'focus-ring': '0 0 0 3px rgba(37, 99, 235, 0.1)',
    'cta': '0 4px 12px rgba(0, 0, 0, 0.15)',
    'cta-hover': '0 6px 20px rgba(0, 0, 0, 0.2)',
  },
  fontSize: {
    '2xs': ['0.6875rem', { lineHeight: '1.15' }],
    'table-header': ['0.8125rem', { lineHeight: '1.4', letterSpacing: '0.05em' }],
    'dialog-body': ['0.9375rem', { lineHeight: '1.6' }],
  },
  maxWidth: {
    'modal-sm': '420px',
    'modal-md': '520px',
    'modal-default': '600px',
    'modal-lg': '800px',
  },
  spacing: {
    sidebar: '260px',
    'sidebar-collapsed': '72px',
  },
  zIndex: {
    sidebar: '40',
    'sidebar-mobile': '50',
    backdrop: '45',
    modal: '1000',
    dialog: '10002',
    dropdown: '10060',
  },
  transitionTimingFunction: {
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
}
