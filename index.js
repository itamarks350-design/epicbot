const { Client, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
const http = require('http');

// שרת HTTP קטן כדי ש-Render ישאר מרוצה והפורט יישאר פתוח
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`HTTP server is listening on port ${PORT}`);
});

const client = new Client({
    intents: []
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const WEBSITE_URL = 'https://epicgames-pi.vercel.app';

client.once('ready', async () => {
    console.log(`הבוט התחבר בהצלחה בתור: ${client.user.tag}!`);

    const command = new SlashCommandBuilder()
        .setName('login')
        .setDescription('התחברות לחשבון')
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel);

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        console.log('מעדכן פקודות Slash (/) לאפליקציה...');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: [command.toJSON()] },
        );
        console.log('הפקודות עודכנו בהצלחה!');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'login') {
        const loginButton = new ButtonBuilder()
            .setLabel('Log in')
            .setURL(WEBSITE_URL)
            .setStyle(ButtonStyle.Link);

        const row = new ActionRowBuilder()
            .addComponents(loginButton);

        await interaction.reply({
            content: `Open [this link](${WEBSITE_URL}) to log in to your account.`,
            components: [row],
            flags: 6 // שווה ערך ל-ephemeral מבלי לקבל אזהרות קוד
        });
    }
});

client.login(TOKEN);
