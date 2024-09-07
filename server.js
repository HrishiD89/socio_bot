import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { GoogleGenerativeAI } from "@google/generative-ai";

import UserModel from "./src/models/User.js";
import EventModel from "./src/models/Event.js";
import connectDb from "./src/config/db.js";

const bot = new Telegraf(process.env.TELEGRAM_BOT_API_KEY);

// gemini ai

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const promptTemplate = (platform, eventList) => {
  const template = {
    LinkedIn: `Act as a senior copywriter, you write highly engaging post for linkedIn using provided thoughts/events throught the day.and Write like a human, for humans.Use simple language.Ensure the tone is conversational and impactful. Focus on engaging the respective platform's audience, encouraging interaction, and driving interest in the events:
    * dont give heading
: ${eventList}`,
    Facebook: `Act as a senior copywriter, you write highly engaging post for facebook using provided thoughts/events throught the day and Write like a human, for humans.Use simple language.Ensure the tone is conversational and impactful. Focus on engaging the respective platform's audience, encouraging interaction, and driving interest in the events:
    * dont't give heading
: ${eventList}`,
    Twitter: `Act as a senior copywriter, you write one highly engaging post for twitter using provided thoughts/events throught the day and Write like a human, for humans.Use simple language.Ensure the tone is conversational and impactful. Focus on engaging the respective platform's audience, encouraging interaction, and driving interest in the events:
: ${eventList}`,
  };
  return template[platform];
};

// database connection

try {
  connectDb();
  console.log("Database connected successfully");
} catch (err) {
  console.log(err);
  process.kill(process.pid, "SIGTERM");
}

bot.start(async (ctx) => {
  const from = ctx.update.message.from;
  console.log("from: ", from);

  try {
    await UserModel.findOneAndUpdate(
      { tgId: from.id },
      {
        $setOnInsert: {
          firstName: from.first_name,
          lastName: from.last_name,
          isBot: from.is_bot,
          username: from.username,
        },
      },
      { upsert: true, new: true }
    );

    await ctx.reply(
      `Hey! ${from.first_name}, Welcome. I will be writing highly engaging social media post for you ✈️ Just keep feeding me with the events throught the day. Let's shine on social media ✨`
    );
  } catch (err) {
    console.log(err);
    await ctx.reply("Facing difficulties. Please try again later 🙏");
  }

  const {message_id,welcomeSticker} =  await ctx.replyWithSticker('CAACAgIAAxkBAAOxZtyYUI4ODkHu94eI9lb4FgABIaiPAAJeEgAC7JkpSXzv2aVH92Q7NgQ');
});

bot.command("generate", async (ctx) => {
  const from = ctx.update.message.from;

  const {message_id : waitingMessageID} = await ctx.reply(
    `Hey! ${from.first_name}, Kindly wait for a moment. I am curating the post for you 🚀⌛`
  )

  const {message_id: loadingStickerId}  = await ctx.replyWithSticker('CAACAgIAAxkBAAOqZtyXKU6IQGxNQKTgaHlypD5iB18AArwMAAKHKDBJ7TeRmVghaAQ2BA')

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfTheDay = new Date();
  endOfTheDay.setHours(23, 59, 59, 999);

  //* get events for the user from db on the basis of day

  const events = await EventModel.find({
    tgId: from.id,
    createdAt: {
      $gte: startOfDay,
      $lte: endOfTheDay,
    },
  });

  if (events.length === 0) {
    await ctx.deleteMessage(waitingMessageID);
    await ctx.deleteMessage(loadingStickerId);
    await ctx.reply("No event for the day.");
    return;
  }

  const eventList = events.map((event) => event.text).join(", ");

  try {
    const platforms = ["LinkedIn", "Facebook", "Twitter"];
    const responses = [];
    const totalTokenCounts = {
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0,
    };
    for (const platform of platforms) {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = promptTemplate(platform, eventList);
      const result = await model.generateContent(prompt);

      const { promptTokenCount, candidatesTokenCount, totalTokenCount } =
        result.response.usageMetadata;
      totalTokenCounts.promptTokenCount += promptTokenCount;
      totalTokenCounts.candidatesTokenCount += candidatesTokenCount;
      totalTokenCounts.totalTokenCount += totalTokenCount;

      responses.push(result.response.text());
    }

    // store token count

    await UserModel.findOneAndUpdate(
      {
        tgId: from.id,
      },
      {
        $inc: {
          promptTokensCount: totalTokenCounts.promptTokenCount,
          candidatesTokenCount: totalTokenCounts.candidatesTokenCount,
        },
      }
    );

    
    await ctx.deleteMessage(waitingMessageID);
    await ctx.deleteMessage(loadingStickerId);

    // send response.
    await ctx.reply(
      `Here are your social media posts:\n\nLinkedIn:\n${responses[0]}\n\nFacebook:\n${responses[1]}\n\nTwitter:\n${responses[2]}`
    );
  } catch (err) {
    console.log("error: ", err);
    await ctx.reply("Facing difficulties. Please try again later 🙏");
  }
});

// bot.on(message("sticker"),(ctx)=>{
//   console.log('stciker',ctx.update.message);
// })

bot.on(message("text"), async (ctx) => {
  const from = ctx.update.message.from;
  const message = ctx.update.message.text;

  try {
    await EventModel.create({
      text: message,
      tgId: from.id,
    });

    ctx.reply(
      "Noted 👍, Keep texting me your thougts. To generate the posts, just enter the commands: /generate"
    );
  } catch (err) {
    console.log(err);
    await ctx.reply("Facing difficulties. Please try again later 🙏");
  }
});

bot.launch();

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
