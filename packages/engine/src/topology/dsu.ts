/** Conjuntos disjuntos (union-find) sobre claves de texto, con compresión de camino. */
export class DisjointSets {
  private readonly parent = new Map<string, string>();

  find(x: string): string {
    let root = x;
    for (let p = this.parent.get(root); p !== undefined && p !== root; p = this.parent.get(root)) root = p;
    let cur = x;
    while (cur !== root) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  /** Une los conjuntos; devuelve false si ya estaban unidos. */
  union(a: string, b: string): boolean {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return false;
    this.parent.set(ra, rb);
    return true;
  }

  same(a: string, b: string): boolean {
    return this.find(a) === this.find(b);
  }
}
