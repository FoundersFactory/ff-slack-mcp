interface N8nWorkflow {
    id: string;
    name: string;
    active: boolean;
    nodes: Array<{
        type: string;
        parameters: {
            httpMethod?: string;
            path?: string;
        };
    }>;
}

interface WorkflowResponse {
    data: N8nWorkflow[];
    nextCursor: string | null;
}

export interface ToolInfo {
    name: string;
    webhookPath: string;
}

export async function getToolList(): Promise<ToolInfo[]> {
    try {
        const response = await fetch('https://n8n.foundersfactory.co/api/v1/workflows?active=true');
        const data: WorkflowResponse = await response.json();
        
        const tools: ToolInfo[] = [];
        
        for (const workflow of data.data) {
            // Find webhook nodes in the workflow
            const webhookNodes = workflow.nodes.filter(node => 
                node.type === 'n8n-nodes-base.webhook' && 
                node.parameters.httpMethod && 
                node.parameters.path
            );
            
            // Add each webhook path to the tools list
            for (const webhook of webhookNodes) {
                tools.push({
                    name: workflow.name,
                    webhookPath: webhook.parameters.path || ''
                });
            }
        }
        
        return tools;
    } catch (error) {
        console.error('Error fetching tool list:', error);
        throw error;
    }
}
