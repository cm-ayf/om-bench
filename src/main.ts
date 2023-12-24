import { once } from "events";
import { ActivityType, Client, Events, GatewayIntentBits } from "discord.js";
import * as join from "./commands/join";
import * as leave from "./commands/leave";
import * as skip from "./commands/skip";
import { ReplyableError } from "./error";
import Pipeline from "./pipeline";
import { version } from "./version";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.inCachedGuild()) return;
  if (!interaction.isChatInputCommand()) return;
  try {
    switch (interaction.commandName) {
      case "join":
        return await join.handler(interaction);
      case "leave":
        return await leave.handler(interaction);
      case "skip":
        return await skip.handler(interaction);
      default:
        throw new Error("不明なコマンドです。");
    }
  } catch (e) {
    if (!(e instanceof ReplyableError)) console.error(e);
    await interaction.reply(ReplyableError.from(e).toReply());
  }
});

client.on(Events.VoiceStateUpdate, async (_, n) => {
  const pipeline = Pipeline.get(n.guild.id);

  if (!pipeline) return;
  if (pipeline.channel.members.filter((m) => !m.user.bot).size > 0) return;

  setImmediate(() => pipeline.connection.destroy());
  await once(pipeline, "destroy");
  await pipeline.channel
    .send("ボイスチャンネルに誰もいなくなったため退出しました。")
    .catch(console.error);
});

client.once(Events.ClientReady, async (client) => {
  client.application.commands.cache.clear();
  await client.application.commands.set([
    join.definition,
    leave.definition,
    skip.definition,
  ]);
  client.user.setActivity({
    type: ActivityType.Custom,
    name: `v${version}`,
  });
});

function shutdown() {
  void client.destroy().then(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

void client.login();
