import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  TextChannel,
  EmbedBuilder,
} from "discord.js";
import { requireSuperAdmin } from "../utils/permissions";
import { db } from "../database";
import { queues } from "../database/schema";
import { isNotNull } from "drizzle-orm";

const WATERMARK_PATTERNS = [
  / \| Matrix tierlist Dev - DyingEcho/gi,
  / \| Matrix Tierlist \| Dev — DyingEcho/gi,
  /Matrix Tierlist \| Dev — DyingEcho/gi,
  /Matrix tierlist Dev - DyingEcho/gi,
];

function stripWatermark(text: string): string {
  let result = text;
  for (const pattern of WATERMARK_PATTERNS) {
    result = result.replace(pattern, "");
  }
  return result.trim();
}

export const refreshQueueEmbedsCommand = {
  data: new SlashCommandBuilder()
    .setName("refresh-queue-embeds")
    .setDescription("Strip watermarks from all live queue/waitlist embed messages (Super Admin only)")
    .setDefaultMemberPermissions(null),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member as GuildMember;
    if (!(await requireSuperAdmin(interaction))) return;

    const allQueues = await db
      .select()
      .from(queues)
      .where(isNotNull(queues.messageId));

    let edited = 0;
    let skipped = 0;
    let failed = 0;

    for (const queue of allQueues) {
      if (!queue.channelId || !queue.messageId) {
        skipped++;
        continue;
      }

      try {
        const channel = (await client.channels.fetch(queue.channelId).catch(() => null)) as TextChannel | null;
        if (!channel?.isTextBased()) { skipped++; continue; }

        const msg = await channel.messages.fetch(queue.messageId).catch(() => null);
        if (!msg || msg.embeds.length === 0) { skipped++; continue; }

        const original = msg.embeds[0];
        const footerText = original.footer?.text ?? "";
        const newFooterText = stripWatermark(footerText);

        // Skip if footer has no watermark
        if (newFooterText === footerText) { skipped++; continue; }

        const updated = EmbedBuilder.from(original);
        if (newFooterText) {
          updated.setFooter({ text: newFooterText, iconURL: original.footer?.iconURL });
        } else {
          updated.setFooter(null);
        }

        await msg.edit({
          content: msg.content || undefined,
          embeds: [updated],
          components: msg.components.length > 0 ? msg.components : [],
        });

        edited++;
      } catch (err) {
        console.error(`Failed to edit queue message for queue ${queue.id}:`, err);
        failed++;
      }
    }

    await interaction.editReply({
      content: [
        `✅ Done scanning **${allQueues.length}** queue message(s).`,
        `• **${edited}** edited (watermark removed)`,
        `• **${skipped}** skipped (no watermark or message not found)`,
        ...(failed > 0 ? [`• **${failed}** failed (check logs)`] : []),
      ].join("\n"),
    });
  },
};
