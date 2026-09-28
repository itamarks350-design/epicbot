const { 
    Client, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    SlashCommandBuilder, 
    REST, 
    Routes, 
    InteractionContextType, 
    ApplicationIntegrationType,
    MessageFlags
} = require('discord.js');
const http = require('http');

// הגדרת משתני סביבה וכתובות
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;
const WEBSITE_URL = 'https://epicgames-pi.vercel.app';

// 1. שרת HTTP לשמירה על הזמינות ב-Render
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running successfully!');
});

server.listen(PORT, () => {
    console.log(`[HTTP Server] Listening on port ${PORT}`);
});

// 2. אתחול הלקוח של Discord
const client = new Client({ intents: [] });

// 3. אירוע התחברות ורישום פקודות
client.once('ready', async () => {
    console.log(`[Discord] Logged in as ${client.user.tag}`);

    const command = new SlashCommandBuilder()
        .setName('login')
        .setDescription('התחברות לחשבון')
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
        .setContexts(
            InteractionContextType.BotDM, 
            InteractionContextType.Guild, 
            InteractionContextType.PrivateChannel
        );

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        console.log('[Discord] Updating global slash commands...');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: [command.toJSON()] }
        );
        console.log('[Discord] Slash commands registered successfully!');
    } catch (error) {
        console.error('[Discord Error] Failed to register commands:', error);
    }
});

// 4. טיפול באינטראקציות (פקודת /login)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'login') {
        const loginButton = new ButtonBuilder()
            .setLabel('Log in')
            .setURL(WEBSITE_URL)
            .setStyle(ButtonStyle.Link);

        const row = new ActionRowBuilder().addComponents(loginButton);

        await interaction.reply({
            content: `Open [this link](${WEBSITE_URL}) to log in to your account.`,
            components: [row],
            flags: MessageFlags.Ephemeral
        });
    }
});

// התחברות לבוט
client.login(TOKEN);
