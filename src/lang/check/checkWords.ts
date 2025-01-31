import { capType } from "../cap/capType.ts"
import { createChecking } from "../checking/createChecking.ts"
import { collectWords } from "../compose/collectWords.ts"
import { compose } from "../compose/compose.ts"
import { createEnv } from "../env/createEnv.ts"
import { freshenType } from "../freshen/freshenType.ts"
import { type Mod } from "../mod/index.ts"
import { unifyTypes } from "../unify/unifyTypes.ts"
import { formatValue } from "../value/formatValue.ts"
import { type Word } from "../word/index.ts"
import { checkAllLocalsAreUsed } from "./checkAllLocalsAreUsed.ts"

export function checkWords(
  mod: Mod,
  input: Array<Word>,
  output: Array<Word>,
  words: Array<Word>,
): void {
  const checking = createChecking()
  const env = createEnv(mod)
  const occurredNames = new Map()

  const inputValues = collectWords(mod, env, input, {
    checking,
  }).map((t) => freshenType(checking.typeVarCounters, t, occurredNames))

  checkAllLocalsAreUsed(env.locals)

  const capOutputPorts = inputValues
    .reverse()
    .map((t) => capType(mod, env.net, t))

  env.stack.push(...capOutputPorts)

  for (const word of words) {
    compose(mod, env, word, {
      checking,
    })
  }

  checkAllLocalsAreUsed(env.locals)

  const outputValues = collectWords(mod, env, output, {
    checking,
  }).map((t) => freshenType(checking.typeVarCounters, t, occurredNames))

  checkAllLocalsAreUsed(env.locals)

  for (const t of [...outputValues].reverse()) {
    const value = env.stack.pop()
    if (value === undefined) {
      throw new Error(`[checkWords] I expect a value on top of the stack.`)
    }

    if (value["@kind"] !== "Port") {
      throw new Error(
        [
          `[checkWords] I expect the top value on the stack to be a Port.`,
          ``,
          `  value['@kind']: ${value["@kind"]}`,
        ].join("\n"),
      )
    }

    unifyTypes(checking.substitution, value.t, t)
  }

  if (env.stack.length !== 0) {
    throw new Error(
      [
        `[checkWords] I expect the stack to be empty after checking.`,
        ``,
        `  stack length: ${env.stack.length}`,
        `  stack: [${env.stack.map(formatValue).join(", ")}]`,
        ``,
        `  Maybe this is due to extra input arity,`,
        `  or lack of output arity.`,
      ].join("\n"),
    )
  }
}
