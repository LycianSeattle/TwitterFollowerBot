import { AzureFunction, Context } from "@azure/functions";
import followers from '../shared/followers'

const timerTrigger: AzureFunction = async function (context: Context, myTimer: any): Promise<void> {
    await followers(undefined);
};

export default timerTrigger;
