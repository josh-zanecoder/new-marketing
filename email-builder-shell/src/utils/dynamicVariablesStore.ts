import { create } from 'zustand';

export type EmailDynamicVariable = {
  key: string;
  label: string;
  scopes?: Array<'subject' | 'body'>;
  enabled?: boolean;
};

/** Always available when tenant API is empty or unreachable. */
export const FALLBACK_BODY_DYNAMIC_VARIABLES: EmailDynamicVariable[] = [
  { key: 'unsubscribe', label: 'Unsubscribe link', scopes: ['body'], enabled: true },
  { key: 'user.firstName', label: 'User first name', scopes: ['body'], enabled: true },
  { key: 'user.lastName', label: 'User last name', scopes: ['body'], enabled: true },
  { key: 'user.email', label: 'User email', scopes: ['body'], enabled: true },
  { key: 'user.phone', label: 'User phone', scopes: ['body'], enabled: true },
  { key: 'recipient.email', label: 'Recipient email', scopes: ['body'], enabled: true },
];

type DynamicVariablesState = {
  variables: EmailDynamicVariable[];
  setVariables: (variables: EmailDynamicVariable[]) => void;
};

const dynamicVariablesStore = create<DynamicVariablesState>((set) => ({
  variables: [],
  setVariables: (variables) => set({ variables: Array.isArray(variables) ? variables : [] }),
}));

export function useDynamicVariables(): EmailDynamicVariable[] {
  return dynamicVariablesStore((s) => s.variables);
}

export function setDynamicVariables(variables: EmailDynamicVariable[]): void {
  dynamicVariablesStore.getState().setVariables(variables);
}

function isBodyVariable(v: EmailDynamicVariable): boolean {
  return v.enabled !== false && (!v.scopes?.length || v.scopes.includes('body'));
}

export function bodyDynamicVariables(variables: EmailDynamicVariable[]): EmailDynamicVariable[] {
  const enabled = variables.filter(isBodyVariable);
  const seen = new Set(enabled.map((v) => v.key.trim().toLowerCase()));
  const merged = [...enabled];
  for (const fallback of FALLBACK_BODY_DYNAMIC_VARIABLES) {
    const key = fallback.key.trim().toLowerCase();
    if (!seen.has(key)) {
      merged.push(fallback);
      seen.add(key);
    }
  }
  return merged.sort((a, b) => a.label.localeCompare(b.label));
}

export function mergeTagToken(key: string): string {
  return `{{${key}}}`;
}
