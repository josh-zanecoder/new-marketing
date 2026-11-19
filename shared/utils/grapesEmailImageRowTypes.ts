/** Minimal Grapes shapes used by email image-row helpers (avoids pulling the full editor). */
export type GrapesComponent = {
  get: (key: string) => unknown
  set?: (key: string, value: unknown, opts?: object) => void
  getAttributes: () => Record<string, string>
  addAttributes: (attrs: Record<string, string>) => void
  addStyle?: (style: Record<string, string>) => void
  getStyle?: () => Record<string, string>
  parent: () => GrapesComponent | undefined
  components: {
    (): {
      models: GrapesComponent[]
      length: number
      at: (i: number) => GrapesComponent | undefined
      indexOf: (c: GrapesComponent) => number
    }
    (content?: unknown, opts?: object): unknown
  }
  find: (selector: string) => GrapesComponent[]
  remove: (opts?: object) => void
  append?: (content: unknown, opts?: object) => GrapesComponent[]
  closest?: (query: string) => GrapesComponent | undefined
  on?: (ev: string, cb: () => void) => void
  getEl?: () => HTMLElement | undefined
}

export type GrapesEditor = {
  BlockManager: {
    add: (id: string, conf: Record<string, unknown>) => void
    get: (id: string) => { set: (conf: Record<string, unknown>) => void } | undefined
  }
  DomComponents: {
    addType: (id: string, conf: Record<string, unknown>) => void
  }
  on: (event: string, cb: (...args: unknown[]) => void) => void
  Canvas?: {
    getDocument?: () => Document | undefined
    getBody?: () => HTMLElement | undefined
    getFrameEl?: () => HTMLIFrameElement | undefined
  }
  getWrapper?: () => GrapesComponent | undefined
}

export function readGrapesAttr(component: GrapesComponent, name: string): string {
  return String(component.getAttributes()?.[name] ?? '')
}

export function isGrapesImageComponent(component: GrapesComponent | undefined): boolean {
  if (!component) return false
  if (component.get('type') === 'image') return true
  // Newsletter / parsed HTML sometimes keeps tagName without type=image.
  return String(component.get('tagName') || '').toLowerCase() === 'img'
}

export function findGrapesAncestorWithAttr(
  component: GrapesComponent,
  attr: string
): GrapesComponent | undefined {
  let node: GrapesComponent | undefined = component
  while (node) {
    const attrs = node.getAttributes() || {}
    if (Object.prototype.hasOwnProperty.call(attrs, attr)) return node
    node = node.parent?.()
  }
  return undefined
}

export function resolveGrapesEventComponent(args: unknown[]): GrapesComponent | undefined {
  const payload = args[0] as
    | { target?: GrapesComponent; model?: GrapesComponent }
    | GrapesComponent
    | undefined
  if (!payload || typeof payload !== 'object') return undefined
  if ('target' in payload && payload.target) return payload.target
  if ('model' in payload && payload.model) return payload.model
  if (typeof (payload as GrapesComponent).get === 'function') return payload as GrapesComponent
  return undefined
}
