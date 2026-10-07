import type { Answers } from "./engine";
// Arithmetic only. Question references use {{question-id}}; never evaluate JavaScript.
export function calculate(formula: string, answers: Answers): number | null {
  try {
    const source = formula.replace(/\{\{([\w-]+)\}\}/g, (_, id: string) => {
      const n = Number(answers[id] ?? 0);
      if (!Number.isFinite(n)) throw new Error();
      return String(n);
    });
    const tokens = source.match(/(?:\d+\.?\d*|\.\d+)|[()+\-*/]/g) || [];
    if (tokens.join("") !== source.replace(/\s/g, "")) return null;
    let i = 0;
    function atom(): number {
      const t = tokens[i++];
      if (t === "-") return -atom();
      if (t === "+") return atom();
      if (t === "(") {
        const v = add();
        if (tokens[i++] !== ")") throw new Error();
        return v;
      }
      if (!t || !/^\d|^\./.test(t)) throw new Error();
      return Number(t);
    }
    function mul(): number {
      let v = atom();
      while (tokens[i] === "*" || tokens[i] === "/") {
        const op = tokens[i++],
          b = atom();
        v = op === "*" ? v * b : v / b;
      }
      return v;
    }
    function add(): number {
      let v = mul();
      while (tokens[i] === "+" || tokens[i] === "-") {
        const op = tokens[i++],
          b = mul();
        v = op === "+" ? v + b : v - b;
      }
      return v;
    }
    const result = add();
    return i === tokens.length && Number.isFinite(result)
      ? Math.round(result * 1000000) / 1000000
      : null;
  } catch {
    return null;
  }
}
