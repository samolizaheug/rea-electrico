/** Número complejo inmutable (fasores, impedancias, potencia compleja). */
export class Complex {
  constructor(
    readonly re: number,
    readonly im = 0,
  ) {}

  static readonly ZERO = new Complex(0, 0);

  static polar(mag: number, angleRad: number): Complex {
    return new Complex(mag * Math.cos(angleRad), mag * Math.sin(angleRad));
  }

  add(o: Complex): Complex {
    return new Complex(this.re + o.re, this.im + o.im);
  }
  sub(o: Complex): Complex {
    return new Complex(this.re - o.re, this.im - o.im);
  }
  mul(o: Complex | number): Complex {
    if (typeof o === "number") return new Complex(this.re * o, this.im * o);
    return new Complex(this.re * o.re - this.im * o.im, this.re * o.im + this.im * o.re);
  }
  div(o: Complex | number): Complex {
    if (typeof o === "number") return new Complex(this.re / o, this.im / o);
    const d = o.re * o.re + o.im * o.im;
    return new Complex((this.re * o.re + this.im * o.im) / d, (this.im * o.re - this.re * o.im) / d);
  }
  conj(): Complex {
    return new Complex(this.re, -this.im);
  }
  abs(): number {
    return Math.hypot(this.re, this.im);
  }
  arg(): number {
    return Math.atan2(this.im, this.re);
  }
}
