/**
 * BeeAgent UI 类型声明
 * @module @bee-agent/ui
 */

import type { BeeAgent } from '@bee-agent/agent-core'

export interface BeeAgentUIProps {
  agent: BeeAgent
  onClose?: () => void
}

export declare function mountBeeAgentUI(agent: BeeAgent): () => void
export declare function BeeAgentUI(props: BeeAgentUIProps): JSX.Element
