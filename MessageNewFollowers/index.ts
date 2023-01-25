import { AzureFunction, Context } from "@azure/functions"
import { TwitterApi } from "twitter-api-v2";

const queueTrigger: AzureFunction = async function (context: Context, myQueueItem: string): Promise<void> {
    const client = new TwitterApi({
        appKey: process.env["APP_ID"],
        appSecret: process.env["APP_SECRET"],
        accessToken: process.env["ACCESS_TOKEN"],
        accessSecret: process.env["ACCESS_SECRET"]
    });

    let result = await client.v1.sendDm({
        recipient_id: myQueueItem,
        text: `Thank you for following @ElectraSantiago
 
        I am Her personal slave, and She has asked that I communicate that She has a very special task for you. She is eager to speak with you and has requested that you send a DM here: http://www.onlyfans.com/electrasantiagovip`
    });

    context.log(result.event.id + " => " + myQueueItem);
};

export default queueTrigger;
