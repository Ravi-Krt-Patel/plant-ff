import type { State } from "../contracts";
import { seedProducts } from "../fixtures";
/** A unit-of-work boundary. A database adapter must preserve serializable transactions. */
export interface Repository {
  read<T>(reader: (state: Readonly<State>) => T): Promise<T>;
  transaction<T>(write: (state: State) => T): Promise<T>;
}
export class MemoryRepository implements Repository {
  private state: State = {
    products: new Map(seedProducts.map((p) => [p.id, structuredClone(p)])),
    sessions: new Map(),
    quotes: new Map(),
    orders: new Map(),
    attempts: new Map(),
    addresses: new Map(),
    carts: new Map(),
    wishlists: new Map(),
    capabilities: new Map(),
    idempotency: new Map(),
    contacts: new Map(),
  };
  async read<T>(reader: (state: Readonly<State>) => T): Promise<T> {
    return structuredClone(reader(structuredClone(this.state)));
  }
  async transaction<T>(write: (state: State) => T): Promise<T> {
    const draft = structuredClone(this.state);
    const result = write(draft);
    this.state = draft;
    return structuredClone(result);
  }
}
