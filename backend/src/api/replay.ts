/**
 * REST API endpoints for replay functionality
 */

import { Router, Request, Response } from 'express';
import { TraceModel, NodeModel } from '../database/models.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/traces/:id/replay
 * Replay agent execution from a specific node
 */
router.post('/:id/replay', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { from_node, modifications } = req.body;

    if (!from_node) {
      return res.status(400).json({ error: 'from_node is required' });
    }

    const trace = TraceModel.findById(id);
    if (!trace) {
      return res.status(404).json({ error: 'Trace not found' });
    }

    const fromNode = NodeModel.findByRunId(from_node);
    if (!fromNode) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // Get all nodes before this one
    const allNodes = NodeModel.findByTraceId(id);
    const nodesBeforeReplay = allNodes.filter(n => 
      n.startTime < fromNode.startTime
    );

    // Serialize state
    const state = serializeState(nodesBeforeReplay);

    const replayTraceId = `${id}-replay-${Date.now()}`;

    res.json({
      replay_trace_id: replayTraceId,
      original_trace_id: id,
      from_node,
      modifications,
      state,
      message: 'Replay configured. Agent will execute on next connection.'
    });

  } catch (error) {
    logger.error('Error creating replay:', error);
    res.status(500).json({ error: 'Failed to create replay' });
  }
});

/**
 * Serialize agent state for replay
 */
function serializeState(nodes: any[]): any {
  const conversationHistory = [];
  const toolOutputs: Record<string, any> = {};
  
  for (const node of nodes) {
    if (node.type === 'llm') {
      conversationHistory.push({
        role: 'user',
        content: node.data?.prompts?.[0] || ''
      });
      conversationHistory.push({
        role: 'assistant',
        content: node.data?.response || ''
      });
    } else if (node.type === 'tool') {
      toolOutputs[node.data?.toolName] = node.data?.output;
    }
  }

  return {
    conversation_history: conversationHistory,
    tool_outputs: toolOutputs,
    timestamp: Date.now()
  };
}

export default router;