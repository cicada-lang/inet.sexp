import { collectWordsOutput } from "../compose/collectWordsOutput"
import { createEnv } from "../env/createEnv"
import { appendReport } from "../errors/appendReport"
import { Mod } from "../mod"
import { define } from "../mod/define"
import { Span } from "../span"
import { Stmt } from "../stmt"
import { Word } from "../word"

export class DefineType implements Stmt {
  constructor(
    public name: string,
    public input: Array<Word>,
    public output: Array<Word>,
    public span: Span,
  ) {}

  async execute(mod: Mod): Promise<void> {
    try {
      define(mod, this.name, {
        "@type": "Definition",
        "@kind": "TypeDefinition",
        mod,
        span: this.span,
        name: this.name,
        input: this.input,
        output: this.output,
        arity: collectWordsOutput(mod, createEnv(mod), this.input, {}).length,
      })
    } catch (error) {
      throw appendReport(error, {
        message: [
          `[DefineType.execute] I fail to define rule.`,
          ``,
          `  type name: ${this.name}`,
        ].join("\n"),
        context: {
          span: this.span,
          text: mod.text,
        },
      })
    }
  }
}
