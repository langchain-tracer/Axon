/**
 * REST API endpoints for traces
 */

import { Router, Request, Response } from 'express';
import { TraceModel, NodeModel, EdgeModel, AnomalyModel } from '../database/models.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/traces
 * List all traces
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const { projectName, limit = 50, offset = 0 } = req.query;

    const traces = TraceModel.list({
      projectName: projectName as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

    res.json({
      traces,
      count: traces.length
    });
  } catch (error) {
    logger.error('Error listing traces:', error);
    res.status(500).json({ error: 'Failed to list traces' });
  }
});

/**
 * GET /api/traces/:id
 * Get trace details with nodes and edges
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const trace = TraceModel.findById(id);
    if (!trace) {
      return res.status(404).json({ error: 'Trace not found' });
    }

    const nodes = NodeModel.findByTraceId(id);
    const edges = EdgeModel.findByTraceId(id);
    const anomalies = AnomalyModel.findByTraceId(id);

    res.json({
      trace,
      nodes,
      edges,
      anomalies
    });
  } catch (error) {
    logger.error('Error getting trace:', error);
    res.status(500).json({ error: 'Failed to get trace' });
  }
});

/**
 * GET /api/traces/:id/nodes/:runId
 * Get specific node details
 */
router.get('/:id/nodes/:runId', (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const node = NodeModel.findByRunId(runId);
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    res.json({ node });
  } catch (error) {
    logger.error('Error getting node:', error);
    res.status(500).json({ error: 'Failed to get node' });
  }
});

/**
 * GET /api/traces/:id/cost-analysis
 * Get cost breakdown for trace
 */
router.get('/:id/cost-analysis', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const nodes = NodeModel.findByTraceId(id);
    
    // Calculate cost by node
    const nodesByCost = nodes
      .filter(n => n.cost && n.cost > 0)
      .sort((a, b) => (b.cost || 0) - (a.cost || 0))
      .slice(0, 10)
      .map(n => ({
        name: n.type === 'llm' ? n.data?.model : n.data?.toolName,
        cost: n.cost,
        tokens: n.tokens?.total || 0
      }));

    // Calculate cost by model
    const costByModel: Record<string, number> = {};
    nodes.forEach(n => {
      if (n.cost && n.type === 'llm') {
        const model = n.data?.model || 'unknown';
        costByModel[model] = (costByModel[model] || 0) + n.cost;
      }
    });

    const costByModelArray = Object.entries(costByModel).map(([name, cost]) => ({
      name,
      cost
    }));

    // Calculate totals
    const totalCost = nodes.reduce((sum, n) => sum + (n.cost || 0), 0);
    const totalTokens = nodes.reduce((sum, n) => sum + (n.tokens?.total || 0), 0);
    const avgCostPerNode = totalCost / nodes.length;

    // Generate optimization suggestions
    const suggestions = generateOptimizationSuggestions(nodes);

    res.json({
      total_cost: totalCost,
      total_tokens: totalTokens,
      avg_cost_per_node: avgCostPerNode,
      nodes_by_cost: nodesByCost,
      cost_by_model: costByModelArray,
      suggestions
    });
  } catch (error) {
    logger.error('Error analyzing costs:', error);
    res.status(500).json({ error: 'Failed to analyze costs' });
  }
});

/**
 * Generate optimization suggestions
 */
function generateOptimizationSuggestions(nodes: any[]): any[] {
  const suggestions = [];

  const expensiveNodes = nodes
    .filter(n => n.cost && n.cost > 0)
    .sort((a, b) => (b.cost || 0) - (a.cost || 0))
    .slice(0, 3);

  for (const node of expensiveNodes) {
    if (node.type === 'llm') {
      const totalCost = nodes.reduce((sum, n) => sum + (n.cost || 0), 0);
      const nodePct = ((node.cost / totalCost) * 100).toFixed(0);

      if (node.data?.model?.includes('gpt-4')) {
        suggestions.push({
          title: `Switch ${node.data.model} to GPT-3.5`,
          description: `This node costs $${node.cost.toFixed(4)} (${nodePct}% of total). GPT-3.5 is 10x cheaper.`,
          savings: node.cost * 0.9,
          savings_percentage: 90
        });
      }

      if (node.tokens?.total && node.tokens.total > 2000) {
        suggestions.push({
          title: 'Reduce prompt length',
          description: `This prompt uses ${node.tokens.total} tokens. Consider summarizing.`,
          savings: node.cost * 0.5,
          savings_percentage: 50
        });
      }
    }
  }

  return suggestions;
}

export default router;