import { Checking } from "../checking"
import { connect } from "../connect/connect"
import { Env } from "../env"
import { appendReport } from "../errors/appendReport"
import { Mod } from "../mod"
import { findDefinitionOrFail } from "../mod/findDefinitionOrFail"
import { disconnectPort } from "../net/disconnectPort"
import { findPortEntry } from "../net/findPortEntry"
import { Node } from "../node"
import { createNodeFromDefinition } from "../node/createNodeFromDefinition"
import { unifyTypes } from "../unify/unifyTypes"
import { Word } from "../word"
import { formatWord } from "../word/formatWord"
import { composeDefinition } from "./composeDefinition"
import { composeNode } from "./composeNode"
import { findCurrentPortOrFail } from "./findCurrentPortOrFail"

export interface ComposeOptions {
  current?: { first: Node; second: Node }
  checking?: Checking
}

export function compose(
  mod: Mod,
  env: Env,
  word: Word,
  options: ComposeOptions,
): void {
  try {
    switch (word["@kind"]) {
      case "Call": {
        const found = env.locals.get(word.name)
        if (found !== undefined) {
          env.stack.push(found)
          env.locals.delete(word.name)
          return
        } else {
          const definition = findDefinitionOrFail(mod, word.name)
          composeDefinition(env, definition, options)
          return
        }
      }

      case "Builtin": {
        const definition = mod.builtins.get(word.name)
        if (definition === undefined) {
          throw new Error(
            [
              `[compose / Builtin] I meet undefined builtin.`,
              ``,
              `  name: ${word.name}`,
            ].join("\n"),
          )
        }

        composeDefinition(env, definition, options)
        return
      }

      case "Local": {
        const port = env.stack.pop()
        if (port === undefined) {
          throw new Error(
            `[compose / Local] expect a port on the top of the stack.`,
          )
        }

        env.locals.set(word.name, port)
        return
      }

      case "PortPush": {
        const currentPort = findCurrentPortOrFail(
          env.net,
          word.nodeName,
          word.portName,
          options,
        )

        const portEntry = findPortEntry(env.net, currentPort)

        if (portEntry?.connection === undefined) {
          throw new Error(
            [
              `[compose / PortPush] I expect the found port to have connection.`,
              ``,
              `  node name: ${word.nodeName}`,
              `  port name: ${word.portName}`,
            ].join("\n"),
          )
        }

        disconnectPort(env.net, portEntry.connection.port)

        env.stack.push(currentPort)
        return
      }

      case "PortReconnect": {
        const currentPort = findCurrentPortOrFail(
          env.net,
          word.nodeName,
          word.portName,
          options,
        )

        const portEntry = findPortEntry(env.net, currentPort)

        if (portEntry?.connection === undefined) {
          throw new Error(
            [
              `[compose / PortReconnect] I expect the found port to have connection.`,
              ``,
              `  node name: ${word.nodeName}`,
              `  port name: ${word.portName}`,
            ].join("\n"),
          )
        }

        disconnectPort(env.net, portEntry.connection.port)

        const value = env.stack.pop()
        if (value === undefined) {
          throw new Error(
            `[compose / PortReconnect] I expect top value on the stack.`,
          )
        }

        if (value["@kind"] !== "Port") {
          throw new Error(
            [
              `[compose / PortReconnect] I expect the top value to be a Port.`,
              ``,
              `  value['@kind']: ${value["@kind"]}`,
            ].join("\n"),
          )
        }

        connect(env.net, value, currentPort)
        if (options.checking) {
          unifyTypes(options.checking.substitution, value.t, currentPort.t)
        }

        return
      }

      case "GenrateSymbol": {
        env.stack.push({
          "@type": "Value",
          "@kind": "Symbol",
          name: word.name,
        })

        return
      }

      case "Label": {
        const value = env.stack.pop()
        if (value === undefined) {
          throw new Error(`[compose / Label] I expect top value on the stack.`)
        }

        env.stack.push({
          "@type": "Value",
          "@kind": "Labeled",
          value,
          label: word.label,
          isImportant: word.isImportant,
        })

        return
      }

      case "NodeRearrange": {
        const definition = findDefinitionOrFail(mod, word.name)
        composeNode(
          env,
          createNodeFromDefinition(env.net, definition),
          options,
          {
            input: word.input,
            output: word.output,
          },
        )

        return
      }
    }
  } catch (error) {
    throw appendReport(error, {
      message: [
        `[compose] I fail compose word.`,
        ``,
        `  word: ${formatWord(word)}`,
      ].join("\n"),
      context: {
        span: word.span,
        text: mod.text,
      },
    })
  }
}
