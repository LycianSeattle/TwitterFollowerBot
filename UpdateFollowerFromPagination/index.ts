import { AzureFunction, Context } from "@azure/functions"
import followers from "../shared/followers";

const queueTrigger: AzureFunction = async function (context: Context, paginationToken: string): Promise<void> {
    context.log('Queue trigger function processed work item', paginationToken);
    await followers(paginationToken);
};

export default queueTrigger;
