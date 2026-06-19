import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { requireStaff } from "../utils/permissions";
import {
  buildRestrictionDmEmbed,
  buildUnrestrictDmEmbed,
  buildCooldownExpiredDmEmbed,
  buildCooldownWarnDmEmbed,
} from "../utils/embeds";
import { GAMEMODE_KEYS, GAMEMODES, Gamemode } from "../utils/constants";

const DM_TYPES = [
  { name: "Restriction Added", value: "restriction_add" },
  { name: "Restriction Removed", value: "restriction_remove" },
  { name: "Cooldown Ended", value: "cooldown_ended" },
  { name: "2 Hours Before Cooldown Ending", value: "cooldown_warning" },
] as const;

type DmType = (typeof DM_TYPES)[number]["value"];

export const testDmCommand = {
  data: new SlashCommandBuilder()
    .setName("test-dm")
    .setDescription("Preview any DM the bot sends — delivers it to you directly (Regulator+)")
    .setDefaultMemberPermissions(null)
    .addStringOption((o) =>
      o
        .setName("type")
        .setDescription("Which DM type to preview")
        .setRequired(true)
        .addChoices(...DM_TYPES.map((t) => ({ name: t.name, value: t.value })))
    )
    .addStringOption((o) =>
      o
        .setName("gamemode")
        .setDescription("Gamemode to use in the cooldown previews (default: SMP)")
        .setRequired(false)
        .addChoices(...GAMEMODE_KEYS.map((gm) => ({ name: GAMEMODES[gm], value: gm })))
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "regulator"))) return;

    const dmType = interaction.options.getString("type", true) as DmType;
    const gamemode = (interaction.options.getString("gamemode") ?? "smp") as Gamemode;

    await interaction.deferReply({ ephemeral: true });

    let embed;

    switch (dmType) {
      case "restriction_add":
        embed = buildRestrictionDmEmbed({
          type: "test_cheater",
          isPermanent: false,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          restrictedBy: member.id,
          reason: "This is a sample reason shown in the DM.",
        });
        break;

      case "restriction_remove":
        embed = buildUnrestrictDmEmbed({
          type: "test_cheater",
          tiersRestored: 2,
        });
        break;

      case "cooldown_ended":
        embed = buildCooldownExpiredDmEmbed(gamemode);
        break;

      case "cooldown_warning":
        embed = buildCooldownWarnDmEmbed(
          gamemode,
          new Date(Date.now() + 2 * 60 * 60 * 1000)
        );
        break;
    }

    const sent = await interaction.user.send({ embeds: [embed] }).catch(() => null);

    if (sent) {
      await interaction.editReply({
        content: `✅ **${DM_TYPES.find((t) => t.value === dmType)!.name}** DM sent to your inbox.`,
      });
    } else {
      await interaction.editReply({
        content: "❌ Couldn't send you a DM — make sure your DMs are open.",
      });
    }
  },
};
