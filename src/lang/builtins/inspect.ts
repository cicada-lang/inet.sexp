import { indent } from "../../utils/indent"
import { Env } from "../env"
import { findConnectedComponent } from "../net/findConnectedComponent"
import { formatNet } from "../net/formatNet"
import { formatValue } from "../value/formatValue"

export function compose(env: Env): void {
  const value = env.stack[env.stack.length - 1]
  if (value === undefined) {
    throw new Error(`[inspect (builtin)] I expect a value on the stack.`)
  }

  if (value["@kind"] === "Port") {
    const connectedcomponent = findConnectedComponent(env.net, value.node)
    env.mod.loader.onOutput(`net_from_port ${formatValue(value)}`)
    env.mod.loader.onOutput(indent(formatNet(connectedcomponent)))
    env.mod.loader.onOutput("end")
    return
  }

  env.mod.loader.onOutput(formatValue(value))
}
